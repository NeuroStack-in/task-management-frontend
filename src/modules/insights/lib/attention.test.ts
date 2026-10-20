import { describe, expect, it } from "vitest";
import type { AttentionRow, PersonScore, ScoreBreakdown } from "../services/insights.service";
import {
  anomalyReason,
  buildAttentionPeople,
  countOpenFlags,
  meanBreakdown,
  resolvePerson,
  scoreDrivers,
  severityOf,
  silentDevices,
} from "./attention";

const b = (over: Partial<ScoreBreakdown> = {}): ScoreBreakdown => ({
  score: 50,
  u: 50,
  q: 50,
  f: 50,
  r: 50,
  ...over,
});

const person = (user_id: string, name: string, breakdown?: ScoreBreakdown): PersonScore => ({
  user_id,
  name,
  department_id: "d1",
  tracked_sec: 0,
  ...(breakdown ? { breakdown } : {}),
});

const alert = (over: Partial<AttentionRow>): AttentionRow => ({
  user_id: "u1",
  name: "Ada",
  score: 70,
  anomaly_count: 0,
  top_severity: "",
  reasons: [],
  attention: 0,
  ...over,
});

describe("severityOf", () => {
  it("passes the three server values and degrades anything else to null", () => {
    expect(severityOf("high")).toBe("high");
    expect(severityOf("low")).toBe("low");
    expect(severityOf("")).toBeNull();
    expect(severityOf("catastrophic")).toBeNull();
  });
});

describe("anomalyReason", () => {
  it("words the server's rule types without quoting thresholds an org may have changed", () => {
    expect(anomalyReason("overtime")).toBe("Worked past the overtime threshold");
    expect(anomalyReason("overtime")).not.toMatch(/\d/);
  });

  it("humanises an unknown type rather than dropping it", () => {
    expect(anomalyReason("night_owl")).toBe("Night owl");
  });
});

describe("scoreDrivers", () => {
  it("lists the parts weakest first", () => {
    const d = scoreDrivers(b({ u: 20, q: 80, f: 60, r: 40, q_ai_scored: true }));
    expect(d.map((x) => x.key)).toEqual(["u", "r", "f", "q"]);
    expect(d.find((x) => x.key === "q")?.label).toBe("Quality (AI-graded)");
  });

  it("leaves Quality out when it wasn't measured — the server's 0 there is a gap, not a verdict", () => {
    const d = scoreDrivers(b({ q: 0, q_measured: false }));
    expect(d.some((x) => x.key === "q")).toBe(false);
  });

  it("says when Quality came from app rules rather than the AI", () => {
    expect(scoreDrivers(b({ q_ai_scored: false })).find((x) => x.key === "q")?.label).toBe(
      "Quality (app rules)",
    );
  });
});

describe("meanBreakdown", () => {
  it("averages Quality only over the days it was measured", () => {
    const m = meanBreakdown([b({ q: 80 }), b({ q: 0, q_measured: false })]);
    expect(m?.q).toBe(80);
    expect(m?.q_measured).toBe(true);
  });

  it("calls a week AI-graded only when every measured day was", () => {
    expect(meanBreakdown([b({ q_ai_scored: true }), b({ q_ai_scored: false })])?.q_ai_scored).toBe(false);
    expect(meanBreakdown([b({ q_ai_scored: true }), b({ q_ai_scored: true })])?.q_ai_scored).toBe(true);
  });

  it("has nothing to say about no days", () => {
    expect(meanBreakdown([])).toBeNull();
  });
});

describe("countOpenFlags", () => {
  it("counts flags nobody handled, per person, and how much the AI has checked", () => {
    const c = countOpenFlags([
      { user_id: "u1", flagged: true, reviewed: true },
      { user_id: "u1", flagged: true, reviewed: true, human_review: "dismissed" },
      { user_id: "u2", flagged: true, reviewed: true, human_review: "confirmed" },
      { user_id: "u2", flagged: false, reviewed: false },
      { user_id: "u3", flagged: true, reviewed: true },
    ]);
    expect(c.open).toBe(2);
    expect(c.byUser.get("u1")).toBe(1);
    expect(c.byUser.has("u2")).toBe(false);
    expect(c.analysed).toBe(4);
    expect(c.read).toBe(5);
  });
});

