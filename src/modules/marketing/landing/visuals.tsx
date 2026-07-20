/* ============================================================= *
 *  WorkPulse — Landing product visuals (warm & light)            *
 *  Clean, airy, zero-asset UI cards in the `.wp` palette.        *
 *  Presentational only (server-safe) — no hooks, no directive.   *
 *  SVG line draws animate when an ancestor gains `.wp-in`.        *
 * ============================================================= */

import {
  Activity,
  ArrowUpRight,
  Clock,
  Play,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { VisualKind } from "./content";

/* ---- shared bits ---- */
function StatChip({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "var(--wp-surface-2)" }}>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--wp-surface)", color: "var(--wp-accent-ink)" }}>
        <Icon className="size-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px]" style={{ color: "var(--wp-faint)" }}>{label}</span>
        <span className="block text-[13px] font-semibold leading-tight" style={{ color: "var(--wp-ink)" }}>{value}</span>
      </span>
    </div>
  );
}

function DeltaPill({ up, value }: { up: boolean; value: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: up ? "color-mix(in srgb, var(--wp-success) 14%, transparent)" : "color-mix(in srgb, var(--wp-danger) 14%, transparent)", color: up ? "var(--wp-success)" : "var(--wp-danger)" }}>
      {up ? "↑" : "↓"} {value}
    </span>
  );
}

/* ============================================================= *
 *  Hero visual — the airy product peek                           *
 * ============================================================= */
export function HeroVisual() {
  return (
    <div className="wp-in wp-card overflow-hidden p-5 sm:p-6" style={{ boxShadow: "var(--wp-shadow)" }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="wp-display text-lg" style={{ color: "var(--wp-ink)" }}>Hello, Alex</p>
          <p className="text-xs" style={{ color: "var(--wp-muted)" }}>Your organization at a glance</p>
        </div>
        <span className="inline-flex rounded-full p-0.5" style={{ background: "var(--wp-surface-2)" }}>
          {["Today", "Week", "Month"].map((t) => (
            <span key={t} className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={t === "Week" ? { background: "var(--wp-accent)", color: "#fff" } : { color: "var(--wp-muted)" }}>{t}</span>
          ))}
        </span>
      </div>

      {/* headline chart */}
      <div className="mt-5 rounded-2xl p-4" style={{ background: "var(--wp-surface-2)" }}>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs" style={{ color: "var(--wp-muted)" }}>Productivity score</p>
            <p className="wp-display mt-0.5 flex items-center gap-2 text-3xl" style={{ color: "var(--wp-ink)" }}>
              84% <DeltaPill up value="8%" />
            </p>
          </div>
          <span className="text-[11px]" style={{ color: "var(--wp-faint)" }}>Mon–Sun</span>
        </div>
        <svg viewBox="0 0 320 90" className="mt-2 w-full" fill="none" aria-hidden>
          <defs>
            <linearGradient id="hero-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--wp-accent)" stopOpacity="0.24" />
              <stop offset="100%" stopColor="var(--wp-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M4 64 C 44 60, 70 40, 104 44 C 140 48, 158 22, 196 30 C 234 38, 252 54, 288 40 C 304 34, 312 30, 316 28 L316 90 L4 90 Z" fill="url(#hero-area)" />
          <path d="M4 64 C 44 60, 70 40, 104 44 C 140 48, 158 22, 196 30 C 234 38, 252 54, 288 40 C 304 34, 312 30, 316 28" className="wp-draw" style={{ ["--len" as string]: 420 }} stroke="var(--wp-accent)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="196" cy="30" r="4" fill="var(--wp-accent)" stroke="var(--wp-surface)" strokeWidth="2" />
        </svg>
      </div>

      {/* mini stats */}
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <StatChip icon={Clock} label="Hours" value="4,477h" />
        <StatChip icon={Users} label="Attendance" value="92%" />
        <StatChip icon={Activity} label="Active" value="84%" />
      </div>

      {/* AI summary strip */}
      <div className="mt-3 flex items-start gap-2.5 rounded-2xl p-3" style={{ background: "var(--wp-accent-soft)" }}>
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--wp-accent)", color: "#fff" }}>
          <Sparkles className="size-3.5" />
        </span>
        <p className="text-[12px] leading-snug" style={{ color: "var(--wp-ink-2)" }}>
          <span className="font-semibold">AI summary · </span>
          Hours are steady this week and two projects moved forward. Three approvals are waiting on you.
        </p>
      </div>
    </div>
  );
}

