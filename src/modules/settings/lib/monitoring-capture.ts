/**
 * Pure rules behind the Monitoring page's screenshot card — kept out of the component so they can be
 * tested without rendering it.
 */

/**
 * Why the capture interval can't be changed right now, or `null` when it can.
 *
 * **Features → Screenshots** (`monitoring.screenshots`) is the one switch that matters (UX audit
 * 2026-10-16, SET-03). The agents obey it — off, they capture nothing whatever the interval says
 * (`fleet::enforce_monitoring_entitlement` sets `screenshots_enabled`, and ingest refuses to presign
 * uploads) — and `PUT /v1/fleet/update-policy` checks it before accepting a changed interval. The
 * stored interval is kept for when it comes back on.
 *
 * The page used to read only Activity monitoring (which the server then checked), so with
 * Screenshots off it offered an editable "Every 5 minutes" while nothing was captured; and with
 * Activity off and Screenshots on, the interval was locked while capture ran at it. The server now
 * checks Screenshots too, so Activity monitoring no longer decides anything here.
 */
export type CaptureLock = { kind: "screenshots-off" } | { kind: "screenshots-not-in-plan" }

export function captureLock(s: {
  screenshotsOn: boolean
  screenshotsInPlan: boolean
}): CaptureLock | null {
  if (!s.screenshotsOn) {
    return { kind: s.screenshotsInPlan ? "screenshots-off" : "screenshots-not-in-plan" }
  }
  return null
}

/** Is anything being captured under this lock? Only when there is no lock. */
export function capturing(lock: CaptureLock | null): boolean {
  return lock === null
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
