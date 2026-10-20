/**
 * "Needs attention" — the pure rules behind the Analytics hub's one answer to "what needs my
 * attention on this day" (UX audit 2026-10-16, MON-03 / MON-04 / MON-06).
 *
 * The audit counted six attention signals in four places, each with its own window and rule, none
 * linked. This module is where they are combined, so every rule is written once and pinned by a
 * test rather than re-derived per card:
 *
 *  - **Captures awaiting review** — the AI's flags nobody has confirmed or dismissed
 *    (`awaitsReview`, the Screenshots tab's own rule).
 *  - **Alerts** — the server's anomaly rules (`GET /v1/insights/attention`): overtime, idle time, a
 *    sharp drop below someone's usual, a run of long days, policy. Its `flagged` list is everyone
 *    a rule fired for, each with the rule's own account of why ({@link alertsFrom}).
 *  - **Low scores** — the day's productivity score under {@link LOW_SCORE_BELOW}, from the org day
 *    rollup, which already applies the server's volume floor (a four-minute day has no score).
 *  - **Agents not reporting** — live devices that have been silent since before the last workday.
 *
 * Every figure is the server's; nothing here estimates a value it doesn't have.
 */
import type {
  AttentionList,
  PersonScore,
  ScoreBreakdown,
  ShotRow,
} from "../services/insights.service";
import { awaitsReview } from "../services/insights.service";
import { LOW_SCORE_BELOW } from "./thresholds";

/**
 * Below this a day's score needs attention. It is the server's own cut — the attention list's
 * weight (`attention_list::attention_weight`) and the executive report's "needs attention" both use
 * 60 — so the hub cannot disagree with them about who is low. Defined once, in `lib/thresholds`
 * (UX audit MON-18); re-exported here for the callers that already import it from this module.
 */
export { LOW_SCORE_BELOW };

// ── severity ─────────────────────────────────────────────────────────────────────────────────────

export type Severity = "high" | "medium" | "low";

/** `top_severity` from the wire, or `null` for empty/unknown — an unknown value degrades, never crashes. */
export function severityOf(raw: string | undefined | null): Severity | null {
  return raw === "high" || raw === "medium" || raw === "low" ? raw : null;
}

export const SEVERITY_RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };

export const SEVERITY_LABEL: Record<Severity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

// ── anomaly reasons ──────────────────────────────────────────────────────────────────────────────

/**
 * The server's anomaly types (`anomaly_detect::rules`) in plain words. The thresholds behind them
 * are tunable per organization, so the wording names the rule, never a number it may not use.
 */
const ANOMALY_REASON: Record<string, string> = {
  inactivity: "Score fell well below their usual",
  overtime: "Worked past the overtime threshold",
  idle: "Long active time with little keyboard or mouse input",
  burnout: "Several long days in a row",
  policy: "Blocked app or site attempts, or most time in apps your rules call distracting",
};