/* ---- Hero companion — the "right now" cut, beside the at-a-glance card ---- *
 *  Deliberately a different slice from HeroVisual: that one is the org rolled  *
 *  up over a week, this one is the live view of today. Same tokens, no clone.  */
const HERO_TEAM: { name: string; task: string; state: "active" | "idle" | "off" }[] = [
  { name: "Priya N.", task: "Acme website · Design review", state: "active" },
  { name: "Marcus L.", task: "Onboarding flow · QA", state: "active" },
  { name: "Sofia R.", task: "Away since 2:10pm", state: "idle" },
];

const HERO_STATE_COLOR: Record<"active" | "idle" | "off", string> = {
  active: "var(--wp-accent)",
  idle: "var(--wp-warning)",
  off: "var(--wp-border-strong)",
};

export function HeroVisualAside() {
  return (
    <div className="wp-in wp-card h-full overflow-hidden p-5 sm:p-6" style={{ boxShadow: "var(--wp-shadow)" }}>
      <div className="flex items-center justify-between">
        <div>
          <p className="wp-display text-lg" style={{ color: "var(--wp-ink)" }}>Right now</p>
          <p className="text-xs" style={{ color: "var(--wp-muted)" }}>Live across your team</p>
        </div>
        <span className="wp-chip" style={{ borderColor: "var(--wp-accent)", color: "var(--wp-accent-ink)" }}>
          <span className="size-1.5 rounded-full" style={{ background: "var(--wp-accent)" }} /> 18 on the clock
        </span>
      </div>

      {/* your own running timer */}
      <div className="mt-5 flex items-center justify-between rounded-2xl p-4" style={{ background: "var(--wp-accent-soft)" }}>
        <div className="min-w-0">
          <p className="text-xs" style={{ color: "var(--wp-accent-ink)" }}>Quarterly roadmap · Internal</p>
          <p className="wp-mono wp-display mt-1 text-3xl" style={{ color: "var(--wp-ink)" }}>01:36:20</p>
        </div>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--wp-accent)", color: "#fff" }}>
          <Play className="size-4 fill-current" />
        </span>
      </div>

      {/* who's on what */}
      <div className="mt-4 space-y-2">
        {HERO_TEAM.map((p) => (
          <div key={p.name} className="flex items-center gap-2.5 rounded-xl px-3 py-2.5" style={{ background: "var(--wp-surface-2)" }}>
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: HERO_STATE_COLOR[p.state] }} />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold leading-tight" style={{ color: "var(--wp-ink)" }}>{p.name}</span>
              <span className="block truncate text-[11px]" style={{ color: "var(--wp-faint)" }}>{p.task}</span>
            </span>
          </div>
        ))}
      </div>

      {/* footer link-ish strip, mirrors the AI strip's weight on the left card */}
      <div className="mt-3 flex items-center justify-between rounded-2xl px-3 py-2.5" style={{ background: "var(--wp-surface-2)" }}>
        <p className="text-[12px]" style={{ color: "var(--wp-ink-2)" }}>
          <span className="font-semibold">3 approvals</span> waiting on you
        </p>
        <ArrowUpRight className="size-3.5 shrink-0" style={{ color: "var(--wp-accent-ink)" }} />
      </div>
    </div>
  );
}

/* ============================================================= *
 *  Feature visuals                                               *
 * ============================================================= */

