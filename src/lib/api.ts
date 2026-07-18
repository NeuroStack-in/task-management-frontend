/**
 * The real backend HTTP client.
 *
 * This is the seam the mock services are migrating onto: `component → module service → apiFetch`.
 * Every call carries a **fresh** Cognito id token (see `lib/cognito.getIdToken`) — the API Gateway
 * JWT authorizer verifies it and the Lambda reads the RBAC claims from it. A 401 means the session
 * is gone/expired; a 403 means the server denied the permission (the server is the real gate).
 */
import { getIdToken } from "@/lib/cognito";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
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
    res = await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
    if (res.ok || !retryable || !TRANSIENT.has(res.status) || attempt >= MAX_RETRIES) {
      break;
    }
    // Exponential backoff with a little spread so parallel callers don't retry in lockstep.
    await new Promise((r) => setTimeout(r, 200 * 2 ** attempt + Math.random() * 100));
  }

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } })?.error;
    throw new ApiError(
      err?.message ?? `Request failed (${res.status}).`,
      res.status,
      err?.code,
    );
  }
  return (body as Envelope<T>).data;
}

/** Plan entitlements for the signed-in user's org — `GET /v1/org/entitlements` (identity context). */
export interface Entitlements {
  plan: string;
  /** Feature keys the plan permits (the ceiling). */
  allowed: string[];
  /** Feature key → owner-activated flag. */
  enabled: Record<string, boolean>;
  version: number;
}

export function getEntitlements(): Promise<Entitlements> {
  return apiFetch<Entitlements>("/v1/org/entitlements");
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
