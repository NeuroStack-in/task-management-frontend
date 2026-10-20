import { describe, expect, it } from "vitest";
import {
  SERVER_ZONES,
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

  it("reads every zone the picker offers, and the aliases the server knows", () => {
    for (const z of SERVER_ZONES) expect(serverResolves(z)).toBe(true);
    expect(serverResolves("Asia/Calcutta")).toBe(true);
    expect(serverResolves("Etc/UTC")).toBe(true);
  });

  it("reads sign-up's fixed-offset labels, including the U+2212 minus", () => {
    expect(serverResolves("(GMT+05:30) India Standard")).toBe(true);
    expect(serverResolves("(GMT−08:00) Pacific Time")).toBe(true);
    expect(serverResolves("UTC+5")).toBe(true);
    expect(serverResolves("+0530")).toBe(true);
    expect(serverResolves("(GMT) London")).toBe(true);
  });

  it("is false for an IANA zone outside the server's table — it would close on UTC", () => {
    expect(serverResolves("Africa/Cairo")).toBe(false);
    expect(serverResolves("Asia/Yangon")).toBe(false);
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

describe("searchZones", () => {
  const all = [...SERVER_ZONES, "Asia/Calcutta", "Africa/Cairo", "Asia/Yangon"];

  it("lists only supported zones, by offset, when nothing is typed", () => {
    const list = searchZones("", { now: JAN, all });
    expect(list).toHaveLength(SERVER_ZONES.length);
    expect(list.every((o) => o.supported)).toBe(true);
    expect(list[0].offset).toBeLessThanOrEqual(list[list.length - 1].offset ?? 0);
  });

  it("matches a city, a zone id and an offset", () => {
    expect(searchZones("kolkata", { now: JAN, all }).map((o) => o.id)).toEqual(["Asia/Kolkata"]);
    expect(searchZones("buenos", { now: JAN, all })[0].id).toBe("America/Argentina/Buenos_Aires");
    expect(searchZones("+5:30", { now: JAN, all }).map((o) => o.id)).toContain("Asia/Colombo");
  });

  it("finds an unsupported zone while searching, flagged — never as a choice that saves", () => {
    const cairo = searchZones("cairo", { now: JAN, all });
    expect(cairo).toHaveLength(1);
    expect(cairo[0]).toMatchObject({ id: "Africa/Cairo", supported: false });
  });

  it("does not list an alias of a supported zone as unsupported", () => {
    expect(searchZones("calcutta", { now: JAN, all })).toEqual([]);
  });
});
