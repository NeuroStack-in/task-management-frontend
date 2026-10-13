import { describe, expect, it } from "vitest";

import { lastWorkdayBefore, weekStartIso, weekStartOf, weekWorkdays } from "./week";
import type { IsoWeekday } from "@/lib/workdays";

const MON_FRI: IsoWeekday[] = [1, 2, 3, 4, 5];
const SUN_THU: IsoWeekday[] = [7, 1, 2, 3, 4];
const MON_SAT: IsoWeekday[] = [1, 2, 3, 4, 5, 6];

// 2026-10-04 is a Sunday; 2026-10-08 a Thursday; 2026-10-10 a Saturday.

describe("weekStartOf", () => {
  it("starts a Mon–Fri week on Monday", () => {
    expect(weekStartOf(MON_FRI)).toBe(1);
  });

  it("starts a Sun–Thu week on Sunday, not Monday", () => {
    expect(weekStartOf(SUN_THU)).toBe(7);
  });

  it("starts six- and seven-day weeks on Monday", () => {
    expect(weekStartOf(MON_SAT)).toBe(1);
    expect(weekStartOf([1, 2, 3, 4, 5, 6, 7])).toBe(1);
  });
});

describe("weekWorkdays", () => {
  it("gives a Sun–Thu org its own week — not Mon–Thu plus the following Sunday", () => {
    expect(weekWorkdays("2026-10-08", SUN_THU)).toEqual([
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
    ]);
  });

  it("includes a six-day org's Saturday", () => {
    expect(weekWorkdays("2026-10-08", MON_SAT)).toContain("2026-10-10");
  });

  it("keeps a Mon–Fri Sunday in the week that started the Monday before", () => {
    expect(weekStartIso("2026-10-11", 1)).toBe("2026-10-05");
    expect(weekWorkdays("2026-10-11", MON_FRI)).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
    ]);
  });
});

describe("lastWorkdayBefore", () => {
  it("skips the org's own days off", () => {
    // Sunday the 11th: Mon–Fri looks back to Friday; Sun–Thu to Thursday.
    expect(lastWorkdayBefore("2026-10-11", MON_FRI)).toBe("2026-10-09");
    expect(lastWorkdayBefore("2026-10-11", SUN_THU)).toBe("2026-10-08");
  });

  it("is strictly before today", () => {
    expect(lastWorkdayBefore("2026-10-08", MON_FRI)).toBe("2026-10-07");
  });
});
