/**
 * Time-correction requests — the employee's side (owner decision 2026-10-18, UX audit TIME-05).
 *
 * An employee asks to fix a session (a forgotten stop, the wrong project) or to add time the timer
 * missed; nothing changes until an approver says yes (`time_attendance::time_corrections`). The
 * approver's side lives in the approvals module.
 */
import { apiFetch } from "@/lib/api";

/** Mirrors `time_corrections::dto::CorrectionView`. */
export interface ApiCorrection {
  request_id: string;
  user_id: string;
  /** `edit` an existing session, or `add` missing time. */
  kind: "edit" | "add";
  /** `YYYY-MM-DD` — the session's day. */
  date: string;
  session_id?: string;
  /** What the session should become (epoch ms). */
  start: number;
  end: number;
  project_id: string;
  task_id?: string;
  /** What it was when filed — `edit` only. */
  base_start?: number;
  base_end?: number;
  base_project_id?: string;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  created_at: number;
  decided_at?: number;
  decided_by?: string;
  decision_reason?: string;
}

export interface NewCorrection {
  /** Absent to add missing time. */
  session_id?: string;
  date: string;
  start: number;
  end: number;
  project_id?: string;
  reason: string;
}

/** `POST /v1/me/time/corrections` — ask for a fix. */
export function fileCorrection(body: NewCorrection): Promise<ApiCorrection> {
  return apiFetch<ApiCorrection>("/v1/me/time/corrections", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** `GET /v1/me/time/corrections` — the caller's requests, newest first. */
export function listMyCorrections(): Promise<ApiCorrection[]> {
  return apiFetch<{ corrections: ApiCorrection[] }>("/v1/me/time/corrections").then(
    (r) => r.corrections,
  );
}

/** `POST /v1/me/time/corrections/{id}/cancel` — withdraw one that is still pending. */
export function cancelCorrection(id: string): Promise<unknown> {
  return apiFetch(`/v1/me/time/corrections/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
  });
}
