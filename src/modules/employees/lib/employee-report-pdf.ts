/**
 * Render one employee's report as a themed, multi-section PDF.
 *
 * Theming follows the app, not a hard-coded brand: the accent is the reader's **active palette**
 * (`<html data-palette>` → `lib/palette`), so a download looks like the WorkPulse they are using.
 * Everything else is a small neutral scale, because a report is read on paper and on screen.
 *
 * Layout rules kept deliberately boring and consistent:
 *   - one accent header band per page, page number bottom-right, method note bottom-left;
 *   - sections never start within 40mm of the page end (a heading alone at the foot reads broken);
 *   - tables repeat their header row after every break and zebra-stripe for scanability;
 *   - numbers right-align, text truncates with an ellipsis rather than overlapping the next column;
 *   - **an absent measurement prints "—", never 0** — same rule the UI follows, and the reason the
 *     data layer distinguishes "no access" from "nothing recorded".
 */
import { jsPDF } from "jspdf";
import { PALETTES } from "@/lib/palette";
import { formatHours, isUuid } from "@/lib/format";
import type { AppTotal, EmployeeReportData, Section } from "./employee-report-data";
import { SCORE_WINDOW } from "./employee-report-data";

// ── page geometry (A4 portrait, mm) ──
const PAGE_W = 210;
const PAGE_H = 297;
const M = 14;
const CONTENT_W = PAGE_W - M * 2;
const FOOT_Y = PAGE_H - 10;

type RGB = [number, number, number];
const INK: RGB = [33, 37, 41];
const MUTED: RGB = [120, 124, 130];
const LINE: RGB = [223, 226, 230];
const ZEBRA: RGB = [247, 248, 250];

function hexToRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [79, 70, 229];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The reader's palette accent. `indigo` is the base `:root` and carries no attribute. */
function accentColor(): RGB {
  if (typeof document === "undefined") return [79, 70, 229];
  const id = document.documentElement.dataset.palette;
  if (!id) return [79, 70, 229];
  return hexToRgb(PALETTES.find((p) => p.id === id)?.swatch ?? "#4f46e5");
}

const dash = "—";
const pct = (n: number | null | undefined) => (n == null ? dash : `${Math.round(n)}%`);
const hrs = (seconds: number | null | undefined) =>
  seconds == null ? dash : formatHours(seconds / 3600);
const clock = (ms?: number) =>
  ms == null
    ? dash
    : new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const fullDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString([], { day: "2-digit", month: "short", year: "2-digit" });
};
const title = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : dash);

interface Col {
  header: string;
  width: number;
  align?: "left" | "right";
}

/** A tiny document cursor: everything below writes through this. */
class Doc {
  readonly d: jsPDF;
  y = 0;
  private readonly accent: RGB;
  private readonly name: string;
  private readonly stamp: string;

  constructor(name: string, stamp: string) {
    this.d = new jsPDF({ unit: "mm", format: "a4" });
    this.accent = accentColor();
    this.name = name;
    this.stamp = stamp;
    this.banner(true);
  }

  /** Accent band. The first page carries the report title; later pages a slim continuation strip. */
  private banner(first: boolean) {
    const h = first ? 30 : 14;
    this.d.setFillColor(...this.accent);
    this.d.rect(0, 0, PAGE_W, h, "F");
    this.d.setTextColor(255, 255, 255);
    if (first) {
      this.d.setFont("helvetica", "bold").setFontSize(17);
      this.d.text(this.name, M, 14);
      this.d.setFont("helvetica", "normal").setFontSize(9);
      this.d.text("WorkPulse · employee report", M, 21);
      this.d.text(this.stamp, PAGE_W - M, 21, { align: "right" });
    } else {
      this.d.setFont("helvetica", "bold").setFontSize(9);
      this.d.text(this.name, M, 9);
      this.d.setFont("helvetica", "normal");
      this.d.text("WorkPulse · employee report", PAGE_W - M, 9, { align: "right" });
    }
    this.y = h + 10;
    this.d.setTextColor(...INK);
  }

  page() {
    this.d.addPage();
    this.banner(false);
  }

