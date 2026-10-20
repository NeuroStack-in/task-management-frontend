import { describe, expect, it } from "vitest";
import { serverFlagCount } from "./use-attention";

/** MON-03: "Awaiting review" from the server's whole-day count, not a 1,200-frame sample. */
describe("serverFlagCount", () => {
  it("reads the whole-day count, per person, as exact", () => {
    const c = serverFlagCount({
      date: "2026-10-16",
      shots: [],
      total: 41_000,
      analysed: 39_500,
      flagged_open: 37,
      flagged_open_by_user: { u1: 30, u2: 7 },
    });
    expect(c).not.toBeNull();
    expect(c!.open).toBe(37);
    expect(c!.analysed).toBe(39_500);
    expect(c!.read).toBe(41_000);
    expect(c!.total).toBe(41_000);
    expect(c!.truncated).toBe(false);
    expect([...c!.byUser]).toEqual([
      ["u1", 30],
      ["u2", 7],
    ]);
  });

  it("is null for a server that predates the counts — the caller pages instead", () => {
    expect(serverFlagCount({ date: "2026-10-16", shots: [], total: 12 })).toBeNull();
  });

  it("counts zero open flags as a real zero, with nobody listed", () => {
    const c = serverFlagCount({
      date: "2026-10-16",
      shots: [],
      total: 10,
      analysed: 10,
      flagged_open: 0,
      flagged_open_by_user: {},
    });
    expect(c!.open).toBe(0);
    expect(c!.byUser.size).toBe(0);
  });
});
