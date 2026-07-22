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
 * One org-configured leave type (`shared::leave::LeaveType`). Allowances are uniform across all
 * employees; the grant is up-front annual, whole days, no carry-over (LLD §8).
 */
export interface ApiLeaveType {
  type_id: string;
  name: string;
  paid: boolean;
  /** Days per year; `0` = no fixed allowance (e.g. unpaid). Server caps at 366. */
  annual_allowance: number;
  /**
   * Soft-delete flag: archiving a type is `PUT` with `active: false` (the catalog is
   * replace-whole, there is no per-type DELETE). Inactive types can't be requested and
   * aren't seeded into balances, but keep labelling old requests.
   */
  active: boolean;
}

/** `leave_types::dto::TypesResponse` — the catalog plus its optimistic-lock version. */
export interface ApiTypeCatalog {
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

export function getTypes(): Promise<ApiLeaveType[]> {
  return apiFetch<ApiTypeCatalog>("/v1/leave/types").then((r) => r.types);
}

/** `GET /v1/leave/types` with the `version` kept — the admin surface needs it for the PUT lock. */
export function getTypeCatalog(): Promise<ApiTypeCatalog> {
  return apiFetch<ApiTypeCatalog>("/v1/leave/types");
}

/**
 * `PUT /v1/leave/types` — **replace** the whole type catalog (`leave_types::dto::SetTypesRequest`).
 * Needs `leave:manage`. Version-locked: send the version from the last read; a concurrent edit
 * surfaces as `409 version_conflict`. Server validation: non-empty list, unique non-empty
 * `type_id`/`name`, `annual_allowance <= 366`. Archive/unarchive a type by flipping `active`.
 */
export function setTypes(
  types: ApiLeaveType[],
  version: number,
): Promise<ApiTypeCatalog> {
  return apiFetch<ApiTypeCatalog>("/v1/leave/types", {
    method: "PUT",
    body: JSON.stringify({ types, version }),
  });
}

/**
 * `POST /v1/leave/types/restore` — reset the catalog to the **platform defaults**
 * (Annual 20 · Sick 10 · Casual 7 · Unpaid), discarding org customizations. Needs `leave:manage`.
 */
export function restoreDefaultTypes(): Promise<ApiTypeCatalog> {
  return apiFetch<ApiTypeCatalog>("/v1/leave/types/restore", { method: "POST" });
}

/** `seed_balances::SeedResult`. */
export interface ApiSeedResult {
  year: string;
  seeded_users: number;
}

/**
 * `POST /v1/leave/seed-balances` — materialize the org's leave balances for a year (default: the
 * current year): one balance per employee per **active** type at its annual allowance. Needs
 * `leave:manage`. Idempotent — an existing balance (and its `used` days) is left untouched, so
 * re-running is safe. In the LLD this runs automatically on join / Jan-1 rollover; that trigger
 * infra isn't built yet, so it's exposed as this admin action (balances also lazy-seed on first use).
 */
export function seedBalances(year?: string): Promise<ApiSeedResult> {
  return apiFetch<ApiSeedResult>("/v1/leave/seed-balances", {
    method: "POST",
    body: JSON.stringify(year ? { year } : {}),
  });
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
