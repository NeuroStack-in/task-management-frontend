import { describe, expect, it } from "vitest";
import {
  COMMON_ZONES,
  pickerZones,
  canonicalZone,
  currentOffsetMinutes,
  formatOffset,
  searchZones,
  serverResolves,
  zoneParts,
} from "./timezones";

const JAN = new Date(Date.UTC(2026, 0, 15, 12));
const JUL = new Date(Date.UTC(2026, 6, 15, 12));

describe("serverResolves (UX audit SET-16)", () => {
  it("is false for an unset timezone — the org runs on UTC", () => {
    expect(serverResolves("")).toBe(false);
    expect(serverResolves("   ")).toBe(false);
  });

  it("reads every zone the picker offers, old names, and any letter case", () => {
    for (const z of pickerZones()) expect(serverResolves(z)).toBe(true);
    expect(serverResolves("Asia/Calcutta")).toBe(true);
    expect(serverResolves("Etc/UTC")).toBe(true);
    expect(serverResolves("asia/kolkata")).toBe(true);
  });

  it("reads sign-up's fixed-offset labels, including the U+2212 minus", () => {
    expect(serverResolves("(GMT+05:30) India Standard")).toBe(true);
    expect(serverResolves("(GMT−08:00) Pacific Time")).toBe(true);
    expect(serverResolves("UTC+5")).toBe(true);
    expect(serverResolves("+0530")).toBe(true);
    expect(serverResolves("(GMT) London")).toBe(true);
  });

  // The server read a ~80-zone table until 2026-10-20; it reads the whole IANA database now.
  it("reads zones the old server table didn't hold", () => {
    expect(serverResolves("Africa/Cairo")).toBe(true);
    expect(serverResolves("Asia/Yangon")).toBe(true);
    expect(serverResolves("Pacific/Chatham")).toBe(true);
  });

  it("is false for a name that is no timezone — the org would close on UTC", () => {
    expect(serverResolves("Mars/Olympus_Mons")).toBe(false);
    expect(serverResolves("garbage")).toBe(false);
  });
});

describe("offsets", () => {
  it("formats minutes as a UTC offset", () => {
    expect(formatOffset(330)).toBe("UTC+5:30");
    expect(formatOffset(0)).toBe("UTC");
    expect(formatOffset(-480)).toBe("UTC−8");
    expect(formatOffset(null)).toBe("");
  });

  it("follows daylight saving for the date asked about", () => {
    expect(currentOffsetMinutes("Asia/Kolkata", JAN)).toBe(330);
    expect(currentOffsetMinutes("America/New_York", JAN)).toBe(-300);
    expect(currentOffsetMinutes("America/New_York", JUL)).toBe(-240);
    expect(currentOffsetMinutes("UTC", JUL)).toBe(0);
  });
});

describe("zoneParts / canonicalZone", () => {
  it("names the city and region", () => {
    expect(zoneParts("America/Argentina/Buenos_Aires")).toEqual({
      city: "Buenos Aires",
      region: "America · Argentina",
    });
    expect(zoneParts("UTC").city).toBe("UTC");
  });

  it("folds old names onto the zone the picker lists", () => {
    expect(canonicalZone("Asia/Calcutta")).toBe("Asia/Kolkata");
    expect(canonicalZone("Europe/Paris")).toBe("Europe/Paris");
  });
});

describe("pickerZones", () => {
  it("offers every zone the browser knows, once each, under today's names", () => {
    const zones = pickerZones();
    expect(zones.length).toBeGreaterThan(COMMON_ZONES.length);
    expect(new Set(zones).size).toBe(zones.length);
    expect(zones).toContain("UTC");
    expect(zones).toContain("Asia/Kolkata");
    expect(zones).toContain("Africa/Cairo");
    expect(zones).not.toContain("Asia/Calcutta");
  });
});

describe("searchZones", () => {
  const zones = [...COMMON_ZONES, "Africa/Cairo", "Asia/Yangon"];

  it("lists every zone, by offset, when nothing is typed", () => {
    const list = searchZones("", { now: JAN, zones });
    expect(list).toHaveLength(zones.length);
    expect(list[0].offset).toBeLessThanOrEqual(list[list.length - 1].offset ?? 0);
  });

  it("matches a city, a zone id and an offset", () => {
    expect(searchZones("kolkata", { now: JAN, zones }).map((o) => o.id)).toEqual(["Asia/Kolkata"]);
    expect(searchZones("buenos", { now: JAN, zones })[0].id).toBe("America/Argentina/Buenos_Aires");
    expect(searchZones("+5:30", { now: JAN, zones }).map((o) => o.id)).toContain("Asia/Colombo");
    expect(searchZones("cairo", { now: JAN, zones }).map((o) => o.id)).toEqual(["Africa/Cairo"]);
  });
});
