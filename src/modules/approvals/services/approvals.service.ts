/**
 * Approvals — the real backend (`leave-approvals` context, LLD §8/§9).
 *
 * The manager side of the leave flow the `leave` module drives from the employee side. **Leave-only:**
 * WorkPulse doesn't approve tracked time (timesheets are never signed off), so this is exactly the
 * time-off queue. Gated server-side by `leave:approve` (org-scoped — there is no team-scoped approval
 * queue; an approver sees the whole org's pending requests).
 *
 *   GET  /v1/approvals?status        the queue for one status (GSI2 inbox)
 *   POST /v1/approvals/decide        approve | reject one
 *   POST /v1/approvals/bulk-decide   decide many
 *
 * A decision needs BOTH `user_id` and `request_id`: the request lives on the requester's partition,
 * so the id alone doesn't locate it.
 */
import { apiFetch } from "@/lib/api";
import type { ApiLeaveAttachment } from "@/modules/leave/services/leave.service";

/** One queued request (`approvals::dto::ApprovalRow`). */
export interface ApiApprovalRow {
  user_id: string;
  request_id: string;
  type_id: string;
  from: string;
  to: string;
  /** Fractional: a 2-hour permission is `0.25`. */
  days: number;
  /** `full_day | permission`. */
  kind?: string;
  /** Minutes of permission; `0`/absent for a full day. */
  permission_minutes?: number;
  /** `HH:MM` window, present only for a permission. */
  from_time?: string;
  to_time?: string;
  /** `pending | approved | rejected | cancelled`. */
  status: string;
  reason?: string;
  /** Epoch ms. */
  created_at?: number;
  /**
   * Documents the requester attached. Metadata only — the approver fetches a short-lived URL per
   * file via `getLeaveDocumentUrl`, so nothing here is a live link that could be shared on.
   */
  attachments?: ApiLeaveAttachment[];
}

interface QueueResponse {
  approvals: ApiApprovalRow[];
  cursor?: string;
}

/** The queue for one status (default `pending`). One GSI2 query per status. */
export function getQueue(status: string): Promise<ApiApprovalRow[]> {
  const q = new URLSearchParams({ status });
  return apiFetch<QueueResponse>(`/v1/approvals?${q}`).then((r) => r.approvals);
}

export interface DecideInput {
  user_id: string;
  request_id: string;
  /** `approve` | `reject`. */
  decision: "approve" | "reject";
  reason?: string;
}

interface DecideResult {
  user_id: string;
  request_id: string;
  status: string;
}

export function decide(input: DecideInput): Promise<DecideResult> {
  return apiFetch<DecideResult>("/v1/approvals/decide", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface BulkItemResult {
  request_id: string;
  ok: boolean;
  status?: string;
  error?: string;
}

export function bulkDecide(decisions: DecideInput[]): Promise<BulkItemResult[]> {
  return apiFetch<{ results: BulkItemResult[] }>("/v1/approvals/bulk-decide", {
    method: "POST",
    body: JSON.stringify({ decisions }),
  }).then((r) => r.results);
}
