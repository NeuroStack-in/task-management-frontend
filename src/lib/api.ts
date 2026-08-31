/**
 * The real backend HTTP client.
 *
 * This is the seam the mock services are migrating onto: `component → module service → apiFetch`.
 * Every call carries a **fresh** Cognito id token (see `lib/cognito.getIdToken`) — the API Gateway
 * JWT authorizer verifies it and the Lambda reads the RBAC claims from it. A 401 means the session
 * is gone/expired; a 403 means the server denied the permission (the server is the real gate).
 */
import { getIdToken } from "@/lib/cognito";
import { apiErrorMessage } from "@/lib/errors";

/**
 * A failed request, carrying **display-ready** text.
 *
 * `message` is what a user should read (`lib/errors.apiErrorMessage` decides it); `serverMessage` is
 * what the API actually said, kept for the console and for support tickets. Callers may show
 * `message` directly — most already do — without leaking `Request failed (500).` to a person.
 */
export class ApiError extends Error {
  /** The API's own words. Not for display; log it, don't render it. */
  readonly serverMessage?: string;

  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    serverMessage?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.serverMessage = serverMessage;
  }
}

function baseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new ApiError(
      "Missing NEXT_PUBLIC_API_URL. Copy .env.example to .env.local.",
      0,
    );
  }
  return url.replace(/\/$/, "");
}

/** The backend's success envelope: `{ data, cursor? }`; errors are `{ error: { code, message } }`. */
interface Envelope<T> {
  data: T;
  cursor?: string;
}

/**
 * Transient statuses worth retrying: 503 (Lambda cold-start / unavailable) and 429 (throttle). A
 * burst of reads can trip these even when nothing is wrong; a short retry smooths it over.
 */
const TRANSIENT = new Set([429, 503]);
const MAX_RETRIES = 2;

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getIdToken();
  // Only **idempotent** requests may be retried. Retrying a POST/PATCH on a 503 could double-apply
  // it (the request may have reached the handler before the gateway gave up), so writes never retry
  // — only GET (the default when no method is set).
  const method = (init.method ?? "GET").toUpperCase();
  const retryable = method === "GET";

  let res: Response | null = null;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch(`${baseUrl()}${path}`, {
        ...init,
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...init.headers,
        },
      });
    } catch (e) {
      // `fetch` rejects (rather than resolving with a status) when the request never reached a
      // server: offline, DNS failure, CORS refusal. That surfaced as the browser's raw
      // "Failed to fetch". Status 0 marks "no response", and `apiErrorMessage` turns it into a
      // sentence about the user's connection — the thing they can actually act on.
      throw new ApiError(
        apiErrorMessage(0),
        0,
        "network",
        e instanceof Error ? e.message : undefined,
      );
    }
    if (res.ok || !retryable || !TRANSIENT.has(res.status) || attempt >= MAX_RETRIES) {
      break;
    }
    // Exponential backoff with a little spread so parallel callers don't retry in lockstep.
    await new Promise((r) => setTimeout(r, 200 * 2 ** attempt + Math.random() * 100));
  }

  // Read as text first so an empty body and an unparseable one stay distinguishable. `res.json()`
  // collapses both to the same failure, which is what made a successful no-content write look broken.
  const raw = await res.text();
  let body: unknown = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } })?.error;
    // The user-facing sentence is decided once, here — not at each of the ~26 places that show
    // `e.message` in a toast. `Request failed (500).` never reaches a person again.
    throw new ApiError(
      apiErrorMessage(res.status, err?.message),
      res.status,
      err?.code,
      err?.message,
    );
  }

  // **A successful no-content response has no envelope to unwrap.** `DELETE …/members/{user_id}`
  // and `DELETE …/tasks/{id}` answer `204`, and axum handlers returning `Ok(())` answer `200` with
  // an empty body. Reading `.data` off `null` threw a TypeError, so the write succeeded on the
  // server while the UI reported failure — a member really was removed under a "members weren't
  // updated" toast. Callers of these routes type the result `void`, so `undefined` is the answer.
  if (!raw) return undefined as T;

  // An OK response with a body that isn't the envelope is a server contract break, not a caller
  // error. Say so in the user's terms and keep the technical fact on `serverMessage`, rather than
  // letting `.data` throw a TypeError three frames away.
  if (typeof body !== "object" || body === null || !("data" in body)) {
    throw new ApiError(
      apiErrorMessage(500),
      res.status,
      "bad_response",
      "The response body was not the expected {data} envelope.",
    );
  }
  return (body as Envelope<T>).data;
}

