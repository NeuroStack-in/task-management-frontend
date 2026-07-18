/**
 * Support tickets — the real backend (`workforce` context, LLD §19; the one sanctioned cross-tenant
 * read via the sparse GSI7). The caller sees their own tenant's tickets.
 *
 * There is **no priority and no attachments** on the server — the ticket is `{subject, description,
 * category}` plus a status and a reply thread. So the form collects only what's stored.
 */
import { apiFetch } from "@/lib/api";

/** Mirrors `workforce::support_tickets::dto::TicketSummary`. */
export interface ApiTicketSummary {
  ticket_id: string;
  subject: string;
  category: string;
  status: string;
  /** Epoch seconds. */
  created_at: number;
}

/** Mirrors `TicketView`. */
export interface ApiTicketView {
  ticket_id: string;
  subject: string;
  description: string;
  category: string;
  status: string;
  created_at: number;
  updated_at?: number;
}

/** Mirrors `ReplyView` — `author` is a user id (or "support"). */
export interface ApiReply {
  author: string;
  body: string;
  created_at: number;
}

export interface ApiThread {
  ticket: ApiTicketView;
  replies: ApiReply[];
}

export async function listTickets(): Promise<ApiTicketSummary[]> {
  const data = await apiFetch<ApiTicketSummary[] | { tickets: ApiTicketSummary[] }>(
    "/v1/support/tickets",
  );
  return Array.isArray(data) ? data : (data?.tickets ?? []);
}

export function createTicket(body: {
  subject: string;
  description: string;
  category?: string;
}): Promise<ApiTicketView> {
  return apiFetch<ApiTicketView>("/v1/support/tickets", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getThread(ticketId: string): Promise<ApiThread> {
  return apiFetch<ApiThread>(`/v1/support/tickets/${encodeURIComponent(ticketId)}`);
}

export async function addReply(ticketId: string, body: string): Promise<void> {
  await apiFetch(`/v1/support/tickets/${encodeURIComponent(ticketId)}/replies`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}
