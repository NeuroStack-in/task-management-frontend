/**
 * Presentational helpers for the device-agents screen. Pure UI: the connectivity
 * union + its badge styling, and a relative-time formatter for heartbeats. The
 * data itself is real (`GET /v1/fleet`, see services/fleet.service.ts) — nothing
 * here fabricates devices.
 */

/** Read-time connectivity, mirroring the server's `DeviceView.connectivity`. */
export type AgentStatus = "online" | "idle" | "offline"

export const STATUS_META: Record<AgentStatus, { label: string; dot: string }> = {
  online: { label: "Online", dot: "bg-success" },
  idle: { label: "Idle", dot: "bg-warning" },
  offline: { label: "Offline", dot: "bg-muted-foreground/40" },
}

/** Normalise the server's free `connectivity` string onto the known union. */
export function toStatus(connectivity: string): AgentStatus {
  return connectivity === "online" || connectivity === "idle" ? connectivity : "offline"
}

/** Epoch-ms heartbeat → short "last seen" label. */
export function lastSeen(heartbeatMs: number): string {
  if (!heartbeatMs) return "Never"
  const diff = Date.now() - heartbeatMs
  if (diff < 0) return "Active now"
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "Active now"
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days > 1 ? "s" : ""} ago`
}