/** Plan entitlements for the signed-in user's org — `GET /v1/org/entitlements` (identity context). */
export interface Entitlements {
  plan: string;
  /** Feature keys the plan permits (the ceiling). */
  allowed: string[];
  /** Feature key → activated flag. */
  enabled: Record<string, boolean>;
  /**
   * Provenance for each **disabled** feature: who turned it off, and whether *this caller* may turn
   * it back on. Keys present only for features that are off AND attributed — one disabled before
   * attribution existed is absent, and deliberately unlocked.
   *
   * `locked` is computed per request server-side, because it is a fact about the reader rather than
   * the feature: an owner and an admin looking at the same disabled feature get different answers.
   */
  disabled_by?: Record<
    string,
    { by_user?: string; by_owner: boolean; at?: number; locked: boolean }
  >;
  /**
   * Page/tab visibility by href (plus `page:` pseudo-keys). Absent key ⇒ visible, so only pages
   * someone has actually hidden appear here.
   */
  pages?: Record<string, boolean>;
  /** Who hid each page, and whether this caller may show it again. */
  pages_disabled_by?: Record<
    string,
    { by_user?: string; by_owner: boolean; at?: number; locked: boolean }
  >;
  version: number;
  /**
   * The org's tracking mode — `"project"` (default) | `"machine"` | `"both"` (MANAGED-AGENT.md §4).
   * Rides here rather than `GET /v1/org` so the gate reads it from the store it already hydrates.
   * Optional/absent ⇒ `project` (see `trackingModeOf`), so this is safe before the backend populates it.
   */
  tracking_mode?: string;
}

export function getEntitlements(): Promise<Entitlements> {
  return apiFetch<Entitlements>("/v1/org/entitlements");
}

/**
 * Flip one feature's owner-activation flag — `PATCH /v1/org/entitlements` (identity). Layer 2 of the
 * gate; the server enforces `enabled ⊆ allowed`, so enabling a key the plan doesn't include is
 * rejected. Returns the full, updated entitlements (both layers) so callers re-sync to server truth.
 */
export function toggleFeature(
  key: string,
  enabled: boolean,
  /**
   * `"page"` targets the page-visibility layer instead of the plan-feature layer. Omitted ⇒
   * `"feature"`, matching the server's default, so every existing call site is unaffected.
   */
  scope?: "feature" | "page",
): Promise<Entitlements> {
  return apiFetch<Entitlements>("/v1/org/entitlements", {
    method: "PATCH",
    body: JSON.stringify({ key, enabled, scope }),
  });
}

// ── Invite signup (public — the invitee has no account yet) ──────────────────────────────────────
// Both calls run logged-out: `apiFetch` only attaches a token when one exists, so no auth header is
// sent, which is exactly what these public routes expect.

/** What the signup page renders — `GET /v1/invites/{invite_id}` (identity). No secrets returned. */
export interface InvitePreview {
  org_name: string;
  /** The address the invite was issued to; the invitee cannot change it. */
  email: string;
  role_name: string;
  role_id: string;
  /** `pending` (usable) · `expired` · `accepted` · `locked`. */
  status: "pending" | "expired" | "accepted" | "locked" | string;
  /** Epoch seconds. */
  expires_at: number;
}

/** The three values the accept-link carries. */
export interface InviteLinkParams {
  tenantId: string;
  inviteId: string;
  token: string;
}

/** Preview an invite so the page can render before the invitee submits. 404 = bad/unknown link. */
export function lookupInvite(p: InviteLinkParams): Promise<InvitePreview> {
  const q = new URLSearchParams({ tenant_id: p.tenantId, token: p.token });
  return apiFetch<InvitePreview>(
    `/v1/invites/${encodeURIComponent(p.inviteId)}?${q.toString()}`,
  );
}

