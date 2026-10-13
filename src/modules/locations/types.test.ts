import { describe, expect, it } from "vitest";

import { deriveMode, perimeterVerdict, type Geofence } from "./types";

/** A 500 m perimeter; one degree of latitude is ~111 km, so 0.027° north is ~3 km away. */
const fence: Geofence = { center: { lat: 12.97, lng: 77.59 }, radiusM: 500 };
const near = { lat: 12.971, lng: 77.59 }; // ~110 m from the centre
const far = { lat: 12.997, lng: 77.59 }; // ~3 km from the centre

describe("perimeterVerdict", () => {
  it("calls a point inside the radius inside", () => {
    expect(perimeterVerdict(near, 20, fence)).toBe("inside");
  });

  it("calls a precise fix beyond the radius outside", () => {
    expect(perimeterVerdict(far, 30, fence)).toBe("outside");
  });

  /** The audit case: IP-based positioning puts an office desktop 3 km away, ±5 km. */
  it("won't call a coarse fix outside when its accuracy reaches the perimeter", () => {
    expect(perimeterVerdict(far, 5000, fence)).toBe("uncertain");
  });

  it("treats a missing or nonsensical accuracy as an exact point", () => {
    expect(perimeterVerdict(far, Number.NaN, fence)).toBe("outside");
    expect(perimeterVerdict(far, -1, fence)).toBe("outside");
  });
});

describe("deriveMode", () => {
  it("leaves a fix too coarse to place without a mode, rather than calling it remote", () => {
    expect(deriveMode(far, fence, true, 5000)).toBeNull();
    expect(deriveMode(far, fence, true, 30)).toBe("remote");
    expect(deriveMode(near, fence, true, 30)).toBe("in-office");
  });

  it("has no mode with the perimeter off", () => {
    expect(deriveMode(near, fence, false)).toBeNull();
  });
});
