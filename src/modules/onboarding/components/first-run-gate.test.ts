import { describe, expect, it } from "vitest";
import { complete, type Details } from "./first-run-gate";

const full: Details = {
  phone: "+919629287989",
  location: "Chengalpattu",
  dateOfBirth: "2005-06-24",
  workMode: "on-site",
};

/**
 * This predicate decides whether somebody is stopped on the way into the app. Wrong in one
 * direction it detains people who have already answered; wrong in the other it lets the gap it
 * exists to close stay open, silently, forever.
 */
describe("profile completeness", () => {
  it("passes a filled record", () => {
    expect(complete(full)).toBe(true);
  });

  it("requires every one of the four", () => {
    for (const k of Object.keys(full) as (keyof Details)[]) {
      expect(complete({ ...full, [k]: "" }), k).toBe(false);
    }
  });

  it("does not accept a country code as a phone number", () => {
    // `PhoneInput` emits `+91` for a country picked with no digits typed. Non-empty, and not a
    // phone number — a `.length > 0` check would have called this record complete.
    expect(complete({ ...full, phone: "+91" })).toBe(false);
    expect(complete({ ...full, phone: "+" })).toBe(false);
    // A bare local number, as the older rows hold, is fine: it is a real number.
    expect(complete({ ...full, phone: "9629287989" })).toBe(true);
  });

  it("does not accept whitespace as a location", () => {
    expect(complete({ ...full, location: "   " })).toBe(false);
  });
});
