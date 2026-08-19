import { describe, expect, it } from "vitest";
import { rankWeek } from "./use-week-performers";
import type { PersonScore } from "./services/insights.service";

/** Minimal `PersonScore`; only `breakdown.score` participates in the ranking. */
const person = (user_id: string, name: string, score?: number): PersonScore =>
  ({
    user_id,
    name,
    department_id: "d1",
    ...(score === undefined
      ? {}
      : { breakdown: { score, u: 0, q: 0, f: 0, r: 0 } }),
  }) as PersonScore;

describe("rankWeek", () => {
  it("averages only the days a person was actually scored", () => {
    // Scored 80 and 60 on two days, absent from the feed on a third. The mean is 70, not 46.7 —
    // dividing by the whole week would turn a day the agent never reported into a bad week.
    const { topPerformers } = rankWeek([
      [person("u1", "Ada", 80)],
      [person("u1", "Ada", 60)],
      [person("u1", "Ada")],
    ]);
    expect(topPerformers).toEqual([{ name: "Ada", score: 70 }]);
  });

  it("never lists the same person in both cards", () => {
    // The bug this replaced: one scored person was simultaneously best and worst. Both of these are
    // below the threshold, so neither can be a top performer — worst first.
    const { topPerformers, needsAttention } = rankWeek([
      [person("u1", "Kishore M", 58), person("u2", "Bo", 40)],
    ]);
    expect(topPerformers).toEqual([]);
    expect(needsAttention.map((p) => p.name)).toEqual(["Bo", "Kishore M"]);

    const overlap = topPerformers.filter((t) =>
      needsAttention.some((n) => n.name === t.name),
    );
    expect(overlap).toEqual([]);
  });

  it("puts a lone below-threshold person in one list only, not both", () => {
    // The exact shape of the defect: a single scored person appeared as top performer AND as
    // needing attention. Split on the threshold, 58 can only be one of them.
    const { topPerformers, needsAttention, scoredPeople } = rankWeek([
      [person("u1", "Kishore M", 58)],
    ]);
    expect(scoredPeople).toBe(1);
    expect(topPerformers).toEqual([]);
    expect(needsAttention).toEqual([{ name: "Kishore M", score: 58 }]);
  });

  it("never calls a below-threshold person a top performer, even on a short roster", () => {
    // Taking "the top three" regardless of score made 55 a top performer here — and then hid them
    // from the attention list they belonged in.
    const { topPerformers, needsAttention } = rankWeek([
      [person("u1", "Ada", 90), person("u2", "Bo", 55)],
    ]);
    expect(topPerformers.map((p) => p.name)).toEqual(["Ada"]);
    expect(needsAttention.map((p) => p.name)).toEqual(["Bo"]);
  });

  it("flags only people below the threshold, worst first", () => {
    const { topPerformers, needsAttention } = rankWeek([
      [
        person("u1", "Ada", 90),
        person("u2", "Bo", 55),
        person("u3", "Cy", 30),
        person("u4", "Di", 70),
      ],
    ]);
    expect(topPerformers.map((p) => p.name)).toEqual(["Ada", "Di"]);
    expect(needsAttention.map((p) => p.name)).toEqual(["Cy", "Bo"]);
    expect(needsAttention.every((p) => p.score < 60)).toBe(true);
  });

  it("reports nobody when no one was scored all week", () => {
    const r = rankWeek([[person("u1", "Ada")], []]);
    expect(r).toEqual({ topPerformers: [], needsAttention: [], scoredPeople: 0 });
  });
});
