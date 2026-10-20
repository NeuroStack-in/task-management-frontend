/**
 * Ordering and stepping for the screenshot gallery and viewer (UX audit 2026-10-16, MON-11 / MON-12).
 * Pure, so the rules are pinned by a test.
 */
import { awaitsReview, type ShotRow } from "../services/insights.service";

/** Flags on these frames that nobody has confirmed or dismissed — what a tile's badge counts. */
export function openFlagsOf(shots: Pick<ShotRow, "flagged" | "human_review">[]): number {
  return shots.filter(awaitsReview).length;
}

/**
 * Distinct capture moments among these frames. A multi-monitor machine sends one frame per display
 * with the same `captured_at`; counting frames made a two-monitor employee look twice as watched.
 */
export function captureCountOf(shots: Pick<ShotRow, "captured_at">[]): number {
  return new Set(shots.map((s) => s.captured_at)).size;
}

/**
 * People with flags awaiting review first, most first; everyone else keeps the server's order
 * (MON-11). A 40-person day used to list people in id order, so the three with flags could sit at
 * the bottom of the page.
 */
export function sortGroupsByOpenFlags<T extends { shots: Pick<ShotRow, "flagged" | "human_review">[] }>(
  groups: T[],
): T[] {
  return groups
    .map((g, i) => ({ g, i, open: openFlagsOf(g.shots) }))
    .sort((a, b) => b.open - a.open || a.i - b.i)
    .map((x) => x.g);
}

/**
 * The next (or previous) capture after `from` that still awaits review, or `null` when there is none
 * in that direction — the viewer's "next flagged" (MON-12).
 */
export function nextFlaggedIndex(
  captures: { awaitsReview: boolean }[],
  from: number,
  dir: 1 | -1,
): number | null {
  for (let i = from + dir; i >= 0 && i < captures.length; i += dir) {
    if (captures[i].awaitsReview) return i;
  }
  return null;
}

/** Where each frame of a flattened capture list sits: its capture, and its monitor within it. */
export interface FramePosition {
  capture: number;
  monitor: number;
  monitors: number;
}

/** One entry per frame, in viewer order (each capture's monitors in turn). */
export function framePositions(captures: { monitors: unknown[] }[]): FramePosition[] {
  const out: FramePosition[] = [];
  captures.forEach((c, ci) => {
    c.monitors.forEach((_, mi) => out.push({ capture: ci, monitor: mi, monitors: c.monitors.length }));
  });
  return out;
}

/** The viewer's counter: "Capture 12 of 340 · monitor 1 of 2" — moments, not frames (MON-12). */
export function counterLabel(pos: FramePosition, captures: number, more: boolean): string {
  const base = `Capture ${(pos.capture + 1).toLocaleString()} of ${captures.toLocaleString()}${more ? "+" : ""}`;
  return pos.monitors > 1 ? `${base} · monitor ${pos.monitor + 1} of ${pos.monitors}` : base;
}
