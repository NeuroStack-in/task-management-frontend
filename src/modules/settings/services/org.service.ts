/**
 * Organization meta + ownership — the real backend (`identity` context, LLD §2 / §16).
 *
 * Five deployed routes that nothing consumed until now:
 *
 * - `PATCH /v1/org` — partial update of the org's meta (`name`, `timezone`, `website`,
 *   `emp_id_prefix`) and/or one onboarding-wizard step mark. Gated by `Permission::OrgSettingsManage`
 *   (Owner bypasses the bit). Optimistically locked on `version`.
 * - `POST /v1/org/transfer-ownership` — hand `role-owner` to another **active** member.
 * - `POST /v1/org/close` — start the 30-day close grace (`status=closing`, `purge_after`).
 * - `POST /v1/org/reopen` — cancel the grace, back to `active`.
 * - `POST /v1/org/export` — record an export job.
 *
 * ## ⚠️ There is no `GET /v1/org` — the org's meta can only be WRITTEN, never read
 *
 * The identity context exposes `PATCH /v1/org` but no read counterpart (`/v1/org/entitlements` and
 * `/v1/org/rules` are different documents and carry none of `name` / `timezone` / `website` /
 * `emp_id_prefix` / `slug` / `version`). The **only** way this app can ever learn the current values
 * is the `OrgView` a successful `PATCH` returns.
 *
 * Consequences, all of them deliberate — not bugs:
 *  - the Organization settings form **cannot** prefill; it starts blank and says so.
 *  - `version` is unknown before the first save, so the first `PATCH` omits it (the server then
 *    accepts the current version); subsequent saves send the `version` from the last `OrgView` and a
 *    concurrent edit surfaces as a `409 version_mismatch`.
 *  - the workspace **slug** — which `confirm` must equal for every irreversible ownership action —
 *    is unknown to the client. So we never pre-fill or client-validate it: we send exactly what the
 *    user typed and let the server compare (`ownership::data::confirm_slug`).
 *  - the org's `status` (`active` | `closing`) is likewise unknown on load, so the close/reopen card
 *    only reflects a transition this session performed.
 *
 * Wiring a `GET /v1/org` server-side would close all four gaps at once.
 *
 * ## Permission gates differ between the two groups
 *
 * `PATCH /v1/org` checks the **permission bit** `org:settings` (`OrgSettingsManage`). The four
 * ownership routes check the **`is_owner` flag on the token**, not a bit — `require_owner()` in
 * `identity::features::ownership`. An admin with every permission bit still gets `403` on them.
 */
import { apiFetch } from "@/lib/api";

// ── PATCH /v1/org ────────────────────────────────────────────────────────────────────────────

/** One of the four onboarding-wizard steps (`update_org::dto::ONBOARDING_STEPS`). */
export type OnboardingStep =
  | "org_setup"
  | "invite_team"
  | "tracking"
  | "personalize";

/** `update_org::dto::ONBOARDING_STATES`. */
export type OnboardingState = "pending" | "done" | "skipped";

/** Mirrors `identity::features::update_org::dto::UpdateOrgRequest` — every field optional. */
export interface ApiUpdateOrgRequest {
  name?: string;
  timezone?: string;
  website?: string;
  /** 1–8 alphanumeric chars; applies to **future** employee ids only. */
  emp_id_prefix?: string;
  /** Optimistic-lock guard. Omit to accept whatever the server currently has. */
  version?: number;
  onboarding?: { step: OnboardingStep; state: OnboardingState };
}

/** Mirrors `identity::features::update_org::dto::OrgView` — the org *after* the update. */
export interface ApiOrgView {
  name: string;
  /** The workspace slug — what `confirm` must match on the ownership routes. */
  slug: string;
  plan: string;
  /** `active` | `closing`. */
  status: string;
  timezone?: string;
  website?: string;
  emp_id_prefix?: string;
  version: number;
}

/**
 * `PATCH /v1/org`. The server rejects an empty patch (`400 "nothing to update"`), so callers must
 * send at least one meta field or an `onboarding` mark.
 */
export function updateOrg(body: ApiUpdateOrgRequest): Promise<ApiOrgView> {
  return apiFetch<ApiOrgView>("/v1/org", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/**
 * Mark one onboarding-wizard step. Same route — the onboarding document is written alongside the
 * meta item, and the returned `OrgView` is still the meta (unchanged when no meta field is sent).
 */
export function markOnboardingStep(
  step: OnboardingStep,
  state: OnboardingState,
): Promise<ApiOrgView> {
  return updateOrg({ onboarding: { step, state } });
}

// ── Ownership & closure (owner-only, `is_owner`) ─────────────────────────────────────────────

/** Mirrors `identity::features::ownership::TransferRequest`. */
export interface ApiTransferRequest {
  new_owner_id: string;
  /**
   * The **transferor's** exit choice: a role id to step down into, or omitted/undefined to leave the
   * organization entirely (the account is deactivated and Cognito login disabled).
   */
  take_role?: string;
  /** The workspace slug, exactly as the user typed it. The server compares; we never guess it. */
  confirm: string;
}

/** Mirrors `identity::features::ownership::TransferResult`. */
export interface ApiTransferResult {
  new_owner_id: string;
  /** `true` when no `take_role` was given — the previous owner was deactivated and must sign out. */
  transferor_left: boolean;
}

/** Mirrors `identity::features::ownership::OrgStatus`. */
export interface ApiOrgStatus {
  /** `closing` after close, `active` after reopen. */
  status: string;
  /** Epoch **seconds** when the purge runs (now + 30 days). Only present while closing. */
  purge_after?: number;
}

/** Mirrors `identity::features::ownership::ExportAccepted`. */
export interface ApiExportAccepted {
  job_id: string;
  /** `accepted` — the job is recorded; the archive walk is a server-side seam. */
  status: string;
}

/** `POST /v1/org/transfer-ownership` — irreversible. 403 = not the owner. */
export function transferOwnership(
  body: ApiTransferRequest,
): Promise<ApiTransferResult> {
  return apiFetch<ApiTransferResult>("/v1/org/transfer-ownership", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * `POST /v1/org/close` — starts a **30-day grace**, it does not delete immediately: the org goes to
 * `status=closing` with `purge_after = now + 30d`, and `reopenOrg()` can still undo it.
 */
export function closeOrg(confirm: string): Promise<ApiOrgStatus> {
  return apiFetch<ApiOrgStatus>("/v1/org/close", {
    method: "POST",
    body: JSON.stringify({ confirm }),
  });
}

/** `POST /v1/org/reopen` — cancels the grace. Takes no body and requires no confirmation. */
export function reopenOrg(): Promise<ApiOrgStatus> {
  return apiFetch<ApiOrgStatus>("/v1/org/reopen", { method: "POST" });
}

/**
 * `POST /v1/org/export` — records an export job and returns its id.
 *
 * **The archive itself is a server-side seam** (`ownership::data::export` logs
 * `"EXPORT SEAM: job recorded; SQS-chained export not wired"`). There is no job-status route and no
 * download link, so the UI can only report that the request was accepted — never offer a file.
 */
export function requestOrgExport(): Promise<ApiExportAccepted> {
  return apiFetch<ApiExportAccepted>("/v1/org/export", { method: "POST" });
}
