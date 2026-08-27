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
}

export interface ProvisionOrgResult {
  tenant_id: string;
  slug: string;
  role_id: string;
}

/** `POST /v1/org/provision` — create the caller's organization; they become Owner. */
export function provisionMyOrg(input: ProvisionOrgInput): Promise<ProvisionOrgResult> {
  return apiFetch<ProvisionOrgResult>("/v1/org/provision", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