/** One anomaly type in plain words; an unknown type is shown humanised rather than dropped. */
export function anomalyReason(type: string): string {
  const known = ANOMALY_REASON[type];
  if (known) return known;
  const t = type.replace(/_/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Anomaly";
}

// ── alerts ───────────────────────────────────────────────────────────────────────────────────────

/** One rule that fired for someone. */
export interface PersonAlert {
  /** The server's type slug — `overtime`, `idle`, … */
  type: string;
  /** {@link anomalyReason} of `type`. */
  label: string;
  /** This rule's own severity; `null` from an older server, which sent only the person's highest. */
  severity: Severity | null;
  /** The rule's own account, with the figure and the org's threshold; `null` from an older server. */
  detail: string | null;
}

/** One person a rule fired for. */
export interface AlertRow {
  userId: string;
  name: string;
  /** The highest severity among their alerts. */
  severity: Severity | null;
  alerts: PersonAlert[];
}

export interface AlertsData {
  rows: AlertRow[];
  /**
   * The server's ranking was capped and may have left flagged people out — only from a server that
   * predates `flagged`, whose list was the eight most urgent of the fifteen lowest scorers.
   */
  capped: boolean;
}

/** How many ranked rows an older server returned at most (`attention_list::TOP_N`). */
export const ATTENTION_ROWS_CAP = 8;

/**
 * The day's alerts from `GET /v1/insights/attention` (UX audit MON-06).
 *
 * `flagged` is **everyone** a rule fired for, each flag with its detail. A server that predates it
 * sends only the ranked `people` — scored people, capped, with the rule types but no detail — so
 * that is used instead and marked `capped` when it is full.
 */
export function alertsFrom(list: Pick<AttentionList, "people" | "flagged">): AlertsData {
  if (Array.isArray(list.flagged)) {
    return {
      capped: false,
      rows: list.flagged
        .filter((p) => p.flags.length > 0)
        .map((p) => ({
          userId: p.user_id,
          name: p.name,
          severity: severityOf(p.top_severity) ?? "low",
          alerts: p.flags.map((f) => ({
            type: f.anomaly_type,
            label: anomalyReason(f.anomaly_type),
            severity: severityOf(f.severity),
            detail: f.detail.trim() || null,
          })),
        })),
    };
  }
  const people = list.people ?? [];
  return {
    capped: people.length >= ATTENTION_ROWS_CAP,
    rows: people
      .filter((r) => r.anomaly_count > 0)
      .map((r) => ({
        userId: r.user_id,
        name: r.name,
        severity: severityOf(r.top_severity) ?? "low",
        alerts: [...new Set(r.reasons)].map((type) => ({
          type,
          label: anomalyReason(type),
          severity: null,
          detail: null,
        })),
      })),
  };
}

// ── what drove a score ───────────────────────────────────────────────────────────────────────────

export type DriverKey = "u" | "q" | "f" | "r";

export interface ScoreDriver {
  key: DriverKey;
  label: string;
  /** 0–100, rounded. */
  value: number;
}

/**
 * The four parts of a productivity score, weakest first — what pulled it down (or, read from the
 * other end, what held it up).
 *
 * **Quality is left out when it wasn't measured** (`q_measured === false`): the server reports `0`
 * there, which would read as "all distracting" when it was an instrumentation gap. When it was
 * measured it says where it came from — the AI's grading of the day's screenshots, or the org's app
 * rules — because those are not the same kind of evidence.
 */
export function scoreDrivers(b: ScoreBreakdown): ScoreDriver[] {
  const out: ScoreDriver[] = [
    { key: "u", label: "Utilisation", value: Math.round(b.u) },
    { key: "f", label: "Focus", value: Math.round(b.f) },
    { key: "r", label: "Reliability", value: Math.round(b.r) },
  ];
  if (b.q_measured !== false) {
    out.push({
      key: "q",
      label: b.q_ai_scored ? "Quality (AI-graded)" : "Quality (app rules)",
      value: Math.round(b.q),
    });
  }
  return out.sort((a, z) => a.value - z.value);
}

/** Mean of several days' breakdowns, for a week's "what drove it". `null` with no day to average. */
export function meanBreakdown(days: ScoreBreakdown[]): ScoreBreakdown | null {
  if (days.length === 0) return null;
  const avg = (pick: (b: ScoreBreakdown) => number) =>
    days.reduce((s, b) => s + pick(b), 0) / days.length;
  // Quality only over the days it was measured, for the reason `scoreDrivers` gives.
  const measured = days.filter((b) => b.q_measured !== false);
  return {
    score: Math.round(avg((b) => b.score)),
    u: avg((b) => b.u),
    f: avg((b) => b.f),
    r: avg((b) => b.r),
    q: measured.length ? measured.reduce((s, b) => s + b.q, 0) / measured.length : 0,
    q_measured: measured.length > 0,
    // "AI-graded" only when every measured day was — a mixed week is not an AI-graded one.
    q_ai_scored: measured.length > 0 && measured.every((b) => b.q_ai_scored === true),
  };
}

// ── captures awaiting review ─────────────────────────────────────────────────────────────────────

export interface FlagCount {
  /** Captures the AI flagged that nobody has confirmed or dismissed. */
  open: number;
  /** Frames the AI has analysed, of `read`. */
  analysed: number;
  /** Frames actually read (one row per monitor frame, as the Screenshots tab counts them). */
  read: number;
  /** Open flags per person. */
  byUser: Map<string, number>;
}

/** Count the day's open flags, per person, over the frames that were read. */
export function countOpenFlags(shots: Pick<ShotRow, "user_id" | "flagged" | "human_review" | "reviewed">[]): FlagCount {
  const byUser = new Map<string, number>();
  let open = 0;
  let analysed = 0;
  for (const s of shots) {
    if (s.reviewed === true) analysed += 1;
    if (!awaitsReview(s)) continue;
    open += 1;
    byUser.set(s.user_id, (byUser.get(s.user_id) ?? 0) + 1);
  }
  return { open, analysed, read: shots.length, byUser };
}

// ── agents not reporting ─────────────────────────────────────────────────────────────────────────

/** The fleet fields the rule reads — a subset of `ApiDevice`, every one guarded. */
export interface SilenceDevice {
  agent_id: string;
  hostname?: string;
  user_id?: string;
  assigned_user_id?: string;
  last_heartbeat: number;
  connectivity?: string;
  state?: string;
}

export interface SilentDevice {
  agentId: string;
  hostname: string;
  userId: string | null;
  lastHeartbeat: number;
}

/**
 * Live devices silent since before `cutoffMs` — the start of the org's last workday, so a laptop
 * switched off for the weekend is not "not reporting" on Monday morning, while one that missed a
 * whole working day is.
 *
 * Retired devices (deactivated / released / revoked) are never silent: they are meant to be quiet.
 * A device currently online is never silent, whatever its last heartbeat says.
 */
export function silentDevices(devices: SilenceDevice[], cutoffMs: number): SilentDevice[] {
  return devices
    .filter((d) => !d.state || d.state === "active")
    .filter((d) => d.connectivity !== "online" && d.connectivity !== "idle")
    .filter((d) => d.last_heartbeat < cutoffMs)
    .map((d) => ({
      agentId: d.agent_id,
      hostname: d.hostname ?? "",
      userId: d.assigned_user_id || d.user_id || null,
      lastHeartbeat: d.last_heartbeat,
    }))
    .sort((a, b) => a.lastHeartbeat - b.lastHeartbeat);
}

/** Local midnight at the start of `iso` (`YYYY-MM-DD`), as epoch ms. */
export function startOfLocalDay(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1).getTime();
}

