/**
 * How the sessions list orders and marks its rows (UX audit SET-18).
 *
 * The list showed nine identical "Chrome on Windows" rows, each with a raw device id, and put
 * "This device" on the newest row whenever this browser's own id wasn't found — a guess presented
 * as a fact. Now: this browser first, and marked **only** when its id matches; the rest newest
 * first; no ids.
 */
import type { ApiSession } from "../services/security.service";

/** Rows shown before "Show all". */
export const SESSIONS_SHOWN = 5;

export interface SessionRowView {
  session: ApiSession;
  /** This browser's own row — its stored device id matched (`lib/device.ts`). Never guessed. */
  isThisDevice: boolean;
}

/** This browser first (when it is in the list), then most recently seen first. */
export function orderSessions(sessions: ApiSession[], deviceId: string): SessionRowView[] {
  return sessions
    .map((session) => ({ session, isThisDevice: deviceId !== "" && session.session_id === deviceId }))
    .sort(
      (a, b) =>
        Number(b.isThisDevice) - Number(a.isThisDevice) ||
        (b.session.last_seen ?? 0) - (a.session.last_seen ?? 0),
    );
}

/** The row's name: the browser label the client reported, or a plain fallback — never the id. */
export function sessionLabel(s: ApiSession): string {
  return s.user_agent?.trim() || "Web browser";
}
