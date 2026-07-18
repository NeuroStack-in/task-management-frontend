/**
 * Leave — the real backend (`leave-approvals` context, LLD §8).
 *
 * `component → module service → lib/api → HTTP`. The mock hardcoded four leave types with fixed
 * allowances (`vacation/sick/personal/unpaid`, 20/10/5/null). The server's types are **org-configured**
 * (`/v1/leave/types`) and balances are **computed server-side** (`/v1/me/leave/balances`), so this
 * module takes the type catalog and the balances from the server rather than inventing them.
 *
 * Status values are the server's: `pending | approved | cancelled` (the mock's `rejected` isn't a
 * state this backend produces — a manager's rejection is Phase 3). Cancel is a real transition
 * (`pending → cancelled`), not a client-side delete.
 */
import { apiFetch } from "@/lib/api";

/**
 * One org-configured leave type. Mirrors `leave_approvals::shared::leave::LeaveType` exactly —
 * the field is `annual_allowance` (whole days per year, up-front grant, no carry-over), not
 * `allowance`; that only appears on a *balance*.
 */
export interface ApiLeaveType {
  type_id: string;
  name: string;
  paid: boolean;
  annual_allowance: number;
  /** Inactive types stay in the catalog but can't be requested against or seeded. */
  active: boolean;
}

/** `leave_types::dto::TypesResponse`. `version` is the optimistic lock for `PUT /v1/leave/types`. */
export interface ApiLeaveTypesConfig {
  types: ApiLeaveType[];
  version: number;
}

/** A per-type balance (`my_balances::dto::BalanceView`). Computed server-side. */
export interface ApiBalance {
  type_id: string;
  name: string;
  paid: boolean;
  allowance: number;
  used: number;
  remaining: number;
}

interface BalancesResponse {
  year: string;
  balances: ApiBalance[];
}

/** One request (`my_requests::dto::RequestView`). */
export interface ApiLeaveRequest {
  request_id: string;
  type_id: string;
  /** Inclusive `YYYY-MM-DD`. */
  from: string;
  to: string;
  days: number;
  /** `pending | approved | cancelled`. */
  status: string;
  reason?: string;
  /** Epoch ms. */
  created_at?: number;
}

/** `GET /v1/leave/types` — readable by any member (no permission gate on the list handler). */
export function getTypesConfig(): Promise<ApiLeaveTypesConfig> {
  return apiFetch<ApiLeaveTypesConfig>("/v1/leave/types");
}

export function getTypes(): Promise<ApiLeaveType[]> {
  return getTypesConfig().then((r) => r.types);
}

export function getBalances(): Promise<BalancesResponse> {
  return apiFetch<BalancesResponse>("/v1/me/leave/balances");
}

/**
 * The caller's requests, newest-first.
 *
 * The endpoint answers with a **bare array** in `data` (unlike `{projects}`, `{balances}`, …) — the
 * one list-read on this context that didn't get wrapped. Consumed as-is here; worth wrapping
 * server-side the way `/v1/roles` was, but that's a backend change, not a wiring one.
 */
export function getRequests(): Promise<ApiLeaveRequest[]> {
  return apiFetch<ApiLeaveRequest[]>("/v1/me/leave/requests");
}

export interface NewLeaveRequest {
  type_id: string;
  /** Inclusive `YYYY-MM-DD`. */
  from: string;
  to: string;
  reason?: string;
}

export function createRequest(req: NewLeaveRequest): Promise<ApiLeaveRequest> {
  return apiFetch<ApiLeaveRequest>("/v1/me/leave/requests", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

/** `POST /v1/me/leave/requests/{id}/cancel` — `pending → cancelled` (or credits an approved one). */
export function cancelRequest(id: string): Promise<unknown> {
  return apiFetch(`/v1/me/leave/requests/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
  });
}

// ── Leave administration (LLD §8) ─────────────────────────────────────────────────────────────
//
// Reading the catalog is open to any member; every write below requires the backend's `leave:manage`
// bit. The frontend permission catalog has no `leave:manage` id, so callers gate on
// `settings:manage` — the org-configuration bit, which is what this is. The server is the real gate.

/**
 * `PUT /v1/leave/types` — replace the **whole** catalog. This is not a patch: whatever is sent
 * becomes the catalog, so callers must send every type they want to keep.
 *
 * `version` is an optimistic lock. Send the `version` from the read that populated the editor; if
 * the stored config moved on in the meantime the server answers **409 `version_conflict`** and
 * writes nothing. Server-side validation: at least one type, non-empty unique `type_id`s, non-empty
 * names, and `annual_allowance <= 366` (all 400).
 *
 * Deleting a type is expressed by omitting it (or clearing `active`); the server keeps no tombstone
 * and does **not** reconcile already-materialized balances for a removed type.
 */
export function setTypes(
  types: ApiLeaveType[],
  version: number,
): Promise<ApiLeaveTypesConfig> {
  return apiFetch<ApiLeaveTypesConfig>("/v1/leave/types", {
    method: "PUT",
    body: JSON.stringify({ types, version }),
  });
}

/**
 * `POST /v1/leave/types/restore` — reset the catalog to the platform defaults (annual/sick/casual/
 * unpaid). The server reads the current version itself, so this can't 409 on a stale editor.
 */
export function restoreTypes(): Promise<ApiLeaveTypesConfig> {
  return apiFetch<ApiLeaveTypesConfig>("/v1/leave/types/restore", {
    method: "POST",
  });
}

/** `seed_balances::SeedResult`. */
export interface ApiSeedResult {
  year: string;
  seeded_users: number;
}

/**
 * `POST /v1/leave/seed-balances` — materialize every active employee's balances for a year.
 *
 * An **admin/maintenance** action, not a normal user path. In the LLD this is meant to run from
 * EventBridge (on employee-joined, and a Jan-1 rollover cron); that trigger infra isn't built, so
 * the logic is exposed over HTTP. It is **idempotent** — an existing balance keeps its `used` — and
 * `my_balances`/`request_leave` also lazy-seed on first use, so this is a backfill, not a
 * prerequisite. A `year` other than `YYYY` is silently ignored and the current year used instead.
 */
export function seedBalances(year?: string): Promise<ApiSeedResult> {
  return apiFetch<ApiSeedResult>("/v1/leave/seed-balances", {
    method: "POST",
    body: JSON.stringify(year ? { year } : {}),
  });
}
