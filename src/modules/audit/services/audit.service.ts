/**
 * Audit log — the real backend (`identity` context, LLD §17).
 *
 * `GET /v1/audit?category&limit` returns the tenant's audit trail, newest-first. The row is
 * deliberately lean — `{ts, actor, category, action, target?}` — and that is the whole record: there
 * is **no** IP, device, or success/failure status on the server (the mock invented those). So the
 * view shows what's real and drops the rest rather than fabricating an origin or an outcome.
 *
 * `actor` is a Cognito user id (a UUID); the view joins it to a display name via the employee
 * directory, falling back to the raw id when the actor isn't in the roster (e.g. the system).
 */
import { apiFetch } from "@/lib/api";

/** Mirrors `identity::features::audit_log::data::AuditRow`. */
export interface ApiAuditRow {
  /** Epoch **seconds**. */
  ts: number;
  actor: string;
  category: string;
  action: string;
  target?: string;
}

export function listAudit(category?: string, limit = 200): Promise<ApiAuditRow[]> {
  const q = new URLSearchParams();
  if (category && category !== "all") q.set("category", category);
  q.set("limit", String(limit));
  return apiFetch<ApiAuditRow[]>(`/v1/audit?${q}`);
}