  /** Break if `need` mm would run past the footer. */
  room(need: number) {
    if (this.y + need > FOOT_Y - 8) this.page();
  }

  section(heading: string, note?: string) {
    this.room(28);
    this.y += 2;
    this.d.setFont("helvetica", "bold").setFontSize(12).setTextColor(...INK);
    this.d.text(heading, M, this.y);
    if (note) {
      this.d.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
      this.d.text(note, PAGE_W - M, this.y, { align: "right" });
    }
    this.y += 2.5;
    this.d.setDrawColor(...this.accent).setLineWidth(0.6);
    this.d.line(M, this.y, M + 26, this.y);
    this.d.setDrawColor(...LINE).setLineWidth(0.2);
    this.d.line(M + 26, this.y, PAGE_W - M, this.y);
    this.y += 7;
    this.d.setFontSize(9).setTextColor(...INK);
  }

  /** Two-column key/value grid — the identity block. */
  pairs(rows: [string, string][]) {
    const colW = CONTENT_W / 2;
    for (let i = 0; i < rows.length; i += 2) {
      this.room(7);
      for (const [j, cell] of [rows[i], rows[i + 1]].entries()) {
        if (!cell) continue;
        const x = M + j * colW;
        this.d.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
        this.d.text(cell[0], x, this.y);
        this.d.setFontSize(9).setTextColor(...INK);
        this.d.text(this.fit(cell[1] || dash, colW - 34), x + 30, this.y);
      }
      this.y += 6.5;
    }
    this.y += 2;
  }

  /** KPI strip — the numbers someone opens the file to see. */
  cards(cards: { label: string; value: string; hint?: string }[]) {
    const gap = 3;
    const w = (CONTENT_W - gap * (cards.length - 1)) / cards.length;
    this.room(24);
    cards.forEach((c, i) => {
      const x = M + i * (w + gap);
      this.d.setFillColor(...ZEBRA);
      this.d.roundedRect(x, this.y, w, 20, 1.5, 1.5, "F");
      this.d.setFont("helvetica", "bold").setFontSize(14).setTextColor(...this.accent);
      this.d.text(this.fit(c.value, w - 6), x + 3, this.y + 9);
      this.d.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
      this.d.text(this.fit(c.label.toUpperCase(), w - 6), x + 3, this.y + 14);
      if (c.hint) this.d.text(this.fit(c.hint, w - 6), x + 3, this.y + 17.5);
    });
    this.y += 26;
  }

  table(cols: Col[], rows: (string | number)[][], opts: { maxRows?: number } = {}) {
    if (rows.length === 0) {
      this.note("Nothing recorded in this period.");
      return;
    }
    const shown = opts.maxRows ? rows.slice(0, opts.maxRows) : rows;
    const head = () => {
      this.d.setFillColor(...ZEBRA);
      this.d.rect(M, this.y - 4.2, CONTENT_W, 6.5, "F");
      this.d.setFont("helvetica", "bold").setFontSize(8).setTextColor(...MUTED);
      let x = M;
      for (const c of cols) {
        const right = c.align === "right";
        this.d.text(c.header.toUpperCase(), right ? x + c.width - 2 : x + 2, this.y, {
          align: right ? "right" : "left",
        });
        x += c.width;
      }
      this.y += 5.5;
      this.d.setFont("helvetica", "normal").setFontSize(8.5).setTextColor(...INK);
    };
    this.room(18);
    head();
    shown.forEach((row, i) => {
      if (this.y + 6 > FOOT_Y - 8) {
        this.page();
        head();
      }
      if (i % 2 === 1) {
        this.d.setFillColor(...ZEBRA);
        this.d.rect(M, this.y - 3.6, CONTENT_W, 5.6, "F");
      }
      let x = M;
      for (const [j, c] of cols.entries()) {
        const v = row[j] == null || row[j] === "" ? dash : String(row[j]);
        const right = c.align === "right";
        this.d.setTextColor(...INK);
        this.d.text(this.fit(v, c.width - 4), right ? x + c.width - 2 : x + 2, this.y, {
          align: right ? "right" : "left",
        });
        x += c.width;
      }
      this.y += 5.6;
    });
    if (opts.maxRows && rows.length > opts.maxRows) {
      this.note(`${rows.length - opts.maxRows} more rows not shown — export the CSV for the full list.`);
    }
    this.y += 4;
  }

