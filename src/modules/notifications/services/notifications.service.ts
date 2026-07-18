/**
 * Notifications — the real backend (`notifications` context, LLD §11).
 *
 * `GET /v1/notifications` returns the caller's items newest-first plus an unread count. The count
 * is computed from the same query rather than a counter item: a 30-day TTL bounds the volume, so
 * there is nothing to keep in sync and nothing to drift (LLD §11).
 *
 * ## Shape gap, and how it's bridged
 *
 * The server sends one `summary` string; `AppNotification` wants a `title` **and** a `message`.
 * Rather than duplicate the summary into both, the title comes from `ntype` — a real, enumerated
 * server field — and the summary stays the message. So the pair is derived from data, not invented.
 *
 * An unrecognised `ntype` is expected, not a bug: the backend adds events (`consumers.rs`) faster
 * than this table is updated, and a new one must render as itself rather than vanish or crash.
 */
import { apiFetch } from "@/lib/api";
import type { AppNotification, NotificationType } from "@/types";

/** Mirrors `notifications::features::list_notifications::data::NotificationRow`. */
export interface ApiNotification {
  id: string;
  /** `system` | `approval` today — the server's own grouping, also its email opt-in key. */
  category: string;
  /** The specific event, e.g. `leave_approved`. Enumerated in the backend's `consumers.rs`. */
  ntype: string;
  summary: string;
  read: boolean;
  /** Epoch ms. */
  created_at: number;
}

interface ListResponse {
  notifications: ApiNotification[];
  unread: number;
}

export interface NotificationsResult {
  items: AppNotification[];
  unread: number;
}

export async function listNotifications(): Promise<NotificationsResult> {
  const res = await apiFetch<ListResponse>("/v1/notifications");
  return { items: res.notifications.map(toAppNotification), unread: res.unread };
}

/** `POST /v1/notifications/{id}/read`. */
export async function markRead(id: string): Promise<void> {
  await apiFetch(`/v1/notifications/${encodeURIComponent(id)}/read`, {
    method: "POST",
  });
}

/** `POST /v1/notifications/read-all`. */
export async function markAllRead(): Promise<void> {
  await apiFetch("/v1/notifications/read-all", { method: "POST" });
}

/**
 * Preferences — `GET`/`PUT /v1/notifications/prefs` (self-scoped, LLD §11).
 *
 * The server stores the pref document **opaquely** (a whole JSON blob under `data`, versioned) and
 * hands it back verbatim, so the frontend owns the shape. We persist our own `NotificationPrefs`
 * object directly; the server increments `version` on each write (no client-supplied lock).
 *
 * A brand-new user has never saved, so `GET` returns the server's *default* document, whose shape
 * differs from ours — the caller must therefore read it **defensively** and fall back to its own
 * defaults per field, not assume our keys are present.
 */
export interface PrefsDoc {
  prefs: unknown;
  version: number;
}

export function getPrefs(): Promise<PrefsDoc> {
  return apiFetch<PrefsDoc>("/v1/notifications/prefs");
}

export function updatePrefs(prefs: unknown): Promise<PrefsDoc> {
  return apiFetch<PrefsDoc>("/v1/notifications/prefs", {
    method: "PUT",
    body: JSON.stringify({ prefs }),
  });
}

/**
 * Short human label per `ntype`, mirroring the summaries the backend's consumer writes.
 *
 * Kept in the same order as `notifications/src/consumers.rs` so the two can be diffed by eye — this
 * table and that match arm are a pair, and nothing but care holds them together.
 */
const TITLES: Record<string, string> = {
  org_created: "Welcome to WorkPulse",
  employee_joined: "You joined the organization",
  leave_requested: "Leave request submitted",
  leave_approved: "Leave approved",
  leave_cancelled: "Leave cancelled",
  mfa_reset: "Two-factor device reset",
  ownership_transferred: "You're now the owner",
  ticket_replied: "Support replied",
};

/** The frontend's union. The server only ever sends `system`/`approval`; the rest are unused. */
const KNOWN_TYPES: NotificationType[] = [
  "task",
  "approval",
  "productivity",
  "billing",
  "system",
];

function toAppNotification(n: ApiNotification): AppNotification {
  return {
    id: n.id,
    type: typeOf(n.category),
    title: TITLES[n.ntype] ?? humanize(n.ntype),
    message: n.summary,
    read: n.read,
    createdAt: n.created_at,
    href: hrefOf(n.ntype),
  };
}

/**
 * `category` → the UI's type union.
 *
 * The server's two categories (`system`, `approval`) are already members of it, so this is a
 * *check*, not a translation. An unknown category falls back to `system` rather than being coerced
 * into a wrong bucket — a mislabelled billing alert is worse than a generic one.
 */
function typeOf(category: string): NotificationType {
  const hit = KNOWN_TYPES.find((t) => t === category);
  return hit ?? "system";
}

/** `leave_approved` → `Leave approved`, for an ntype this build hasn't been taught yet. */
function humanize(ntype: string): string {
  if (!ntype) return "Notification";
  const s = ntype.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Where clicking should go. Client-side routing, so it belongs here rather than on the wire.
 *
 * Only mapped where the destination is unambiguous; anything else gets no link. A wrong link is
 * worse than none — it teaches people the bell lies.
 */
function hrefOf(ntype: string): string | undefined {
  if (ntype.startsWith("leave_")) return "/leave";
  if (ntype === "ticket_replied") return "/help";
  return undefined;
}
