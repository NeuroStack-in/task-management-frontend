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

/** One org-configured leave type (`leave_types::dto::LeaveType`). */
export interface ApiLeaveType {
  type_id: string;
  name: string;
  /** Days per year; `null`/absent = no fixed allowance (e.g. unpaid). */
  allowance?: number | null;
  paid?: boolean;
}

interface TypesResponse {
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
  return apiFetch<TypesResponse>("/v1/leave/types").then((r) => r.types);
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
