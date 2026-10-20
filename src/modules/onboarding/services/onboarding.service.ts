/**
 * Onboarding — a signed-in user who has no org yet asks for one.
 *
 * A brand-new account (e.g. "Continue with Google") is admitted by the backend with no organization;
 * the onboarding form files an org request (`POST /v1/org/requests`) that WorkPulse staff approve,
 * and the approval builds the org and makes the applicant its Owner (`identity::org_requests`).
 */
import { apiFetch } from "@/lib/api";

export interface ProvisionOrgInput {
  org_name: string;
  owner_name?: string;
  timezone?: string;
  industry?: string;
  size?: string;
  /**
   * The rest of what the signup wizard collects.
   *
   * Mirrors the server's `ProvisionOrgRequest` / `SubmitRequest`, which store these on the request
   * and replay them into `bootstrap_org` at approval. They exist so the wizard's region and profile
   * steps land somewhere real — collecting four steps and posting three fields would discard most
   * of what the applicant typed.
   */
  website?: string;
  country?: string;
  /** Currency **code**, not the picker's display string. */
  currency?: string;
  job_title?: string;
  /** `YYYY-MM-DD`, and `on-site` | `hybrid` | `remote` — the profile facts the signup wizard
   *  now requires, so a new account starts complete rather than showing "—" until someone
   *  goes looking for Settings. Validated server-side by `identity::shared::profile`. */
  date_of_birth?: string;
  work_mode?: string;

  department?: string;
  location?: string;
  phone?: string;
  /** The "authorised to monitor" tick — stored on the request and carried onto the org (WP-128). */
  monitoring_consent?: boolean;
  /** The Terms/Privacy agreement — stored on the request as `terms_accepted_at` (UX audit ONB-08). */
  terms_accepted?: boolean;
}

/**
 * The caller's org request, once WorkPulse staff review is in play.
 *
 * `status` is the whole state machine the onboarding flow routes on: `pending` parks them on a
 * waiting screen, `approved` means the org exists (their token still needs refreshing before it is
 * visible), `rejected` shows `reason` and lets them reapply.
 */
export interface MyOrgRequest {
  id: string;
  status: "pending" | "approved" | "rejected";
  org_name: string;
  requested_at: number;
  decided_at?: number;
  /** Why it was refused — shown verbatim, so it has to be actionable. */
  reason?: string;
}

/**
 * `POST /v1/org/requests` — ask for an organization.
 *
 * Creates **nothing** but the request: no tenant, no slug claim, no seat. WorkPulse staff review it
 * and the org is built only on approval. This replaced a direct call to `provisionMyOrg`, which
 * created the org outright.
 */
export function requestOrg(input: ProvisionOrgInput): Promise<{ id: string; status: string }> {
  return apiFetch<{ id: string; status: string }>("/v1/org/requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * `GET /v1/org/requests/mine` — the caller's own request, or `null` when they have not asked yet.
 *
 * `null` is a normal state, not an error: a fresh account that has never submitted gets it, and the
 * onboarding flow routes on exactly that difference.
 */
export function getMyOrgRequest(): Promise<MyOrgRequest | null> {
  return apiFetch<MyOrgRequest | null>("/v1/org/requests/mine");
}

/**
 * `POST /v1/org/requests/mine/withdraw` — take back a pending request so it can be corrected and
 * sent again (UX audit ONB-02). `409 approval_in_progress` while an operator is approving it.
 */
export async function withdrawMyOrgRequest(): Promise<void> {
  await apiFetch("/v1/org/requests/mine/withdraw", { method: "POST" });
}

/** An invite waiting for the signed-in person's own address (`GET /v1/me/invites`, ONB-03). */
export interface MyInvite {
  tenant_id: string;
  invite_id: string;
  org_name: string;
  /** Epoch seconds. */
  expires_at: number;
  /** Five wrong codes locked it; sending it again unlocks it with fresh codes. */
  locked: boolean;
}

/**
 * `GET /v1/me/invites` — invites waiting for this account's address. For someone who signed in
 * with Google before opening their invite email: they have no organisation yet, and without this
 * the screen offered to create one (UX audit ONB-03).
 */
export function getMyInvites(): Promise<MyInvite[]> {
  return apiFetch<{ invites: MyInvite[] }>("/v1/me/invites").then((r) => r.invites);
}

/**
 * `POST /v1/me/invites/resend` — email that invite again, to this account's own address, with a
 * fresh link and code. `409 resent_recently` within a minute of the last send.
 */
export function resendMyInvite(
  tenantId: string,
  inviteId: string,
): Promise<{ sent_to: string; expires_at: number }> {
  return apiFetch("/v1/me/invites/resend", {
    method: "POST",
    body: JSON.stringify({ tenant_id: tenantId, invite_id: inviteId }),
  });
}
