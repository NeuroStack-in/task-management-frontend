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
  /** Epoch **milliseconds** — the server stamps every ticket/reply time with `now_ms()`. */
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
  /** S3 keys from {@link uploadAttachment}, not files — the bytes are already in S3 by now. */
  attachments?: string[];
}): Promise<ApiTicketView> {
  return apiFetch<ApiTicketView>("/v1/support/tickets", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Mirrors `workforce::support_tickets::dto::PresignResponse`. */
interface PresignSlot {
  key: string;
  url: string;
  content_type: string;
}

/** What the server accepts — mirrors `ALLOWED_TYPES` in the Rust dto. */
export const ATTACHMENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/heic",
  "application/pdf",
];

/** Mirrors `MAX_ATTACHMENTS`. */
export const MAX_ATTACHMENTS = 5;

/**
 * Per-file ceiling. The server does not enforce a byte size (S3 takes what the presigned PUT
 * allows), but the support email drops anything past a 15 MB total — so refusing here is honest,
 * and refusing *before* the upload saves the round trip.
 */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/**
 * Upload one file and return its S3 **key**, to be passed to {@link createTicket}.
 *
 * Two steps by design: ask the server for a slot, then PUT the bytes **straight to S3**. The file
 * never crosses API Gateway or Lambda — a 10 MB screenshot base64'd into a JSON body would be both
 * slower and a payload-limit failure waiting to happen.
 *
 * The `Content-Type` must match what was presigned, or S3 rejects the PUT with an opaque 403.
 *
 * Uses a bare `fetch`, not `apiFetch`: the target is S3, and attaching a Cognito token to a
 * presigned URL confuses the signature.
 */
export async function uploadAttachment(file: File): Promise<string> {
  const slot = await apiFetch<PresignSlot>("/v1/support/tickets/attachments/presign", {
    method: "POST",
    body: JSON.stringify({ filename: file.name, content_type: file.type }),
  });
  const res = await fetch(slot.url, {
    method: "PUT",
    body: file,
    headers: { "content-type": slot.content_type },
  });
  if (!res.ok) {
    throw new Error(`Upload failed (${res.status})`);
  }
  return slot.key;
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
