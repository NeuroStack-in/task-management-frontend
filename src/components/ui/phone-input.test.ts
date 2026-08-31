import { describe, expect, it } from "vitest";
import { parse } from "./phone-input";
import { COUNTRIES, countryFromDial } from "@/lib/countries";

describe("phone parsing", () => {
  it("splits a real E.164 number into country and national part", () => {
    expect(parse("+919941469980")).toEqual({
      country: expect.objectContaining({ iso: "IN", dial: "91" }),
      national: "9941469980",
    });
    // A live value from the pool — Nigeria, not India, which is the whole reason we do not guess.
    expect(parse("+2348169048886")).toEqual({
      country: expect.objectContaining({ iso: "NG", dial: "234" }),
      national: "8169048886",
    });
  });

  it("tolerates the spacing people actually type", () => {
    expect(parse("+91 90000 00000")).toEqual({
      country: expect.objectContaining({ iso: "IN" }),
      national: "9000000000",
    });
  });

  it("claims NO country for a bare local number", () => {
    // The pool holds these alongside E.164. Defaulting them to the org's country would relabel a
    // foreign number on open and write that lie back on save.
    for (const bare of ["9384603229", "883194684", "7304028315"]) {
      const p = parse(bare);
      expect(p.country, bare).toBeNull();
      expect(p.national, bare).toBe(bare);
    }
  });

  it("is empty for an empty value, rather than inventing a default", () => {
    expect(parse("")).toEqual({ country: null, national: "" });
    expect(parse("   ")).toEqual({ country: null, national: "" });
  });

  it("prefers the longest matching dial code", () => {
    // +1 would otherwise shadow nothing, but +9 must never win over +91 or +971.
    expect(countryFromDial("919941469980")?.iso).toBe("IN");
    expect(countryFromDial("971501234567")?.dial).toBe("971");
  });
});

describe("country list", () => {
  it("has no duplicate ISO codes", () => {
    const seen = new Set(COUNTRIES.map((c) => c.iso));
    expect(seen.size).toBe(COUNTRIES.length);
  });

  it("gives every country a name and a numeric dial code", () => {
    for (const c of COUNTRIES) {
      expect(c.name.length, c.iso).toBeGreaterThan(1);
      expect(c.iso, c.name).toMatch(/^[A-Z]{2}$/);
      expect(c.dial, c.name).toMatch(/^\d{1,4}$/);
    }
  });
});