// ── one row per person ───────────────────────────────────────────────────────────────────────────

export interface AttentionPerson {
  userId: string;
  name: string;
  /** The highest anomaly severity, or `null` when no anomaly fired for them. */
  severity: Severity | null;
  /** The rules that fired, most severe first, each with its detail when the server sent one. */
  alerts: PersonAlert[];
  /** The day's score, when it was below {@link LOW_SCORE_BELOW}. */
  lowScore: number | null;
  /** What pulled that score down, weakest first — only alongside `lowScore`. */
  drivers: ScoreDriver[];
  /** Captures awaiting review for them that day. */
  openFlags: number;
  /** Epoch ms of their silent device's last heartbeat, when one has gone quiet. */
  silentSince: number | null;
}

export interface AttentionInputs {
  /** The day's alerts — {@link alertsFrom}. */
  alerts?: AlertRow[] | null;
  /** The org day rollup's people — the complete roster, with a breakdown only for scored days. */
  people?: PersonScore[] | null;
  flags?: FlagCount | null;
  silent?: SilentDevice[] | null;
}

/**
 * Merge every signal into one row per person, most urgent first: alert severity, then captures
 * awaiting review, then the lowest score, then a silent agent.
 *
 * Names come from the rollup's roster (every active employee), then the attention row; someone in
 * neither — a capture or device whose owner left — reads as `unknownName`, never a raw id.
 */
export function buildAttentionPeople(
  { alerts, people, flags, silent }: AttentionInputs,
  unknownName = "Someone outside your directory",
): AttentionPerson[] {
  const nameOf = new Map<string, string>();
  for (const p of people ?? []) if (p.name) nameOf.set(p.user_id, p.name);
  for (const a of alerts ?? []) if (a.name && !nameOf.has(a.userId)) nameOf.set(a.userId, a.name);

  const rows = new Map<string, AttentionPerson>();
  const row = (userId: string): AttentionPerson => {
    let r = rows.get(userId);
    if (!r) {
      r = {
        userId,
        name: nameOf.get(userId) ?? unknownName,
        severity: null,
        alerts: [],
        lowScore: null,
        drivers: [],
        openFlags: 0,
        silentSince: null,
      };
      rows.set(userId, r);
    }
    return r;
  };

  for (const a of alerts ?? []) {
    if (a.alerts.length === 0) continue;
    const r = row(a.userId);
    r.severity = a.severity ?? "low";
    r.alerts = a.alerts;
  }
  for (const p of people ?? []) {
    const b = p.breakdown;
    if (!b || b.score >= LOW_SCORE_BELOW) continue;
    const r = row(p.user_id);
    r.lowScore = Math.round(b.score);
    r.drivers = scoreDrivers(b);
  }
  for (const [userId, n] of flags?.byUser ?? []) {
    if (n > 0) row(userId).openFlags = n;
  }
  for (const d of silent ?? []) {
    if (!d.userId) continue;
    const r = row(d.userId);
    // The quietest device speaks for the person.
    r.silentSince = r.silentSince === null ? d.lastHeartbeat : Math.min(r.silentSince, d.lastHeartbeat);
  }

  const sevRank = (r: AttentionPerson) => (r.severity ? SEVERITY_RANK[r.severity] : 0);
  return [...rows.values()].sort(
    (a, b) =>
      sevRank(b) - sevRank(a) ||
      b.openFlags - a.openFlags ||
      (a.lowScore ?? 101) - (b.lowScore ?? 101) ||
      Number(b.silentSince !== null) - Number(a.silentSince !== null) ||
      a.name.localeCompare(b.name),
  );
}

// ── names without ids ────────────────────────────────────────────────────────────────────────────

/**
 * The one person `name` (and, when given, `score`) can mean — or `null` when it could be more than
 * one, or nobody.
 *
 * The department summary's `PersonStat` and the executive report's `NamedScore` carry a `user_id`
 * now (MON-04); this is the fallback for a server that predates it, which named people without one.
 * A link must point at the right person or not exist, so an ambiguous name stays plain text rather
 * than guessing between two people who share it.
 */
export function resolvePerson<T extends { user_id: string; name: string }>(
  name: string,
  candidates: T[],
  scoreOf?: (c: T) => number | null,
  score?: number,
): T | null {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  let matches = candidates.filter((c) => c.name.trim().toLowerCase() === key);
  if (matches.length > 1 && score !== undefined && scoreOf) {
    matches = matches.filter((c) => {
      const s = scoreOf(c);
      return s !== null && Math.round(s) === Math.round(score);
    });
  }
  return matches.length === 1 ? matches[0] : null;
}