  /** Why a section is empty or partial. Printed, never silently dropped. */
  note(text: string) {
    this.room(8);
    this.d.setFont("helvetica", "italic").setFontSize(8).setTextColor(...MUTED);
    this.d.text(this.fit(text, CONTENT_W), M, this.y);
    this.d.setFont("helvetica", "normal").setFontSize(9).setTextColor(...INK);
    this.y += 6;
  }

  /** Truncate to fit `w` mm at the current font size. */
  fit(text: string, w: number): string {
    const s = String(text ?? "");
    if (this.d.getTextWidth(s) <= w) return s;
    let lo = 0;
    let hi = s.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (this.d.getTextWidth(`${s.slice(0, mid)}…`) <= w) lo = mid;
      else hi = mid - 1;
    }
    return `${s.slice(0, lo)}…`;
  }

  /** Footers need the final page count, so they are stamped once at the end. */
  finish(methodNote: string) {
    const pages = this.d.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      this.d.setPage(p);
      this.d.setDrawColor(...LINE).setLineWidth(0.2);
      this.d.line(M, FOOT_Y - 4, PAGE_W - M, FOOT_Y - 4);
      this.d.setFont("helvetica", "normal").setFontSize(7).setTextColor(...MUTED);
      this.d.text(methodNote, M, FOOT_Y);
      this.d.text(`Page ${p} of ${pages}`, PAGE_W - M, FOOT_Y, { align: "right" });
    }
  }
}

/** Print a section's refusal reason instead of an empty table. */
function unavailable<T>(doc: Doc, s: Section<T>): s is { ok: false; reason: string } {
  if (s.ok) return false;
  doc.note(s.reason);
  return true;
}

