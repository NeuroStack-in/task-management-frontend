import { describe, expect, it } from "vitest";
import { canRegenerate } from "@/modules/insights/lib/ai-provenance";
import type { DailySummary, PeriodRecap } from "@/modules/insights/services/insights.service";
import { recapHasData } from "./recap";

const metrics = {
  attendance: "absent",
  late: false,
  worked_minutes: 0,
  tracked_secs: 0,
  billable_secs: 0,
  entry_count: 0,
  task_count: 0,
};
const day = (over: Partial<DailySummary> = {}): DailySummary => ({
  date: "2026-10-20",
  metrics,
  narrative: "- They were absent; no time was logged.",
  ...over,
});
const week = (over: Partial<PeriodRecap> = {}): PeriodRecap =>
  ({ aggregate: {}, narrative: "", ...over }) as PeriodRecap;

describe("recapHasData (UX audit MON-21)", () => {
  it("is false for nothing loaded", () => {
    expect(recapHasData(null)).toBe(false);
  });

  it("is false for the server's empty-day line — no stamp, no metrics, no score", () => {
    expect(recapHasData(day())).toBe(false);
  });

  it("is true for a day with tracked time or entries, or a score", () => {
    expect(recapHasData(day({ metrics: { ...metrics, tracked_secs: 3600 } }))).toBe(true);
    expect(recapHasData(day({ metrics: { ...metrics, entry_count: 1 } }))).toBe(true);
    expect(recapHasData(day({ score: {} as DailySummary["score"] }))).toBe(true);
  });

  it("is true for any model-written (stamped) narrative", () => {
    expect(recapHasData(day({ generated_at: 1_760_000_000_000 }))).toBe(true);
  });

  it("is false for the untracked-role placeholder on a period, true once children were reduced", () => {
    expect(recapHasData(week({ narrative: "- This is an administrative role…", source_days: 0 }))).toBe(
      false,
    );
    expect(recapHasData(week({ source_days: 3 }))).toBe(true);
    expect(recapHasData(week({ source_weeks: 2 }))).toBe(true);
    expect(recapHasData(week({ source_months: 1 }))).toBe(true);
  });

  it("with canRegenerate: no button over the empty line, a button over a real recap", () => {
    const empty = day();
    expect(canRegenerate(recapHasData(empty), empty.narrative)).toBe(false);
    const real = day({ generated_at: 1_760_000_000_000, narrative: "- Worked 6 h on WP-12." });
    expect(canRegenerate(recapHasData(real), real.narrative)).toBe(true);
  });
});
