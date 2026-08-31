/**
 * The org's tracking mode — how it records work (MANAGED-AGENT.md §4). Chosen at org creation,
 * changeable by the owner. Mirrors `wp_contracts::tracking::TrackingMode`.
 *
 * Not a `"use client"` module, so server components may import it (CLAUDE.md rule 5).
 *
 * - `project` — the interactive desktop app + project/task timer. The **default**, and the behaviour
 *   of every org that predates the field.
 * - `machine` — the managed Windows service + logon-session timer. A monitoring-only console
 *   (no Projects, Leave, or Payroll surfaces).
 * - `both` — a mixed fleet running both agents.
 */
export const TRACKING_MODES = ["project", "machine", "both"] as const;
export type TrackingMode = (typeof TRACKING_MODES)[number];

/**
 * Modes an org may currently **choose** in the UI.
 *
 * `machine` and `both` are built, but the managed Windows service isn't deployed yet, so the pickers
 * show them **disabled** rather than letting an org select a mode nothing can fulfil. This is the one
 * place the gate lives — re-enable a mode by adding it back here, and every picker follows. It does
 * **not** touch how an existing mode is read/displayed (`trackingModeOf`), only what's selectable.
 */
export const SELECTABLE_TRACKING_MODES: readonly TrackingMode[] = ["project"];

/** Whether an org may pick this mode right now (see {@link SELECTABLE_TRACKING_MODES}). */
export function isSelectableTrackingMode(m: TrackingMode): boolean {
  return SELECTABLE_TRACKING_MODES.includes(m);
}

export interface TrackingModeInfo {
  /** The label shown on the mode chip/card. */
  label: string;
  /** A one-line summary. */
  short: string;
  /** The full description used in the signup step and Settings dialog. */
  blurb: string;
  /** An optional badge (e.g. "Most teams"). */
  badge?: string;
}

export const TRACKING_MODE_META: Record<TrackingMode, TrackingModeInfo> = {
  project: {
    label: "Project & task time",
    short: "Employees start a project timer in the WorkPulse app.",
    blurb:
      "Your team installs the WorkPulse app and starts a timer against a project. Time, activity and " +
      "screenshots are captured while the timer runs, and nothing at all when it's off.",
    badge: "Most teams",
  },
  machine: {
    label: "Machine uptime",
    short: "IT installs a background service; attendance from sign-in to sign-out.",
    blurb:
      "IT deploys a background Windows service to company-owned computers. Attendance and activity are " +
      "recorded from sign-in to sign-out — no login, no timer, nothing for employees to install or start. " +
      "Windows only.",
  },
  both: {
    label: "Both",
    short: "Some people run the app; other machines run the background service.",
    blurb:
      "Some people run the WorkPulse app with a project timer; other machines run the background service. " +
      "One fleet, one record — each person's day counts once, never twice.",
  },
};

/**
 * Resolve a server-sent mode string. **Absent or unrecognised ⇒ `project`** — deliberately, because
 * `project` hides nothing (MANAGED-AGENT.md §8): degrading an unknown value to `machine` would blank
 * Projects for an org that has them, a far worse failure than showing one section too many. Same
 * fail-open posture as `effectiveFromState`.
 */
export function trackingModeOf(v: string | null | undefined): TrackingMode {
  return (TRACKING_MODES as readonly string[]).includes(v ?? "")
    ? (v as TrackingMode)
    : "project";
}

/** Whether a server value is one this build understands — lets Settings show the raw value rather
 * than silently claiming `project` on an unknown mode. */
export function isKnownTrackingMode(v: string | null | undefined): boolean {
  return (TRACKING_MODES as readonly string[]).includes(v ?? "");
}
