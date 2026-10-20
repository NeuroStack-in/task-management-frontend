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
 *
 * (`POST /v1/approvals/bulk-decide` exists server-side but is not wrapped. The queue's bulk approve
 * (UX audit 2026-10-16, TIME-10) runs `decide` once per request, one at a time, so each result —
 * and each refusal — is the same answer a single click would get.)
 *
 * A decision needs BOTH `user_id` and `request_id`: the request lives on the requester's partition,
 * so the id alone doesn't locate it.
 */
import { apiFetch } from "@/lib/api";
import type { ApiLeaveAttachment } from "@/modules/leave/services/leave.service";
import type { ApiCorrection } from "@/modules/time-tracking/services/time-corrections.service";

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
  /**
   * On a pending row: the requester's balance per year the request touches, and what approving
   * charges it (working days for a full day, re-costed as the server will). Absent from older
   * servers, which the page then covers from the org ledger if it can read it.
   */
  balances?: { year: string; allowance: number; used: number; charge: number }[];
}

interface QueueResponse {
  approvals: ApiApprovalRow[];
  cursor?: string;
}

/** Rows per request — the server's maximum. */
const QUEUE_PAGE = 100;
/** A guard against a runaway cursor loop, not a product limit (5,000 rows per status). */
const QUEUE_MAX_PAGES = 50;

/**
 * The **whole** queue for one status, following the server's cursor page by page.
 *
 * The route is cursor-paginated (oldest first). This used to read one page and drop the cursor, so a
 * status showed at most its 50 oldest requests ever: once an org passed 50 approvals the Approved tab
 * froze, newer pending requests were invisible and undecidable, and Upcoming leave reported nobody
 * (QA audit 2026-10-08, WP-073).
 */
export async function getQueue(status: string): Promise<ApiApprovalRow[]> {
  const rows: ApiApprovalRow[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < QUEUE_MAX_PAGES; page++) {
    const q = new URLSearchParams({ status, limit: String(QUEUE_PAGE) });
    if (cursor) q.set("cursor", cursor);
    const r = await apiFetch<QueueResponse>(`/v1/approvals?${q}`);
    rows.push(...r.approvals);
    if (!r.cursor) break;
    cursor = r.cursor;
  }
  return rows;
}

export interface DecideInput {
  user_id: string;
  request_id: string;
  /** `approve` | `reject`. */
  decision: "approve" | "reject";
  /**
   * Mirrors `DecideRequest.reason`. Stored as `decision_reason`, shown to the requester on their
   * request, and carried by the "leave not approved" notification (UX audit TIME-10).
   */
  reason?: string;
}

/** Mirrors `approvals::dto::DecideResult` — the request's status after the decision. */
export interface DecideResult {
  user_id: string;
  request_id: string;
  status: string;
}

// ── Time corrections (UX audit TIME-05) ────────────────────────────────────────────────────────

export type { ApiCorrection };

/** `GET /v1/time/corrections?status=` — the time-correction queue (`attendance:edit`). */
export function getTimeCorrections(status = "pending"): Promise<ApiCorrection[]> {
  return apiFetch<{ corrections: ApiCorrection[] }>(
    `/v1/time/corrections?status=${encodeURIComponent(status)}`,
  ).then((r) => r.corrections);
}

/** `POST /v1/time/corrections/decide` — approve applies the fix to the timesheet at once. */
export function decideTimeCorrection(input: {
  user_id: string;
  request_id: string;
  decision: "approve" | "reject";
  reason?: string;
}): Promise<ApiCorrection> {
  return apiFetch<ApiCorrection>("/v1/time/corrections/decide", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function decide(input: DecideInput): Promise<DecideResult> {
  return apiFetch<DecideResult>("/v1/approvals/decide", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
