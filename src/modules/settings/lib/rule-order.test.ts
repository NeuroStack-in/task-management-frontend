import { describe, expect, it } from "vitest";

import { insertRule, matchesAnyRule, shadowedBy, unshadow } from "./rule-order";

const m = (r: { p: string }) => r.p;
const rules = (...ps: string[]) => ps.map((p) => ({ p }));
const names = (list: { p: string }[]) => list.map((r) => r.p);

/**
 * WP-342. Matching is case-insensitive substring, first match wins, in list order — the same rule
 * the agents (`rules::classify_focus`) and the server (`AppUrlRules::classify`) apply.
 */
describe("rule order", () => {
  it("puts a more specific rule above the general one that would catch it first", () => {
    expect(names(insertRule(rules("chrome", "notepad", "slack"), { p: "notepad++" }, m))).toEqual([
      "chrome",
      "notepad++",
      "notepad",
      "slack",
    ]);
    expect(
      names(insertRule(rules("google.com"), { p: "calendar.google.com" }, m)),
    ).toEqual(["calendar.google.com", "google.com"]);
  });

  it("appends a rule nothing shadows, and ignores case", () => {
    expect(names(insertRule(rules("Notepad++"), { p: "notepad" }, m))).toEqual([
      "Notepad++",
      "notepad",
    ]);
    expect(names(insertRule(rules("NOTEPAD"), { p: "notepad++" }, m))).toEqual([
      "notepad++",
      "NOTEPAD",
    ]);
  });

  it("names the earlier rule that makes a later one unreachable", () => {
    expect(shadowedBy(rules("notepad", "chrome", "notepad++", "", "chrome"), m)).toEqual([
      null,
      null,
      "notepad",
      null,
      "chrome",
    ]);
  });

  it("moves a shadowed rule just above the rule that catches it", () => {
    const list = rules("chrome", "notepad", "slack", "notepad++");
    const fixed = unshadow(list, 3, m);
    expect(names(fixed)).toEqual(["chrome", "notepad++", "notepad", "slack"]);
    expect(shadowedBy(fixed, m).every((s) => s === null)).toBe(true);
  });

  it("matches reported app names the way the agents do", () => {
    const apps = [{ process_name: "slack" }, { process_name: "" }];
    const urls = [{ domain: "youtube.com" }];
    expect(matchesAnyRule("Slack.exe", apps, urls)).toBe(true);
    expect(matchesAnyRule("chrome — youtube.com/watch", apps, urls)).toBe(true);
    expect(matchesAnyRule("figma", apps, urls)).toBe(false);
  });
});