function TimeVisual() {
  const days = [
    { d: "Mon", h: "7:48" },
    { d: "Tue", h: "8:12" },
    { d: "Wed", h: "6:59" },
    { d: "Thu", h: "8:26", live: true },
    { d: "Fri", h: "—" },
  ];
  return (
    <div className="wp-card h-full overflow-hidden p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--wp-ink)" }}>This week</p>
          <p className="text-xs" style={{ color: "var(--wp-faint)" }}>Jun 22 – 28</p>
        </div>
        <span className="wp-chip" style={{ borderColor: "var(--wp-accent)", color: "var(--wp-accent-ink)" }}>
          <span className="size-1.5 rounded-full" style={{ background: "var(--wp-accent)" }} /> Timer running
        </span>
      </div>

      {/* running timer */}
      <div className="mt-4 flex items-center justify-between rounded-2xl p-4" style={{ background: "var(--wp-accent-soft)" }}>
        <div>
          <p className="text-xs" style={{ color: "var(--wp-accent-ink)" }}>Design review · Acme website</p>
          <p className="wp-mono wp-display mt-1 text-3xl" style={{ color: "var(--wp-ink)" }}>02:14:53</p>
        </div>
        <span className="flex size-11 items-center justify-center rounded-full" style={{ background: "var(--wp-accent)", color: "#fff" }}>
          <Play className="size-4 fill-current" />
        </span>
      </div>

      {/* day columns */}
      <div className="mt-4 grid grid-cols-5 gap-2">
        {days.map((x) => (
          <div key={x.d} className="rounded-xl p-2 text-center" style={{ background: x.live ? "var(--wp-surface-2)" : "transparent", border: "1px solid var(--wp-border)" }}>
            <p className="text-[10px]" style={{ color: "var(--wp-faint)" }}>{x.d}</p>
            <div className="mx-auto my-1.5 w-full overflow-hidden rounded-full" style={{ height: 42, background: "var(--wp-surface-2)", display: "flex", alignItems: "flex-end" }}>
              <span className="w-full rounded-full" style={{ height: x.h === "—" ? "8%" : `${45 + x.d.length * 8}%`, background: x.live ? "var(--wp-accent)" : "var(--wp-border-strong)" }} />
            </div>
            <p className="wp-mono text-[11px] font-semibold" style={{ color: x.live ? "var(--wp-accent-ink)" : "var(--wp-muted)" }}>{x.h}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const CATS = [
  { label: "Productive", pct: 69, color: "var(--wp-success)" },
  { label: "Neutral", pct: 22, color: "var(--wp-gold)" },
  { label: "Distracting", pct: 9, color: "var(--wp-danger)" },
];

function InsightVisual() {
  return (
    <div className="wp-card h-full overflow-hidden p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: "var(--wp-ink)" }}>Activity by hour</p>
        <DeltaPill up value="6%" />
      </div>
      <svg viewBox="0 0 320 96" className="mt-3 w-full" fill="none" aria-hidden>
        <defs>
          <linearGradient id="ins-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--wp-accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--wp-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[24, 48, 72].map((y) => <line key={y} x1="4" y1={y} x2="316" y2={y} stroke="var(--wp-border)" strokeWidth="1" />)}
        <path d="M4 66 C 40 44, 70 38, 104 40 C 148 43, 158 76, 188 70 C 220 64, 236 40, 268 38 C 296 36, 308 54, 316 60 L316 94 L4 94 Z" fill="url(#ins-area)" />
        <path d="M4 66 C 40 44, 70 38, 104 40 C 148 43, 158 76, 188 70 C 220 64, 236 40, 268 38 C 296 36, 308 54, 316 60" className="wp-draw" style={{ ["--len" as string]: 440, ["--d" as string]: "120ms" }} stroke="var(--wp-accent)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <div className="mt-1 flex justify-between text-[10px]" style={{ color: "var(--wp-faint)" }}>
        {["8a", "10a", "12p", "2p", "4p", "6p"].map((h) => <span key={h}>{h}</span>)}
      </div>
      <div className="mt-4 space-y-2.5">
        {CATS.map((c) => (
          <div key={c.label}>
            <div className="flex justify-between text-xs">
              <span style={{ color: "var(--wp-muted)" }}>{c.label}</span>
              <span className="font-semibold" style={{ color: "var(--wp-ink)" }}>{c.pct}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full" style={{ background: "var(--wp-surface-2)" }}>
              <span className="block h-full rounded-full" style={{ width: `${c.pct}%`, background: c.color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const COLS = [
  { name: "To do", n: 4, cards: [{ t: "Audit onboarding flow", p: "Low" }, { t: "Draft Q3 report", p: "Med" }] },
  { name: "In progress", n: 3, cards: [{ t: "Ship billing export", p: "High", active: true }, { t: "Migrate agent config", p: "Med" }] },
  { name: "Done", n: 9, cards: [{ t: "Design pulse widget", p: "Done" }, { t: "Team capacity view", p: "Done" }] },
];
const PILL: Record<string, { bg: string; fg: string }> = {
  High: { bg: "color-mix(in srgb, var(--wp-danger) 14%, transparent)", fg: "var(--wp-danger)" },
  Med: { bg: "color-mix(in srgb, var(--wp-gold) 18%, transparent)", fg: "var(--wp-gold)" },
  Low: { bg: "var(--wp-surface-2)", fg: "var(--wp-muted)" },
  Done: { bg: "color-mix(in srgb, var(--wp-success) 14%, transparent)", fg: "var(--wp-success)" },
};

function BoardVisual() {
  return (
    <div className="wp-card h-full overflow-hidden p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: "var(--wp-ink)" }}>Website revamp</p>
        <span className="wp-chip">3 in progress</span>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {COLS.map((col) => (
          <div key={col.name} className="rounded-xl p-2" style={{ background: "var(--wp-surface-2)" }}>
            <div className="mb-2 flex items-center justify-between px-0.5">
              <span className="text-[11px] font-semibold" style={{ color: "var(--wp-ink)" }}>{col.name}</span>
              <span className="text-[10px]" style={{ color: "var(--wp-faint)" }}>{col.n}</span>
            </div>
            <div className="space-y-2">
              {col.cards.map((card) => (
                <div
                  key={card.t}
                  className="rounded-lg border p-2"
                  style={card.active ? { borderColor: "var(--wp-accent)", background: "var(--wp-surface)", boxShadow: "0 8px 18px -12px color-mix(in srgb, var(--wp-accent) 60%, transparent)" } : { borderColor: "var(--wp-border)", background: "var(--wp-surface)" }}
                >
                  <p className="text-[11px] leading-snug" style={{ color: "var(--wp-ink)" }}>{card.t}</p>
                  <span className="mt-1.5 inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: PILL[card.p].bg, color: PILL[card.p].fg }}>{card.p}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AiVisual() {
  return (
    <div className="wp-card h-full overflow-hidden p-5">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-xl" style={{ background: "var(--wp-accent)", color: "#fff" }}>
          <Sparkles className="size-4" />
        </span>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--wp-ink)" }}>Daily summary</p>
          <p className="text-[11px]" style={{ color: "var(--wp-faint)" }}>Written over your own hours & tasks</p>
        </div>
      </div>

      {/*
        This mockup used to narrate burnout detection ("two teams show an early burnout signal")
        and a productivity score. Neither exists: `anomalies` has no implementation, and per-person
        productivity needs the insights context, which is one slice of eight. A screenshot on a
        marketing page is a claim like any other sentence, so it now shows what the daily summary
        actually does — restate your own hours, tasks and attendance in plain language.
      */}
      <p className="mt-4 text-[13px] leading-relaxed" style={{ color: "var(--wp-ink-2)" }}>
        You tracked <span className="font-semibold" style={{ color: "var(--wp-accent-ink)" }}>7h 20m</span> across
        three projects, most of it on Acme website. Two tasks moved to review, and
        one leave request is <span className="font-semibold" style={{ color: "var(--wp-accent-ink)" }}>waiting on you</span>.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { t: "1 approval waiting", tone: "danger" },
          { t: "3 projects active", tone: "success" },
          { t: "Attendance · present", tone: "muted" },
        ].map((s) => (
          <span
            key={s.t}
            className="rounded-full px-2.5 py-1 text-[11px] font-medium"
            style={
              s.tone === "danger"
                ? { background: "color-mix(in srgb, var(--wp-danger) 12%, transparent)", color: "var(--wp-danger)" }
                : s.tone === "success"
                  ? { background: "color-mix(in srgb, var(--wp-success) 12%, transparent)", color: "var(--wp-success)" }
                  : { background: "var(--wp-surface-2)", color: "var(--wp-muted)" }
            }
          >
            {s.t}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl p-3" style={{ background: "var(--wp-surface-2)" }}>
        <span className="text-[11px]" style={{ color: "var(--wp-muted)" }}>30-day trend</span>
        <svg viewBox="0 0 120 28" className="h-6 w-28" fill="none" aria-hidden>
          <path d="M2 20 L18 16 L34 18 L50 9 L66 13 L82 6 L98 10 L118 4" className="wp-draw" style={{ ["--len" as string]: 180, ["--d" as string]: "200ms" }} stroke="var(--wp-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold" style={{ color: "var(--wp-success)" }}>
          <ArrowUpRight className="size-3" /> 8%
        </span>
      </div>
    </div>
  );
}

export function Visual({ kind }: { kind: VisualKind }) {
  switch (kind) {
    case "time":
      return <TimeVisual />;
    case "insight":
      return <InsightVisual />;
    case "board":
      return <BoardVisual />;
    case "ai":
      return <AiVisual />;
    default:
      return <HeroVisual />;
  }
}
