/**
 * Pure rules behind the Monitoring page's screenshot card — kept out of the component so they can be
 * tested without rendering it.
 */

/**
 * Why the capture interval can't be changed right now, or `null` when it can.
 *
 * Two switches matter, and they do different things (UX audit 2026-10-16, SET-03):
 *
 *  - **Screenshots** (`monitoring.screenshots`) is what the agents obey. Off, they capture nothing
 *    whatever the interval says (`fleet::enforce_monitoring_entitlement` sets `screenshots_enabled`,
 *    and ingest refuses to presign uploads). The stored interval is kept for when it comes back on.
 *  - **Activity monitoring** (`monitoring.activity`) is what `PUT /v1/fleet/update-policy` checks
 *    before it accepts a *changed* non-Off interval. It does not stop capture: with Screenshots on
 *    and Activity off, the agents keep capturing at the stored interval.
 *
 * The page used to read only the second, so with Screenshots off it offered an editable "Every
 * 5 minutes" while nothing was captured, and with Activity off it claimed capture was off when it
 * wasn't. Screenshots is checked first because it is the one that decides whether anything is
 * captured at all.
 */
export type CaptureLock =
  | { kind: "screenshots-off" }
  | { kind: "screenshots-not-in-plan" }
  | { kind: "activity-off" }
  | { kind: "activity-not-in-plan" }

export function captureLock(s: {
  screenshotsOn: boolean
  screenshotsInPlan: boolean
  activityOn: boolean
  activityInPlan: boolean
}): CaptureLock | null {
  if (!s.screenshotsOn) {
    return { kind: s.screenshotsInPlan ? "screenshots-off" : "screenshots-not-in-plan" }
  }
  if (!s.activityOn) {
    return { kind: s.activityInPlan ? "activity-off" : "activity-not-in-plan" }
  }
  return null
}

/** Is anything being captured under this lock? Only when Screenshots itself is on. */
export function capturing(lock: CaptureLock | null): boolean {
  return lock === null || lock.kind === "activity-off" || lock.kind === "activity-not-in-plan"
}

/**
 * The retention choices (UX audit SET-04): a one-day stepper up to 365 made "90 → 1" a few clicks,
 * and nobody needs 143 days. The stored value is kept as a choice when it isn't a preset — an org
 * that saved 45 days must see 45, not have it silently swapped for the nearest preset.
 */
export const RETENTION_PRESETS = [7, 30, 90, 180, 365] as const

/** The server's own default (`TrackingConfig::default`, 90 days). */
export const RETENTION_DEFAULT = 90

export function retentionOptions(current: number): number[] {
  const presets: number[] = [...RETENTION_PRESETS]
  const n = Math.round(current)
  if (!Number.isFinite(n) || n < 1 || presets.includes(n)) return presets
  return [...presets, n].sort((a, b) => a - b)
}

export function retentionLabel(days: number): string {
  const base =
    days === 365 ? "1 year" : `${days} day${days === 1 ? "" : "s"}`
  return days === RETENTION_DEFAULT ? `${base} (default)` : base
}