/** What the invitee submits — `POST /v1/invites/accept` (identity). Provisions the Cognito login. */
export interface AcceptInviteBody {
  tenant_id: string;
  invite_id: string;
  token: string;
  /** The code from the invite email (attempt-locked server-side). */
  otp: string;
  full_name: string;
  password: string;
  job_title?: string;
  phone?: string;
  location?: string;
  /** `YYYY-MM-DD`, and `on-site` | `hybrid` | `remote`. Collected on the accept form so a new
   *  joiner's record is complete on day one; validated by `identity::shared::profile`. */
  date_of_birth?: string;
  work_mode?: string;
}

export interface AcceptInviteResult {
  user_id: string;
  emp_id: string;
  email: string;
  role_id: string;
}

export function acceptInvite(body: AcceptInviteBody): Promise<AcceptInviteResult> {
  return apiFetch<AcceptInviteResult>("/v1/invites/accept", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Self-serve org signup — `POST /v1/org/create` (identity, public). Provisions the tenant + the
 * owner's Cognito login (permanent password), so the caller can sign in immediately after. */
export interface CreateOrgBody {
  org: {
    name: string;
    slug: string;
    industry?: string;
    size?: string;
    website?: string;
    timezone?: string;
    country?: string;
    currency?: string;
    /**
     * Employee-id prefix, e.g. `INF` → `INF-0001`. **Required** — the server validates it and
     * claims it globally (`SYS#EMPPFX`). Typed non-optional deliberately: it was optional once, and
     * a second signup path silently omitted it, which the server would have rejected at runtime.
     */
    emp_id_prefix: string;
  };
  owner: {
    email: string;
    password: string;
    full_name: string;
    job_title?: string;
    department?: string;
    location?: string;
    phone?: string;
    /** `YYYY-MM-DD`, and `on-site` | `hybrid` | `remote` — see the invite payload. */
    date_of_birth?: string;
    work_mode?: string;
  };
  /** `free` | `starter` | `enterprise` (the server validates it). */
  plan: string;
}

export interface OrgCreatedResult {
  tenant_id: string;
  slug: string;
  owner_user_id: string;
  plan: string;
  status: string;
}

export function createOrg(body: CreateOrgBody): Promise<OrgCreatedResult> {
  return apiFetch<OrgCreatedResult>("/v1/org/create", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Mirror of the server's `slugify` (`identity::features::create_org::dto`).
 *
 * It lives beside `createOrg` because it is part of the same contract: the server re-slugifies
 * whatever slug we send, so if this drifts, the workspace URL a user was shown during sign-up is
 * silently not the one they get. Keep the two in step.
 */
export function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Longest employee-id prefix the server stores (`EMP_PREFIX_MAX`). */
export const EMP_PREFIX_MAX = 8;

/**
 * Mirror of the server's `normalize_emp_prefix` (`identity::features::create_org::dto`).
 *
 * Beside `slugify` and for the same reason: the server re-normalizes whatever we send, so drift
 * means the prefix a user picked at sign-up is not the one their employee ids get. Uppercase and
 * alphanumeric-only, because the id renders as `INF-0004` — a prefix carrying its own `-` would
 * produce `IN-F-0004`, which no longer splits back into prefix and sequence.
 */
export function normalizeEmpPrefix(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, EMP_PREFIX_MAX);
}

/**
 * Suggested employee-id prefixes for an org name, best first — the mirror of the server's
 * `emp_prefix_candidates`.
 *
 * Deterministic rather than AI-generated: turning "Infiniqon" into `INF` is string manipulation, and
 * doing it locally means suggestions appear as the user types, with no request, no cost, and no
 * pre-auth endpoint to abuse. **Uniqueness is not decided here** — the server holds a global claim
 * (`SYS#EMPPFX`) and rejects a taken prefix at create time, exactly as it already does for slugs.
 */
export function empPrefixCandidates(name: string): string[] {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  if (words.length === 0) return [];
  const first = words[0];
  const raw = [
    normalizeEmpPrefix(first.slice(0, 3)),
    // Initials — what actually fits multi-word names ("Lumenforge Studios" → LS).
    normalizeEmpPrefix(words.map((w) => w[0]).join("")),
    normalizeEmpPrefix(first.slice(0, 4)),
    normalizeEmpPrefix(first),
  ];
  return raw.filter((p, i) => p.length > 0 && raw.indexOf(p) === i);
}
