/**
 * Organization meta + lifecycle — the real backend (`identity` context, LLD §14).
 *
 * These are the owner/admin-authed org routes:
 *   - `PATCH /v1/org` edits the four editable meta fields (name, timezone, website, emp_id_prefix)
 *     under an optimistic lock (`version`). **There is deliberately no `GET /v1/org`** — org meta is
 *     write-only from the app today (a read endpoint hasn't landed), so callers can only observe the
 *     server's state via the `OrgView` a successful write returns. Reflect that; don't invent it.
 *   - The lifecycle routes (`transfer-ownership`, `close`, `reopen`, `export`) are **owner-only**
 *     (403 otherwise) and each requires the caller to re-type the workspace **slug** as `confirm`.
 */
import { apiFetch } from "@/lib/api";

/** What `PATCH /v1/org` returns — the org's current server-side meta. `version` drives the next save. */
export interface OrgView {
  name: string;
  slug: string;
  plan: string;
  status: string;
  timezone?: string;
  website?: string;
  emp_id_prefix?: string;
  version: number;
}

/**
 * Body for `PATCH /v1/org`. At least one meta field must be present — an empty body 400s
 * ("nothing to update"). `version` is the optimistic-lock token from the last `OrgView`; omit it on
 * the very first save (before any `OrgView` is known).
 */
export interface UpdateOrgRequest {
  name?: string;
  timezone?: string;
  website?: string;
  emp_id_prefix?: string;
  version?: number;
  /** Optionally mark one onboarding-wizard step (LLD §2): step ∈ org_setup|invite_team|tracking|
   * personalize, state ∈ pending|done|skipped. A pure onboarding update needs no meta field. */
  onboarding?: { step: string; state: string };
}

export function updateOrg(body: UpdateOrgRequest): Promise<OrgView> {
  return apiFetch<OrgView>("/v1/org", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/**
 * Body for `POST /v1/org/transfer-ownership` (owner-only). `confirm` is the typed workspace slug;
 * `take_role` is the role the departing owner keeps (null/omit ⇒ server default, typically Admin).
 */
export interface TransferOwnershipRequest {
  new_owner_id: string;
  take_role?: string | null;
  /** The typed workspace **slug** — the server validates it. */
  confirm: string;
}

export interface TransferOwnershipResult {
  new_owner_id: string;
  /** True when the former owner no longer belongs to the org after the transfer. */
  transferor_left: boolean;
}

export function transferOwnership(
  body: TransferOwnershipRequest,
): Promise<TransferOwnershipResult> {
  return apiFetch<TransferOwnershipResult>("/v1/org/transfer-ownership", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** `POST /v1/org/close` (owner-only). Returns the new status and an optional purge deadline. */
export interface CloseOrgResult {
  status: string;
  /** Epoch (seconds) after which the closed org's data is permanently purged, if applicable. */
  purge_after?: number;
}

export function closeOrg(confirm: string): Promise<CloseOrgResult> {
  return apiFetch<CloseOrgResult>("/v1/org/close", {
    method: "POST",
    body: JSON.stringify({ confirm }),
  });
}

/** `POST /v1/org/reopen` (owner-only) — reverses a close before the purge deadline. */
export interface ReopenOrgResult {
  status: string;
}

export function reopenOrg(confirm: string): Promise<ReopenOrgResult> {
  return apiFetch<ReopenOrgResult>("/v1/org/reopen", {
    method: "POST",
    body: JSON.stringify({ confirm }),
  });
}

/** `POST /v1/org/export` (owner-only) — enqueues an async export job. */
export interface ExportOrgResult {
  job_id: string;
  status: string;
}

export function exportOrg(confirm: string): Promise<ExportOrgResult> {
  return apiFetch<ExportOrgResult>("/v1/org/export", {
    method: "POST",
    body: JSON.stringify({ confirm }),
  });
}
