import { describe, expect, it } from "vitest";

import { bucketByHour } from "./use-hourly-activity";
import { localDateOf, utcDatesFor } from "@/lib/local-day";
import type { ShotRow } from "./services/insights.service";

/** A capture at a local hour on 2026-08-10. `captured_at` is epoch **ms**. */
function shot(user: string, hour: number, category: string, minute = 0): ShotRow {
  return {
    shot_id: `${user}-${hour}-${minute}`,
    user_id: user,
    captured_at: new Date(2026, 7, 10, hour, minute).getTime(),
    app: "Editor",
    blur_level: 0,
    phash: "",
    url: "",
    category,
    flagged: false,
  };
}

describe("bucketByHour", () => {
  it("returns a stable 24-hour axis even with no captures", () => {
    const { hours, captures } = bucketByHour([]);
    expect(hours).toHaveLength(24);
    expect(hours.map((h) => h.hour)).toEqual([...Array(24).keys()]);
    expect(captures).toBe(0);
    expect(hours.every((h) => h.total === 0)).toBe(true);
  });

  it("buckets captures into their local hour", () => {
    const { hours, captures } = bucketByHour([
      shot("u1", 9, "productive"),
      shot("u1", 9, "productive", 30),
      shot("u1", 14, "distracting"),
    ]);
    expect(captures).toBe(3);
    expect(hours[9].total).toBe(2);
    expect(hours[14].total).toBe(1);
    expect(hours[10].total).toBe(0);
  });

  it("counts a multi-monitor capture once, not once per frame", () => {
    // Frames of one capture share `captured_at` — the dual-monitor case that would otherwise
    // inflate that user's hour. Same user, same instant, two rows.
    const at = shot("u1", 11, "productive");
    const secondMonitor: ShotRow = { ...at, shot_id: "u1-11-second" };
    const { hours, captures } = bucketByHour([at, secondMonitor]);
    expect(captures).toBe(1);
    expect(hours[11].total).toBe(1);
  });

  it("keeps distinct users at the same instant separate", () => {
    const a = shot("u1", 11, "productive");
    const b: ShotRow = { ...a, user_id: "u2", shot_id: "u2-11" };
    const { hours, captures } = bucketByHour([a, b]);
    expect(captures).toBe(2);
    expect(hours[11].total).toBe(2);
  });

  it("splits by the server's category, with unknowns falling to neutral", () => {
    const { hours } = bucketByHour([
      shot("u1", 8, "productive"),
      shot("u2", 8, "distracting"),
      shot("u3", 8, "neutral"),
      shot("u4", 8, "something-new-from-the-server"),
    ]);
    expect(hours[8].productive).toBe(1);
    expect(hours[8].distracting).toBe(1);
    // An unrecognised category must degrade, never crash or vanish from the total.
    expect(hours[8].neutral).toBe(2);
    expect(hours[8].total).toBe(4);
  });

  it("category counts always sum to the hour's total", () => {
    const { hours } = bucketByHour([
      shot("u1", 16, "productive"),
      shot("u2", 16, "distracting"),
      shot("u3", 16, "neutral"),
    ]);
    const h = hours[16];
    expect(h.productive + h.neutral + h.distracting).toBe(h.total);
  });

  /**
   * **The bug this filter exists for.** The endpoint partitions on the *UTC* date, so the reads for
   * one local day span two partitions. Bucketing everything they return put the neighbouring day's
   * captures on the chart — at UTC+5:30 the next morning's work appeared at the far left, reading
   * as though someone had been at their desk at 4am on the day you selected.
   */
  it("keeps only the selected local day when the read spans two UTC partitions", () => {
    const neighbour = shot("u1", 4, "productive");
    neighbour.captured_at = new Date(2026, 7, 11, 4, 0).getTime(); // the *next* local day
    const { hours, captures } = bucketByHour(
      [shot("u1", 10, "productive"), neighbour],
      "2026-08-10",
    );
    expect(captures).toBe(1);
    expect(hours[10].total).toBe(1);
    expect(hours[4].total).toBe(0);
  });

  it("buckets everything when no local day is given", () => {
    const { captures } = bucketByHour([shot("u1", 10, "productive")]);
    expect(captures).toBe(1);
  });
});

describe("utcDatesFor", () => {
  /** Whatever the runner's timezone, the partitions must cover the whole local day. */
  it("covers local midnight and local end-of-day", () => {
    const dates = utcDatesFor("2026-08-10");
    const start = new Date("2026-08-10T00:00:00");
    const end = new Date(start.getTime() + 86_400_000 - 1);
    expect(dates).toContain(start.toISOString().slice(0, 10));
    expect(dates).toContain(end.toISOString().slice(0, 10));
    // One partition on UTC, two on every other offset — never more.
    expect(dates.length).toBe(new Date().getTimezoneOffset() === 0 ? 1 : 2);
  });

  it("degrades to the given date rather than throwing on junk", () => {
    expect(utcDatesFor("not-a-date")).toEqual(["not-a-date"]);
  });

  it("localDateOf agrees with the buckets' own notion of a local day", () => {
    const ms = new Date(2026, 7, 10, 23, 30).getTime();
    expect(localDateOf(ms)).toBe("2026-08-10");
  });
});
