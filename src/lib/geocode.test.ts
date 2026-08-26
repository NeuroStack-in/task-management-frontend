import { afterEach, describe, expect, it, vi } from "vitest";

import { geocode } from "./geocode";

/**
 * The parsing guard, not the network.
 *
 * Nominatim returns `lat`/`lon` as STRINGS, and a row that fails to parse would otherwise become
 * `NaN` and move the office perimeter to nowhere — a pin that silently vanishes off the map and
 * takes every employee's on-site status with it. Dropping the row is the only safe answer.
 */
function mockJson(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, json: async () => body }),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("geocode", () => {
  it("maps a well-formed result", async () => {
    mockJson([{ display_name: "Chennai, India", lat: "13.08", lon: "80.27" }]);
    // Query varies per test: results are cached by query, so reusing one would hit the cache.
    const r = await geocode("chennai india");
    expect(r).toEqual([{ label: "Chennai, India", lat: 13.08, lng: 80.27 }]);
  });

  it("drops rows whose coordinates are not numbers", async () => {
    mockJson([
      { display_name: "Good", lat: "1.5", lon: "2.5" },
      { display_name: "Bad lat", lat: "not-a-number", lon: "2.5" },
      { display_name: "Missing lon", lat: "1.5" },
      { lat: "1.5", lon: "2.5" }, // no label
    ]);
    const r = await geocode("mixed quality rows");
    expect(r.map((x) => x.label)).toEqual(["Good"]);
  });

  /** Too short to mean anything — must not even reach the network, given the 1 req/sec policy. */
  it("does not call out for a query under three characters", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    expect(await geocode("ch")).toEqual([]);
    expect(await geocode("  ")).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  /** Never throws: a failed lookup leaves the admin dragging the pin, not staring at an error. */
  it("returns empty on a non-ok response, a bad shape, or a thrown fetch", async () => {
    mockJson([], false);
    expect(await geocode("not ok response")).toEqual([]);

    mockJson({ unexpected: "object" });
    expect(await geocode("wrong shape entirely")).toEqual([]);

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await geocode("network is down")).toEqual([]);
  });

  it("serves a repeated query from cache without a second request", async () => {
    const spy = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => [{ display_name: "Cached", lat: "1", lon: "2" }],
      });
    vi.stubGlobal("fetch", spy);
    await geocode("repeated office address");
    await geocode("REPEATED OFFICE ADDRESS"); // normalised, so the same key
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
