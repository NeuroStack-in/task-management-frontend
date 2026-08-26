/**
 * Platform-ops support desk — the cross-tenant operator API (workforce `ops_support`).
 *
 * Every route but `/ops/me` is gated server-side on the platform-admin allowlist
 * (`SYS#PLATFORM/ADMINS`). The frontend never decides access — it calls `/ops/me` only to know
 * whether to *show* the console; the server refuses anything a non-operator asks for.
 */
import { apiFetch } from "@/lib/api";

export type OpsStatus = "open" | "in_progress" | "resolved" | "closed";

export interface OpsTicketRow {
  tenant_id: string;
  user_id: string;
  ticket_id: string;
  subject: string;
  category: string;
  status: OpsStatus;
  created_at: number;
  updated_at?: number;
}

export interface OpsMessage {
  /** "user" (the requester) or "support" (an operator). */
  author: string;
  body: string;
  created_at: number;
}

export interface OpsThread {
  tenant_id: string;
  user_id: string;
  ticket_id: string;
  subject: string;
  category: string;
  status: OpsStatus;
  created_at: number;
  updated_at?: number;
  attachments: string[];
  messages: OpsMessage[];
}

/** `GET /v1/ops/me` — open to any signed-in user; is this account a platform operator? */
export function getOpsMe(): Promise<{ platform_admin: boolean }> {
  return apiFetch<{ platform_admin: boolean }>("/v1/ops/me");
}

/** `GET /v1/ops/support/tickets?status=` — the cross-tenant queue for one status. */
export function listOpsTickets(status: OpsStatus): Promise<{ status: string; tickets: OpsTicketRow[] }> {
  return apiFetch<{ status: string; tickets: OpsTicketRow[] }>(
    `/v1/ops/support/tickets?status=${encodeURIComponent(status)}`,
  );
}

function ticketPath(t: string, u: string, id: string): string {
  return `/v1/ops/support/tickets/${encodeURIComponent(t)}/${encodeURIComponent(u)}/${encodeURIComponent(id)}`;
}

/** `GET /v1/ops/support/tickets/{tenant}/{user}/{id}` — the full thread. */
export function getOpsThread(t: string, u: string, id: string): Promise<OpsThread> {
  return apiFetch<OpsThread>(ticketPath(t, u, id));
}

/** `POST .../replies` — post a staff reply (author=support). Returns the refreshed thread. */
export function replyOpsTicket(t: string, u: string, id: string, body: string): Promise<OpsThread> {
  return apiFetch<OpsThread>(`${ticketPath(t, u, id)}/replies`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

/** `POST .../status` — set the ticket's status (moves both `status` and the GSI7 queue partition). */
export function setOpsStatus(t: string, u: string, id: string, status: OpsStatus): Promise<OpsThread> {
  return apiFetch<OpsThread>(`${ticketPath(t, u, id)}/status`, {
    method: "POST",
    body: JSON.stringify({ status }),
  });
}
