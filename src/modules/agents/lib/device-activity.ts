/**
 * How alive a device is, as the fleet pages show it (2026-10-28).
 *
 * The page read two signals as if they were one. **Status** comes from the live connection when the
 * server has one (MQTT presence), else from the last check-in; **"Last check-in"** showed only the
 * check-in. So a device could read "Online" beside "12d ago". Devices nobody had used for months
 * (old installs, replaced laptops) also stayed in every count: on live `dev` about 30 of 40 "active"
 * rows had not been seen for 16–93 days, inflating Devices, Offline and "Behind latest".
 *
 * Pure and unit-tested; the fleet list, the device page and the employee profile all read status
 * through here.
 */
import type { ApiDevice } from "../services/fleet.service";
import { isLiveDevice } from "./device-state";

/** The server's online window: a check-in inside it counts as online (fleet `ONLINE_WINDOW_MS`). */
export const ONLINE_WINDOW_MS = 10 * 60 * 1000;

/** A device with no sign of life for this long is "inactive": hidden by default, never counted. */
export const INACTIVE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

type Liveness = Pick<ApiDevice, "last_heartbeat" | "connectivity" | "state"> &
  Partial<Pick<ApiDevice, "last_seen" | "presence_live">>;

export type ShownConnectivity = "online" | "idle" | "offline";

/** The last sign of life of any kind: the server's `last_seen` when it sends one (check-in or live
 *  connection, whichever is newer), else the last check-in. */
export function lastSeenAt(d: Pick<Liveness, "last_heartbeat" | "last_seen">): number {
  return Math.max(d.last_heartbeat || 0, d.last_seen || 0);
}

/**
 * The status to show. The server's, except that "Idle" needs a recent check-in: the idle flag is the
 * one the agent sent with its last check-in, and a server from before 2026-10-28 paired a days-old
 * flag with a fresh live connection.
 */
export function shownConnectivity(d: Liveness, now: number = Date.now()): ShownConnectivity {
  if (d.connectivity === "idle") {
    return now - (d.last_heartbeat || 0) > ONLINE_WINDOW_MS ? "online" : "idle";
  }
  return d.connectivity === "online" ? "online" : "offline";
}

/** Not retired, offline, and no sign of life for 30+ days: an uninstalled app, a replaced laptop. */
export function isInactive(d: Liveness, now: number = Date.now()): boolean {
  return (
    isLiveDevice(d.state) &&
    shownConnectivity(d, now) === "offline" &&
    now - lastSeenAt(d) > INACTIVE_AFTER_MS
  );
}

/** A device the fleet page counts: not retired and not inactive. */
export function isCounted(d: Liveness, now: number = Date.now()): boolean {
  return isLiveDevice(d.state) && !isInactive(d, now);
}

/** "5m ago", "3h ago", "12d ago", "just now", "never". */
export function ago(ms: number, now: number = Date.now()): string {
  if (!ms) return "never";
  const diff = now - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

/** The "Last seen" cell: "Now" while the live connection is up, else how long ago. */
export function lastSeenText(d: Liveness, now: number = Date.now()): string {
  if (d.presence_live && shownConnectivity(d, now) !== "offline") return "Now";
  return ago(lastSeenAt(d), now);
}
