/**
 * The real backend HTTP client.
 *
 * This is the seam the mock services are migrating onto: `component → module service → apiFetch`.
 * Every call carries a **fresh** Cognito id token (see `lib/cognito.getIdToken`) — the API Gateway
 * JWT authorizer verifies it and the Lambda reads the RBAC claims from it. A 401 means the session
 * is gone/expired; a 403 means the server denied the permission (the server is the real gate).
 */
import { getIdToken, sessionStatus } from "@/lib/cognito";
import { apiErrorMessage } from "@/lib/errors";

type SessionListener = () => void;
const sessionListeners = new Set<SessionListener>();

/**
 * Be told when the API refuses a request because the sign-in behind it is gone. The auth store
 * subscribes and signs out, which sends the user to /login. Returns an unsubscribe.
 */
export function onSessionExpired(listener: SessionListener): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

/**
 * A 401 is only "your session is gone" when Cognito agrees. The public invite routes answer 401 for
 * a wrong link too, and a signed-in person opening a stale invite must not be signed out over it — so
 * the session is checked, not assumed. Nothing reacted to a 401 before: the shell kept rendering with
 * every panel failing and /login bounced back to it (QA audit 2026-10-08, WP-011).
 */
async function reportIfSessionGone(): Promise<void> {
  try {
    if ((await sessionStatus()) !== "gone") return;
  } catch {
    return;
  }
  for (const listener of sessionListeners) listener();
}

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

/**
 * How long one attempt may take, response body included. There was **no** limit: a stalled request
 * (captive portal, VPN reconnect, a hung connection) left every page on its spinner forever, with a
 * reload the only way out (QA audit 2026-10-08, WP-370). API Gateway gives up on an integration at
 * 30 s, so nothing legitimate takes longer than this.
 */
export const REQUEST_TIMEOUT_MS = 35_000;

/** What a person reads when a request timed out — retryable, and about the connection. */
export const TIMEOUT_MESSAGE =
  "The server took too long to answer. Check your connection and try again.";

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getIdToken();
  // **No token because the refresh couldn't reach Cognito** is a connection problem, not a signed-out
  // one. The request used to go out unauthenticated, 401, and read "Your session has expired" to
  // someone whose train had just entered a tunnel (QA audit 2026-10-08, WP-391). Only checked when
  // there is no token, so a signed-in request pays nothing; a logged-out caller (an invite page)
  // reads "gone" and proceeds as before.
  if (!token && (await sessionStatus()) === "offline") {
    throw new ApiError(
      apiErrorMessage(0),
      0,
      "network",
      "the session refresh could not reach the sign-in service",
    );
  }
  // Only **idempotent** requests may be retried. Retrying a POST/PATCH on a 503 could double-apply
  // it (the request may have reached the handler before the gateway gave up), so writes never retry
  // — only GET (the default when no method is set).
  const method = (init.method ?? "GET").toUpperCase();
  const retryable = method === "GET";

  let res: Response | null = null;
  let raw = "";
  for (let attempt = 0; ; attempt++) {
    // One controller per attempt: the timeout aborts it, and so does the caller's own signal.
    const ctl = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ctl.abort();
    }, REQUEST_TIMEOUT_MS);
    const callerAbort = () => ctl.abort();
    init.signal?.addEventListener("abort", callerAbort, { once: true });
    if (init.signal?.aborted) ctl.abort();
    try {
      res = await fetch(`${baseUrl()}${path}`, {
        ...init,
        signal: ctl.signal,
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...init.headers,
        },
      });
      // Read as text first so an empty body and an unparseable one stay distinguishable.
      // `res.json()` collapses both to the same failure, which is what made a successful
      // no-content write look broken. Inside the timeout: a body can stall too.
      raw = await res.text();
    } catch (e) {
      if (timedOut) {
        throw new ApiError(
          TIMEOUT_MESSAGE,
          0,
          "timeout",
          `no answer within ${REQUEST_TIMEOUT_MS} ms`,
        );
      }
      // The caller gave up (unmount, superseded read) — theirs to handle, not a network fault.
      if (init.signal?.aborted) throw e;
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
    } finally {
      clearTimeout(timer);
      init.signal?.removeEventListener("abort", callerAbort);
    }
    if (res.ok || !retryable || !TRANSIENT.has(res.status) || attempt >= MAX_RETRIES) {
      break;
    }
    // Exponential backoff with a little spread so parallel callers don't retry in lockstep.
    await new Promise((r) => setTimeout(r, 200 * 2 ** attempt + Math.random() * 100));
  }

  let body: unknown = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = null;
    }
  }

  if (!res.ok) {
    if (res.status === 401) await reportIfSessionGone();
    const err = (body as { error?: { code?: string; message?: string } })?.error;
    // The user-facing sentence is decided once, here — not at each of the ~26 places that show
    // `e.message` in a toast. `Request failed (500).` never reaches a person again.
    throw new ApiError(
      apiErrorMessage(res.status, err?.message, err?.code),
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
 * rejected.
 *
 * **Resolves to nothing on purpose.** The response is the server's *stored* payload, not what `GET`
 * returns — attributed entries in `enabled` / `pages` are objects rather than booleans, and there is
 * no `disabled_by`, `pages_disabled_by` or `tracking_mode` — so it was typed as `Entitlements` and
 * documented as "re-sync to server truth" while reading every toggled key as off (QA audit
 * 2026-10-08, WP-523). Re-read with {@link getEntitlements} to hydrate anything.
 */
export async function toggleFeature(
  key: string,
  enabled: boolean,
  /**
   * `"page"` targets the page-visibility layer instead of the plan-feature layer. Omitted ⇒
   * `"feature"`, matching the server's default, so every existing call site is unaffected.
   */
  scope?: "feature" | "page",
): Promise<void> {
  await apiFetch<unknown>("/v1/org/entitlements", {
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
  /** Who sent the invite (UX audit ONB-05); empty when unknown. Absent from older servers. */
  inviter_name?: string;
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
  /** The "I agree to the Terms and Privacy Policy" tick — recorded as `terms_accepted_at` (ONB-08). */
  terms_accepted?: boolean;
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

/**
 * Mirror of the server's `slugify` (`identity::features::create_org::dto`).
 *
 * Part of the org contract: the server re-slugifies whatever slug it is sent, so if this drifts, a
 * workspace ID shown in the app is silently not the one stored. Keep the two in step.
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
