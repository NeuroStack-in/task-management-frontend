/**
 * What the caller's own devices say about them — the pure half of the device-status UI (UX audit
 * 2026-10-16, EMP-09): the dashboard's "Your device" card and the top bar's download chip.
 *
 * Input is `GET /v1/me/devices` (`getMyDevices`), where `null` means **unknown** (a server without
 * the route). Every helper keeps that distinction: unknown is never reported as "not installed".
 */
import type { MyDevice } from "@/modules/agents/services/my-devices.service";

/** Lifecycle states that still count as a device the person has. Absent/empty ⇒ active. */
function isActive(d: MyDevice): boolean {
  return !d.state || d.state === "active";
}

/** The login-less managed service (IT-installed), as opposed to the interactive desktop app. */
export function isManaged(d: MyDevice): boolean {
  return d.variant === "managed" || d.variant === "service";
}

/**
 * The device to talk about: the most recently heard-from active one, preferring the kind this org
 * tracks with. `null` when there is none (or the list is unknown).
 */
export function primaryDevice(
  devices: MyDevice[] | null,
  prefer: "interactive" | "managed" | "any" = "any",
): MyDevice | null {
  if (!devices) return null;
  const active = devices.filter(isActive);
  const pool =
    prefer === "any"
      ? active
      : active.filter((d) => (prefer === "managed" ? isManaged(d) : !isManaged(d)));
  return [...pool].sort((a, b) => (b.last_heartbeat || 0) - (a.last_heartbeat || 0))[0] ?? null;
}

/**
 * Has the person got the interactive desktop app? `null` = unknown. Only the app counts here: a
 * company laptop's managed service doesn't run project timers, so in `both` mode it is no reason to
 * stop offering the app.
 */
export function hasDesktopApp(devices: MyDevice[] | null): boolean | null {
  if (!devices) return null;
  return devices.some((d) => isActive(d) && !isManaged(d));
}

/** `"0.1.28"` < `"0.1.30"`. Non-numeric parts compare as 0; equal or unknown ⇒ false. */
export function isOlderVersion(installed: string, latest: string | null): boolean {
  if (!installed || !latest) return false;
  const a = installed.replace(/^v/, "").split(".").map((p) => parseInt(p, 10) || 0);
  const b = latest.replace(/^v/, "").split(".").map((p) => parseInt(p, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}

/**
 * Is the desktop app on this person's computer(s) behind the published release? Only then is a
 * "new version" cue worth showing them — to someone without the app it is noise, and the app updates
 * itself, so this is the case where that hasn't happened yet. `false` when unknown.
 */
export function desktopAppBehind(devices: MyDevice[] | null, latest: string | null): boolean {
  if (!devices || !latest) return false;
  return devices.some(
    (d) => isActive(d) && !isManaged(d) && isOlderVersion(d.agent_version, latest),
  );
}

export type DeviceTone = "ok" | "idle" | "offline" | "pending";

/** One device's connection, in words. `timeAgo` is injected so this stays clock-free for tests. */
export function describeConnection(
  d: MyDevice,
  timeAgo: (ms: number) => string,
): { tone: DeviceTone; label: string } {
  if (!d.last_heartbeat) return { tone: "pending", label: "Set up, not heard from yet" };
  if (d.connectivity === "online") return { tone: "ok", label: "Connected" };
  if (d.connectivity === "idle") return { tone: "idle", label: "Connected · idle" };
  return { tone: "offline", label: `Last seen ${timeAgo(d.last_heartbeat)}` };
}