describe("silentDevices", () => {
  const cutoff = new Date(2026, 9, 19).getTime();
  const dev = (over: Record<string, unknown>) => ({
    agent_id: "a1",
    last_heartbeat: cutoff - 1,
    connectivity: "offline",
    state: "active",
    user_id: "u1",
    ...over,
  });

  it("lists live devices silent since before the cut-off, quietest first", () => {
    const s = silentDevices(
      [dev({ agent_id: "a1" }), dev({ agent_id: "a2", last_heartbeat: cutoff - 10_000 })],
      cutoff,
    );
    expect(s.map((d) => d.agentId)).toEqual(["a2", "a1"]);
  });

  it("never counts a retired, online, or recently-heard device", () => {
    expect(
      silentDevices(
        [
          dev({ state: "released" }),
          dev({ state: "revoked" }),
          dev({ connectivity: "online" }),
          dev({ last_heartbeat: cutoff + 1 }),
        ],
        cutoff,
      ),
    ).toEqual([]);
  });

  it("attributes a managed device to its assigned employee", () => {
    expect(silentDevices([dev({ user_id: "", assigned_user_id: "u9" })], cutoff)[0].userId).toBe("u9");
  });
});

describe("buildAttentionPeople", () => {
  it("merges every signal into one row per person, most urgent first", () => {
    const rows = buildAttentionPeople({
      alerts: [
        alert({ user_id: "u1", name: "Ada", anomaly_count: 2, top_severity: "medium", reasons: ["overtime", "idle"] }),
        alert({ user_id: "u3", name: "Cy", anomaly_count: 1, top_severity: "high", reasons: ["burnout"] }),
        // A low score with no anomaly: not an alert.
        alert({ user_id: "u2", name: "Bo", score: 40 }),
      ],
      people: [
        person("u1", "Ada", b({ score: 80 })),
        person("u2", "Bo", b({ score: 40, u: 10, r: 30 })),
        person("u4", "Di"),
      ],
      flags: { open: 3, analysed: 10, read: 10, byUser: new Map([["u4", 3]]) },
      silent: [{ agentId: "a", hostname: "", userId: "u5", lastHeartbeat: 1 }],
    });
    expect(rows.map((r) => r.userId)).toEqual(["u3", "u1", "u4", "u2", "u5"]);

    const ada = rows.find((r) => r.userId === "u1")!;
    expect(ada.severity).toBe("medium");
    expect(ada.reasons).toEqual([anomalyReason("overtime"), anomalyReason("idle")]);
    expect(ada.lowScore).toBeNull(); // 80 is not low

    const bo = rows.find((r) => r.userId === "u2")!;
    expect(bo.severity).toBeNull();
    expect(bo.lowScore).toBe(40);
    expect(bo.drivers[0].key).toBe("u");

    expect(rows.find((r) => r.userId === "u4")!.openFlags).toBe(3);
    // Nobody on the roster or the alert list: never a raw id.
    expect(rows.find((r) => r.userId === "u5")!.name).toBe("Someone outside your directory");
  });

  it("is empty when nothing needs attention", () => {
    expect(
      buildAttentionPeople({ alerts: [], people: [person("u1", "Ada", b({ score: 90 }))] }),
    ).toEqual([]);
  });
});

describe("resolvePerson", () => {
  const roster = [
    { user_id: "u1", name: "Sam Lee", score: 40 },
    { user_id: "u2", name: "Sam Lee", score: 70 },
    { user_id: "u3", name: "Ana Diaz", score: 55 },
  ];
  const scoreOf = (c: (typeof roster)[number]) => c.score;

  it("finds the one person a name means", () => {
    expect(resolvePerson("ana diaz", roster)?.user_id).toBe("u3");
  });

  it("refuses to guess between two people who share a name", () => {
    expect(resolvePerson("Sam Lee", roster)).toBeNull();
  });

  it("uses the score to tell namesakes apart when it can", () => {
    expect(resolvePerson("Sam Lee", roster, scoreOf, 70)?.user_id).toBe("u2");
    expect(resolvePerson("Sam Lee", roster, scoreOf, 99)).toBeNull();
  });

  it("finds nobody for an unknown or empty name", () => {
    expect(resolvePerson("Zed", roster)).toBeNull();
    expect(resolvePerson("  ", roster)).toBeNull();
  });
});
