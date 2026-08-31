/**
 * Onboarding — self-service org provisioning for a signed-in user who has no org yet.
 *
 * A brand-new account (e.g. "Continue with Google") is admitted by the backend with no organization;
 * the onboarding form calls this to create one and make the caller its Owner. Mirrors the backend
 * `identity::provision_my_org` slice (`POST /v1/org/provision`, authenticated).
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
}

export interface ProvisionOrgResult {
  tenant_id: string;
  slug: string;
  role_id: string;
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
 * `POST /v1/org/provision` — create the caller's organization; they become Owner.
 *
 * **Retained, but no longer the signup path.** Org creation now goes through {@link requestOrg} and
 * staff approval; this is what the server calls on the approval side. Kept here because the shape
 * is the contract both halves share.
 */
export function provisionMyOrg(input: ProvisionOrgInput): Promise<ProvisionOrgResult> {
  return apiFetch<ProvisionOrgResult>("/v1/org/provision", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
