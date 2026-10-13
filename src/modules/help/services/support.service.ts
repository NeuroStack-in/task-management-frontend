/**
 * Support tickets — the real backend (`workforce` context, LLD §19; the one sanctioned cross-tenant
 * read via the sparse GSI7). The caller sees their own tenant's tickets.
 *
 * A ticket is `{subject, description, category}` plus up to five **attachments** (S3 keys — the
 * browser uploads the bytes straight to S3, see {@link uploadAttachment}), a status and a reply
 * thread. There is no priority on the server, so the form doesn't ask for one.
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
  /**
   * The files attached when filing — S3 **keys**, not URLs. Omitted by the server when there are
   * none. Missing from this type, so the ticket view never showed them (QA audit 2026-10-08, WP-121).
   */
  attachments?: string[];
}

/**
 * The file name to show for an attachment key. The server mints
 * `support/<tenant>/<user>/<ULID>-<sanitized name>`, so the name is the last segment minus its
 * id prefix.
 */
export function attachmentName(key: string): string {
  const last = key.split("/").pop() || key;
  return last.replace(/^[0-9A-HJKMNP-TV-Z]{26}-/, "") || last;
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

/**
 * The caller's tickets, **newest first**. The server returns them in key order — oldest first — so
 * a just-filed ticket landed at the bottom of "Your recent tickets" (QA audit 2026-10-08, WP-246).
 */
export async function listTickets(): Promise<ApiTicketSummary[]> {
  const data = await apiFetch<ApiTicketSummary[] | { tickets: ApiTicketSummary[] }>(
    "/v1/support/tickets",
  );
  const list = Array.isArray(data) ? data : (data?.tickets ?? []);
  return [...list].sort((a, b) => b.created_at - a.created_at);
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
    // The size is signed into the slot, so S3 refuses anything bigger (WP-170).
    body: JSON.stringify({ filename: file.name, content_type: file.type, size: file.size }),
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

/**
 * `POST /v1/support/tickets/{id}/close` — the reporter marks their own issue resolved.
 *
 * An action route rather than a `PATCH {status}`: closing is the only transition a customer may
 * make (`in_progress`/`resolved` are the support desk's words about its own work). Idempotent, so a
 * double-click or a stale second tab is harmless. Returns the updated ticket.
 *
 * **Replying to a closed ticket reopens it** — worth knowing before hiding closed tickets from a
 * user's view.
 */
export function closeTicket(ticketId: string): Promise<ApiTicketView> {
  return apiFetch<ApiTicketView>(
    `/v1/support/tickets/${encodeURIComponent(ticketId)}/close`,
    { method: "POST" },
  );
}

export async function addReply(ticketId: string, body: string): Promise<void> {
  await apiFetch(`/v1/support/tickets/${encodeURIComponent(ticketId)}/replies`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}
