import { describe, expect, it } from "vitest";
import {
  formatDuration,
  formatHours,
  formatMinutes,
  isUuid,
  personName,
  REMOVED_PERSON,
} from "./format";

/**
 * `format.ts` states the rule: "Opaque UUIDs are never shown in the UI." `personName` is where that
 * is enforced for people, after several call sites wrote `directory.find(...)?.name ?? id` and
 * rendered a bare Cognito `sub` — most visibly as two selectable "people" in the project-lead picker.
 */
describe("personName", () => {
  it("returns a real name unchanged", () => {
    expect(personName("Arshiya Sayyed")).toBe("Arshiya Sayyed");
  });

  it("trims, because a padded name is still a name", () => {
    expect(personName("  Balaji P  ")).toBe("Balaji P");
  });

  it("never renders a raw id when the directory has no record", () => {
    for (const missing of [undefined, null, "", "   "]) {
      expect(personName(missing)).toBe(REMOVED_PERSON);
    }
  });

  it("refuses a UUID even when handed one AS the name", () => {
    // Belt-and-braces: a server that ever echoes the id into the name field must not defeat this.
    const sub = "31539d4a-f011-707f-b79b-0c26b3e13abc";
    expect(isUuid(sub)).toBe(true);
    expect(personName(sub)).toBe(REMOVED_PERSON);
  });

  it("honours a caller's own fallback, for surfaces where absence means something else", () => {
    // A scope-limited directory (screenshots) means "not visible to you", not "deleted".
    expect(personName(undefined, "Outside your directory")).toBe(
      "Outside your directory",
    );
  });
});

/**
 * The product reports one elapsed time on several surfaces at once. These lock the notation the
 * three entry points share, because the bug they replaced was not arithmetic — every surface had the
 * right number and said it a different way, so `2:28:05`, `1:50` and `2.5h` looked like three
 * figures that disagreed.
 */
describe("duration notation", () => {
  it("is HH:MM:SS whichever unit the caller holds", () => {
    // The same instant, reached from seconds, hours and minutes.
    expect(formatDuration(8885)).toBe("02:28:05");
    expect(formatHours(8885 / 3600)).toBe("02:28:05");
    expect(formatMinutes(8885 / 60)).toBe("02:28:05");
  });

  it("pads every field, so a column of them lines up", () => {
    expect(formatDuration(0)).toBe("00:00:00");
    expect(formatDuration(59)).toBe("00:00:59");
    expect(formatDuration(3600)).toBe("01:00:00");
  });

  it("does not wrap past a day — hours accumulate", () => {
    // A team-week total is hundreds of hours; it must not read as 4 hours.
    expect(formatHours(100.5)).toBe("100:30:00");
  });

  /**
   * `6.8 * 3600` is `24480.000000000004`. Without rounding before the split, the seconds field
   * renders that fraction and the cell reads `06:48:0.000000004`.
   */
  it("survives the float multiply decimal hours arrive through", () => {
    expect(formatHours(6.8)).toBe("06:48:00");
    expect(formatHours(2.5)).toBe("02:30:00");
  });

  it("floors at zero rather than rendering a negative clock", () => {
    // Clock skew can make an elapsed-since-start briefly negative.
    expect(formatDuration(-5)).toBe("00:00:00");
  });
});
