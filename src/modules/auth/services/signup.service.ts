/**
 * Org signup + invite acceptance — the real backend (`identity` context).
 *
 * These are the backend's three **public** routes: they sit outside the JWT authorizer, so they are
 * the only endpoints callable before a session exists. `apiFetch` resolves a null token when nobody
 * is signed in and simply omits the auth header, so it works unchanged here.
 *
 * - `POST /v1/org/create` — the signup commit. Creates the tenant, the Cognito owner, the seeded
 *   system roles and entitlements, in one call. Guarded by a global slug claim, so a taken workspace
 *   slug comes back as a 409.
 * - `GET /v1/invites/{invite_id}` — public preview of an invite, keyed by `tenant_id` + `token` from
 *   the emailed link. Returns no OTP and no hashes; it exists so the accept page can render.
 * - `POST /v1/invites/accept` — redeems the invite. Needs the link's `token` **and** the separately
 *   emailed `otp`; the invite locks after 5 failed attempts and expires after 7 days.
 *
 * Note what the invitee may **not** set: email, role, and emp_id are fixed by the admin at invite
 * time. Don't add inputs for them — the server ignores them and it would imply otherwise.
 */
import { apiFetch } from "@/lib/api";

/* ── Org signup ── */

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
    emp_id_prefix?: string;
  };
  owner: {
    email: string;
    password: string;
    full_name: string;
    job_title?: string;
    department?: string;
    location?: string;
    phone?: string;
  };
  /** `free` | `starter` | `enterprise`. */
  plan: string;
}

/** Mirrors `identity::features::create_org::dto::OrgCreated`. */
export interface OrgCreated {
  tenant_id: string;
  slug: string;
  owner_user_id: string;
  plan: string;
  status: string;
}

export function createOrg(body: CreateOrgBody): Promise<OrgCreated> {
  return apiFetch<OrgCreated>("/v1/org/create", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Mirror of the server's `slugify` (`create_org::dto`). Keep these in step — the server re-slugifies
 * what we send, so a mismatch means the workspace URL silently differs from the one we previewed.
 */
export function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/* ── Invite acceptance ── */

/** Mirrors `identity::features::lookup_invite::dto::InvitePreview`. */
export interface InvitePreview {
  org_name: string;
  /** Fixed at invite time — display it, never ask for it. */
  email: string;
  role_name: string;
  role_id: string;
  /** `pending` (usable) · `expired` · `accepted` · `locked`. */
  status: string;
  /** Epoch **seconds**. */
  expires_at: number;
}

export function lookupInvite(params: {
  inviteId: string;
  tenantId: string;
  token: string;
}): Promise<InvitePreview> {
  const q = new URLSearchParams({
    tenant_id: params.tenantId,
    token: params.token,
  });
  return apiFetch<InvitePreview>(
    `/v1/invites/${encodeURIComponent(params.inviteId)}?${q}`,
  );
}

export interface AcceptInviteBody {
  tenant_id: string;
  invite_id: string;
  token: string;
  otp: string;
  full_name: string;
  password: string;
  job_title?: string;
  phone?: string;
  location?: string;
}

/** Mirrors `identity::features::accept_invite::dto::AcceptResult`. */
export interface AcceptResult {
  user_id: string;
  emp_id: string;
  email: string;
  role_id: string;
}

export function acceptInvite(body: AcceptInviteBody): Promise<AcceptResult> {
  return apiFetch<AcceptResult>("/v1/invites/accept", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
