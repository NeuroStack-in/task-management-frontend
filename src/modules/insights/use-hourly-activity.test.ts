import { describe, expect, it } from "vitest";

import { bucketByHour } from "./use-hourly-activity";
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
});
