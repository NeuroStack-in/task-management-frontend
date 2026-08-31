import { describe, expect, it } from "vitest";
import { join, label12, split } from "./date-picker";

/**
 * These three carry the whole contract between the picker and the server: working hours are stored
 * as `"HH:MM"` in 24-hour time and read by the nightly attendance close for every tenant. A bug in
 * `join` would not throw — it would quietly write a plausible wrong hour, and the first symptom
 * would be everybody marked late.
 */
describe("time picker parts", () => {
  it("round-trips every minute of the day", () => {
    for (let h = 0; h < 24; h++) {
      for (const m of [0, 1, 30, 59]) {
        const iso = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        const p = split(iso);
        expect(p.h12, iso).not.toBeNull();
        expect(join(p.h12!, p.m!, p.ampm!), iso).toBe(iso);
      }
    }
  });

  it("gets the two hours everyone gets wrong right", () => {
    // Midnight is 12 AM, not 0 AM; noon is 12 PM, not 0 PM. Both round-trip.
    expect(split("00:00")).toEqual({ h12: 12, m: 0, ampm: "AM" });
    expect(split("12:00")).toEqual({ h12: 12, m: 0, ampm: "PM" });
    expect(join(12, 0, "AM")).toBe("00:00");
    expect(join(12, 0, "PM")).toBe("12:00");
    // ...and the boundaries either side of noon.
    expect(join(11, 59, "AM")).toBe("11:59");
    expect(join(1, 0, "PM")).toBe("13:00");
  });

  it("labels a stored time the way the field shows it", () => {
    expect(label12("09:00")).toBe("09:00 AM");
    expect(label12("18:00")).toBe("06:00 PM");
    expect(label12("00:30")).toBe("12:30 AM");
  });

  it("refuses to invent a time from junk", () => {
    // An unparseable value must stay visible rather than being silently shown as some other time.
    for (const bad of ["", "9", "25:00", "09:60", "nine", "09:00:00"]) {
      expect(split(bad), bad).toEqual({ h12: null, m: null, ampm: null });
      expect(label12(bad), bad).toBe(bad);
    }
  });
});