export function renderEmployeeReportPdf(r: EmployeeReportData): jsPDF {
  const stamp = r.generatedAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  const doc = new Doc(r.profile.name || "Employee", `Generated ${stamp}`);
  const empId = r.profile.emp_id && !isUuid(r.profile.emp_id) ? r.profile.emp_id : dash;
  const period = `${r.history.from} → ${r.history.to}`;
  const span =
    r.history.days >= 365
      ? `${(r.history.days / 365).toFixed(1)} years`
      : `${r.history.days} days`;

  // ── headline numbers ──
  const trend = r.activity.ok ? r.activity.data.trend : null;
  const recentAvg = r.activity.ok ? r.activity.data.recentAvg : null;
  const worked = r.timesheet.ok ? r.timesheet.data.total_secs : null;
  const billable = r.timesheet.ok ? r.timesheet.data.billable_secs : null;
  const daysWorked = r.timesheet.ok
    ? r.timesheet.data.days.filter((d) => d.total_secs > 0).length
    : null;

  doc.cards([
    {
      label: `Productivity · ${SCORE_WINDOW}d`,
      value: pct(recentAvg),
      hint: trend ? `${trend.days_scored} scored days all-time` : "no agent data",
    },
    {
      label: "Hours · all time",
      value: hrs(worked),
      hint: daysWorked == null ? "" : `${daysWorked} days worked`,
    },
    {
      label: "Billable",
      value: hrs(billable),
      hint: worked && billable ? `${Math.round((billable / worked) * 100)}% of time` : "",
    },
    {
      label: "Projects",
      value: r.projects.ok ? String(r.projects.data.length) : dash,
      hint: r.projects.ok
        ? `${r.projects.data.filter((p) => p.project.status === "active").length} active`
        : "",
    },
  ]);
  doc.note(
    `Complete history: ${period} (${span}) — ` +
      (r.history.anchoredOnJoinDate
        ? "from this employee's join date to today."
        : "no join date on record, so the walk starts three years back."),
  );

  // ── identity ──
  doc.section("Profile", `Employee ID ${empId}`);
  doc.pairs([
    ["Name", r.profile.name],
    ["Employee ID", empId],
    ["Email", r.profile.email],
    ["Phone", r.profile.phone || dash],
    ["Job title", r.profile.title || dash],
    ["Role", r.roleName],
    ["Department", r.departmentName],
    ["Team", r.teamName],
    ["Status", title(r.profile.status)],
    ["Joined", r.profile.joined_at ? new Date(r.profile.joined_at).toLocaleDateString() : dash],
    ["Location", r.profile.location || dash],
    ["User ID", r.profile.user_id],
  ]);

  // ── today, live ──
  doc.section("Today", new Date().toLocaleDateString());
  if (!unavailable(doc, r.today)) {
    const t = r.today.data;
    doc.pairs([
      ["Clock in", clock(t.clock_in)],
      ["Clock out", t.running ? "still running" : clock(t.clock_out)],
      ["Worked", t.worked_minutes ? formatHours(t.worked_minutes / 60) : dash],
      ["Sessions", String(t.entry_count)],
      ["Status", t.on_leave ? "On leave" : t.running ? "Working" : t.status ? title(t.status) : "Open"],
      ["Late", t.late ? "Yes" : "No"],
      ["Permission", t.permission_minutes ? `${t.permission_minutes} min approved` : dash],
      ["", ""],
    ]);
  }

  // ── month-by-month rollup: the shape of a long history at a glance ──
  if (r.timesheet.ok || r.activity.ok) {
    doc.section("Month by month", period);
    const months = new Map<
      string,
      { worked: number; billable: number; days: number; score: number; scored: number }
    >();
    const bucket = (key: string) =>
      months.get(key) ?? { worked: 0, billable: 0, days: 0, score: 0, scored: 0 };
    if (r.timesheet.ok) {
      for (const d of r.timesheet.data.days) {
        const m = bucket(d.date.slice(0, 7));
        m.worked += d.total_secs;
        m.billable += d.billable_secs;
        if (d.total_secs > 0) m.days += 1;
        months.set(d.date.slice(0, 7), m);
      }
    }
    if (r.activity.ok) {
      for (const d of r.activity.data.days) {
        const s = (d as unknown as { score?: number }).score;
        if (s == null) continue;
        const m = bucket(d.date.slice(0, 7));
        m.score += s;
        m.scored += 1;
        months.set(d.date.slice(0, 7), m);
      }
    }
    doc.table(
      [
        { header: "Month", width: 38 },
        { header: "Days worked", width: 28, align: "right" },
        { header: "Hours", width: 26, align: "right" },
        { header: "Billable", width: 26, align: "right" },
        { header: "Days scored", width: 28, align: "right" },
        { header: "Avg score", width: 26, align: "right" },
      ],
      [...months.entries()]
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([month, m]) => [
          new Date(`${month}-01T00:00:00`).toLocaleDateString([], { month: "long", year: "numeric" }),
          m.days || dash,
          m.worked ? hrs(m.worked) : dash,
          m.billable ? hrs(m.billable) : dash,
          m.scored || dash,
          m.scored ? `${Math.round(m.score / m.scored)}%` : dash,
        ]),
    );
  }

  // ── attendance & hours, every recorded day ──
  doc.section("Attendance and hours", `every recorded day · ${period}`);
  if (!unavailable(doc, r.timesheet)) {
    const days = [...r.timesheet.data.days].sort((a, b) => b.date.localeCompare(a.date));
    const scoreByDay = new Map(r.activity.ok ? r.activity.data.days.map((d) => [d.date, d]) : []);
    doc.table(
      [
        { header: "Date", width: 26 },
        { header: "Sessions", width: 20, align: "right" },
        { header: "First in", width: 20, align: "right" },
        { header: "Last out", width: 20, align: "right" },
        { header: "Worked", width: 24, align: "right" },
        { header: "Billable", width: 22, align: "right" },
        { header: "Score", width: 16, align: "right" },
        { header: "Top project", width: 34 },
      ],
      days.map((d) => {
        const starts = d.entries.map((e) => e.start).filter(Boolean);
        const ends = d.entries.map((e) => e.end).filter((x): x is number => x != null);
        const byProject = new Map<string, number>();
        for (const e of d.entries) {
          byProject.set(e.project_id, (byProject.get(e.project_id) ?? 0) + (e.duration_secs ?? 0));
        }
        const top = [...byProject.entries()].sort((a, b) => b[1] - a[1])[0];
        const score = scoreByDay.get(d.date) as { score?: number } | undefined;
        return [
          fullDay(d.date),
          d.entries.length,
          starts.length ? clock(Math.min(...starts)) : dash,
          ends.length ? clock(Math.max(...ends)) : dash,
          hrs(d.total_secs),
          hrs(d.billable_secs),
          score?.score == null ? dash : `${Math.round(score.score)}%`,
          top ? projectName(r, top[0]) : dash,
        ];
      }),
    );
  }

  // ── every time entry ever recorded ──
  doc.section("Time entries", "every session, most recent first");
  if (r.timesheet.ok) {
    const entries = r.timesheet.data.days
      .flatMap((d) => d.entries.map((e) => ({ ...e, day: d.date })))
      .sort((a, b) => b.start - a.start);
    doc.note(`${entries.length} sessions recorded.`);
    doc.table(
      [
        { header: "Date", width: 24 },
        { header: "Start", width: 16, align: "right" },
        { header: "End", width: 16, align: "right" },
        { header: "Duration", width: 20, align: "right" },
        { header: "Project", width: 32 },
        { header: "Task / description", width: 62 },
        { header: "Billable", width: 12, align: "right" },
      ],
      entries.map((e) => [
        fullDay(e.day),
        clock(e.start),
        e.end ? clock(e.end) : "running",
        hrs(e.duration_secs),
        projectName(r, e.project_id),
        e.description?.trim() ||
          [e.task_title, e.subtask_title].filter(Boolean).join(" · ") ||
          (e.task_invalid ? "task removed" : dash),
        e.billable ? "Yes" : "No",
      ]),
    );
  }

  // ── productivity, every scored day ──
  doc.section("Productivity", `every scored day · ${period}`);
  if (!unavailable(doc, r.activity)) {
    const a = r.activity.data;
    doc.pairs([
      [`Average · last ${SCORE_WINDOW}d`, pct(a.recentAvg)],
      ["Average · all time", pct(a.trend.avg_score)],
      ["Days scored", String(a.trend.days_scored)],
      ["Org baseline", pct(a.trend.baseline)],
      ["Best day", a.trend.best ? `${fullDay(a.trend.best.date)} · ${Math.round(a.trend.best.score)}%` : dash],
      ["Weakest day", a.trend.worst ? `${fullDay(a.trend.worst.date)} · ${Math.round(a.trend.worst.score)}%` : dash],
    ]);
    doc.table(
      [
        { header: "Date", width: 26 },
        { header: "Score", width: 18, align: "right" },
        { header: "Active", width: 22, align: "right" },
        { header: "Productive", width: 24, align: "right" },
        { header: "Neutral", width: 22, align: "right" },
        { header: "Distracting", width: 24, align: "right" },
        { header: "Worked", width: 22, align: "right" },
        { header: "Attendance", width: 24 },
      ],
      [...a.days]
        .sort((x, y) => y.date.localeCompare(x.date))
        .map((d) => {
          const x = d as unknown as Record<string, number | string | undefined>;
          return [
            fullDay(d.date),
            x.score == null ? dash : `${Math.round(Number(x.score))}%`,
            hrs(Number(x.active_sec ?? 0) || null),
            hrs(Number(x.productive_sec ?? 0) || null),
            hrs(Number(x.neutral_sec ?? 0) || null),
            hrs(Number(x.distracting_sec ?? 0) || null),
            x.worked_minutes ? formatHours(Number(x.worked_minutes) / 60) : dash,
            x.attendance ? title(String(x.attendance)) : dash,
          ];
        }),
    );
  }

  // ── apps & sites ──
  doc.section("Applications and websites", `all time · ${period}`);
  if (!unavailable(doc, r.apps)) {
    const rows: AppTotal[] = r.apps.data.rows;
    const total = rows.reduce((s, x) => s + x.seconds, 0);
    doc.table(
      [
        { header: "Name", width: 74 },
        { header: "Kind", width: 24 },
        { header: "Category", width: 30 },
        { header: "Time", width: 26, align: "right" },
        { header: "Share", width: 28, align: "right" },
      ],
      rows.map((x) => [
        x.name,
        x.kind,
        title(x.category),
        hrs(x.seconds),
        total ? `${Math.round((x.seconds / total) * 100)}%` : dash,
      ]),
    );
    if (r.apps.data.truncated) {
      doc.note(
        "The server returns the top 15 apps and sites per 62-day window; a long tail of rarely-used " +
          "apps in some windows is therefore not listed.",
      );
    }
    doc.note(
      "Per-person app rows exist from 2026-08-27 onward; an empty list for an earlier range means not recorded, not unused.",
    );
  }

  // ── projects & tasks ──
  doc.section("Projects", "membership and delivery");
  if (!unavailable(doc, r.projects)) {
    doc.table(
      [
        { header: "Key", width: 20 },
        { header: "Project", width: 54 },
        { header: "Status", width: 22 },
        { header: "Completion", width: 26, align: "right" },
        { header: "Tasks", width: 18, align: "right" },
        { header: "Overdue", width: 20, align: "right" },
        { header: "Members", width: 22, align: "right" },
      ],
      r.projects.data.map(({ project, detail }) => [
        project.key ?? dash,
        project.name,
        title(project.status ?? ""),
        detail ? pct(detail.kpi?.completion_pct) : dash,
        detail?.kpi?.total_tasks ?? dash,
        detail?.kpi?.overdue_count ?? dash,
        detail?.kpi?.active_members ?? dash,
      ]),
    );
    for (const { project, detail } of r.projects.data) {
      const by = detail?.kpi?.tasks_by_status;
      if (!by) continue;
      doc.note(
        `${project.key ?? project.name}: ${by.todo} to do · ${by.in_progress} in progress · ` +
          `${by.in_review} in review · ${by.done} done · ${by.blocked} blocked`,
      );
    }
  }

  // ── leave, every year on record ──
  doc.section("Leave balances", "every year on record");
  if (!unavailable(doc, r.leave)) {
    for (const ledger of r.leave.data) {
      doc.note(`Year ${ledger.year}`);
      doc.table(
        [
          { header: "Leave type", width: 62 },
          { header: "Paid", width: 20 },
          { header: "Allowance", width: 28, align: "right" },
          { header: "Used", width: 24, align: "right" },
          { header: "Remaining", width: 28, align: "right" },
          { header: "Adjusted", width: 20, align: "right" },
        ],
        ledger.balances.map((b) => [
          b.name,
          b.paid ? "Paid" : "Unpaid",
          b.seeded ? b.allowance : dash,
          b.used,
          b.seeded ? b.remaining : dash,
          b.adjusted ? "Yes" : "No",
        ]),
      );
    }
    if (r.leave.data.some((l) => l.balances.some((b) => !b.seeded))) {
      doc.note("A type shown as — predates this employee's ledger: never granted, not zero.");
    }
  }

  doc.finish(
    `WorkPulse · ${r.profile.name} · generated ${stamp} · full history ${period} · ` +
      `headline productivity is the mean of scored days in the last ${SCORE_WINDOW} days`,
  );
  return doc.d;
}

function projectName(r: EmployeeReportData, id: string): string {
  if (!r.projects.ok) return id;
  return r.projects.data.find((p) => p.project.id === id)?.project.name ?? id;
}

/** Filename stem: the employee code when it is a real code, else a slug of the name. */
export function reportFileName(r: EmployeeReportData): string {
  const code =
    r.profile.emp_id && !isUuid(r.profile.emp_id)
      ? r.profile.emp_id.replace(/[^\w-]/g, "")
      : (r.profile.name || "employee").trim().replace(/\s+/g, "-").replace(/[^\w-]/g, "");
  const day = r.generatedAt.toISOString().slice(0, 10);
  return `${code || "employee"}-report-${day}.pdf`;
}
