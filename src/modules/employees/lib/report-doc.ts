/**
 * The WorkPulse report document — one look for every PDF the app downloads.
 *
 * Lifted out of the employee report (`./employee-report-pdf`), which set the style the owner asked
 * every other report to follow (2026-10-16): the project report, the employees list and the
 * Analytics report library now print through this too, instead of hand-placed lines of text.
 *
 * Theming follows the app, not a hard-coded brand: the accent is the reader's **active palette**
 * (`<html data-palette>` → `lib/palette`), so a download looks like the WorkPulse they are using.
 * Everything else is a small neutral scale, because a report is read on paper and on screen.
 *
 * Layout rules kept deliberately boring and consistent:
 *   - one accent header band per page, page number bottom-right, method note bottom-left;
 *   - sections never start within 28mm of the page end (a heading alone at the foot reads broken);
 *   - tables repeat their header row after every break and zebra-stripe for scanability;
 *   - numbers right-align, text truncates with an ellipsis rather than overlapping the next column;
 *   - **an absent measurement prints "—", never 0** — same rule the UI follows.
 *
 * Every string goes through the `PdfText` writer (`./pdf-text`), so a name in any script prints —
 * Polish or Greek as embedded Noto Sans text, Tamil or Hindi drawn by the browser (WP-225).
 */
import { jsPDF } from "jspdf";
import { PALETTES } from "@/lib/palette";
import type { PdfText, PdfTextFor } from "./pdf-text";

type RGB = [number, number, number];
const INK: RGB = [33, 37, 41];
const MUTED: RGB = [120, 124, 130];
const LINE: RGB = [223, 226, 230];
const ZEBRA: RGB = [247, 248, 250];

/** Margin, mm. */
const M = 14;

export const DASH = "—";

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

export interface ReportCol {
  header: string;
  /** mm. {@link ReportDoc.fitColumns} scales a set of relative widths to the page. */
  width: number;
  align?: "left" | "right";
}

export interface ReportCard {
  label: string;
  value: string;
  hint?: string;
}

export interface ReportDocOptions {
  /** Large on the first page's band, small on every later one — a person's or project's name. */
  title: string;
  /** What this file is, after "WorkPulse · " — e.g. "employee report". */
  kind: string;
  /** Right of the band on page one — usually "Generated <date>". */
  stamp: string;
  orientation?: "portrait" | "landscape";
}

/** "Generated 16 Oct 2026, 23:40" — the stamp every report carries. */
export function generatedStamp(at: Date = new Date()): string {
  return `Generated ${at.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`;
}

/** A tiny document cursor: everything in a report writes through this. */
export class ReportDoc {
  readonly d: jsPDF;
  /** Every string reaches the page through this — never `this.d.text` (WP-225). */
  private readonly t: PdfText;
  y = 0;
  private readonly accent: RGB;
  private readonly title: string;
  private readonly kind: string;
  private readonly stamp: string;
  readonly pageW: number;
  readonly pageH: number;
  private readonly footY: number;

  constructor(text: PdfTextFor, opts: ReportDocOptions) {
    this.d = new jsPDF({
      unit: "mm",
      format: "a4",
      orientation: opts.orientation ?? "portrait",
    });
    this.t = text(this.d);
    this.pageW = this.d.internal.pageSize.getWidth();
    this.pageH = this.d.internal.pageSize.getHeight();
    this.footY = this.pageH - 10;
    this.accent = accentColor();
    this.title = opts.title;
    this.kind = `WorkPulse · ${opts.kind}`;
    this.stamp = opts.stamp;
    this.banner(true);
  }

  /** Usable width between the margins, mm. */
  get contentW(): number {
    return this.pageW - M * 2;
  }

  /** Scale relative column widths to fill the content width exactly. */
  fitColumns(cols: ReportCol[]): ReportCol[] {
    const sum = cols.reduce((s, c) => s + c.width, 0) || 1;
    return cols.map((c) => ({ ...c, width: (c.width / sum) * this.contentW }));
  }

  /** Accent band. The first page carries the report title; later pages a slim continuation strip. */
  private banner(first: boolean) {
    const h = first ? 30 : 14;
    this.d.setFillColor(...this.accent);
    this.d.rect(0, 0, this.pageW, h, "F");
    this.d.setTextColor(255, 255, 255);
    if (first) {
      this.d.setFont("helvetica", "bold").setFontSize(17);
      this.t.text(this.t.fit(this.title, this.contentW), M, 14);
      this.d.setFont("helvetica", "normal").setFontSize(9);
      this.t.text(this.kind, M, 21);
      this.t.text(this.stamp, this.pageW - M, 21, { align: "right" });
    } else {
      this.d.setFont("helvetica", "normal").setFontSize(9);
      const kindW = this.t.width(this.kind);
      this.d.setFont("helvetica", "bold");
      this.t.text(this.t.fit(this.title, this.contentW - kindW - 8), M, 9);
      this.d.setFont("helvetica", "normal");
      this.t.text(this.kind, this.pageW - M, 9, { align: "right" });
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
    if (this.y + need > this.footY - 8) this.page();
  }

  section(heading: string, note?: string) {
    this.room(28);
    this.y += 2;
    this.d.setFont("helvetica", "normal").setFontSize(8);
    const noteW = note ? this.t.width(note) + 6 : 0;
    this.d
      .setFont("helvetica", "bold")
      .setFontSize(12)
      .setTextColor(...INK);
    this.t.text(this.t.fit(heading, this.contentW - noteW), M, this.y);
    if (note) {
      this.d
        .setFont("helvetica", "normal")
        .setFontSize(8)
        .setTextColor(...MUTED);
      this.t.text(note, this.pageW - M, this.y, { align: "right" });
    }
    this.y += 2.5;
    this.d.setDrawColor(...this.accent).setLineWidth(0.6);
    this.d.line(M, this.y, M + 26, this.y);
    this.d.setDrawColor(...LINE).setLineWidth(0.2);
    this.d.line(M + 26, this.y, this.pageW - M, this.y);
    this.y += 7;
    this.d.setFontSize(9).setTextColor(...INK);
  }

  /** Two-column key/value grid — the identity block. */
  pairs(rows: [string, string][]) {
    const colW = this.contentW / 2;
    for (let i = 0; i < rows.length; i += 2) {
      this.room(7);
      for (const [j, cell] of [rows[i], rows[i + 1]].entries()) {
        // An empty pair is a gap in the grid (an odd count), not a missing value to dash.
        if (!cell || (!cell[0] && !cell[1])) continue;
        const x = M + j * colW;
        this.d
          .setFont("helvetica", "normal")
          .setFontSize(8)
          .setTextColor(...MUTED);
        this.t.text(cell[0], x, this.y);
        this.d.setFontSize(9).setTextColor(...INK);
        this.t.text(this.fit(cell[1] || DASH, colW - 34), x + 30, this.y);
      }
      this.y += 6.5;
    }
    this.y += 2;
  }

  /** KPI strip — the numbers someone opens the file to see. */
  cards(cards: ReportCard[]) {
    const gap = 3;
    const w = (this.contentW - gap * (cards.length - 1)) / cards.length;
    this.room(24);
    cards.forEach((c, i) => {
      const x = M + i * (w + gap);
      this.d.setFillColor(...ZEBRA);
      this.d.roundedRect(x, this.y, w, 20, 1.5, 1.5, "F");
      this.d
        .setFont("helvetica", "bold")
        .setFontSize(14)
        .setTextColor(...this.accent);
      this.t.text(this.fit(c.value, w - 6), x + 3, this.y + 9);
      this.d
        .setFont("helvetica", "normal")
        .setFontSize(7.5)
        .setTextColor(...MUTED);
      this.t.text(this.fit(c.label.toUpperCase(), w - 6), x + 3, this.y + 14);
      if (c.hint) this.t.text(this.fit(c.hint, w - 6), x + 3, this.y + 17.5);
    });
    this.y += 26;
  }

  table(
    cols: ReportCol[],
    rows: (string | number | null | undefined)[][],
    opts: { maxRows?: number; empty?: string } = {},
  ) {
    if (rows.length === 0) {
      this.note(opts.empty ?? "Nothing recorded in this period.");
      return;
    }
    const shown = opts.maxRows ? rows.slice(0, opts.maxRows) : rows;
    const head = () => {
      this.d.setFillColor(...ZEBRA);
      this.d.rect(M, this.y - 4.2, this.contentW, 6.5, "F");
      this.d
        .setFont("helvetica", "bold")
        .setFontSize(8)
        .setTextColor(...MUTED);
      let x = M;
      for (const c of cols) {
        const right = c.align === "right";
        this.t.text(
          this.fit(c.header.toUpperCase(), c.width - 4),
          right ? x + c.width - 2 : x + 2,
          this.y,
          {
            align: right ? "right" : "left",
          },
        );
        x += c.width;
      }
      this.y += 5.5;
      this.d
        .setFont("helvetica", "normal")
        .setFontSize(8.5)
        .setTextColor(...INK);
    };
    this.room(18);
    head();
    shown.forEach((row, i) => {
      if (this.y + 6 > this.footY - 8) {
        this.page();
        head();
      }
      if (i % 2 === 1) {
        this.d.setFillColor(...ZEBRA);
        this.d.rect(M, this.y - 3.6, this.contentW, 5.6, "F");
      }
      let x = M;
      for (const [j, c] of cols.entries()) {
        const v = row[j] == null || row[j] === "" ? DASH : String(row[j]);
        const right = c.align === "right";
        this.d.setTextColor(...INK);
        this.t.text(this.fit(v, c.width - 4), right ? x + c.width - 2 : x + 2, this.y, {
          align: right ? "right" : "left",
        });
        x += c.width;
      }
      this.y += 5.6;
    });
    if (opts.maxRows && rows.length > opts.maxRows) {
      this.note(
        `${rows.length - opts.maxRows} more rows not shown — export the CSV for the full list.`,
      );
    }
    this.y += 4;
  }

  /** Body text, wrapped to the content width — a description, a summary. */
  paragraph(text: string) {
    this.d
      .setFont("helvetica", "normal")
      .setFontSize(9)
      .setTextColor(...INK);
    for (const line of this.t.wrap(text, this.contentW)) {
      this.room(6);
      this.t.text(line, M, this.y);
      this.y += 4.6;
    }
    this.y += 3;
  }

  /** Why a section is empty or partial. Printed, never silently dropped. */
  note(text: string) {
    this.room(8);
    this.d
      .setFont("helvetica", "italic")
      .setFontSize(8)
      .setTextColor(...MUTED);
    this.t.text(this.fit(text, this.contentW), M, this.y);
    this.d
      .setFont("helvetica", "normal")
      .setFontSize(9)
      .setTextColor(...INK);
    this.y += 6;
  }

  /** Truncate to fit `w` mm at the current font size — measured on what will actually print. */
  fit(text: string, w: number): string {
    return this.t.fit(String(text ?? ""), w);
  }

  /** Footers need the final page count, so they are stamped once at the end. */
  finish(methodNote: string) {
    const pages = this.d.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      this.d.setPage(p);
      this.d.setDrawColor(...LINE).setLineWidth(0.2);
      this.d.line(M, this.footY - 4, this.pageW - M, this.footY - 4);
      this.d
        .setFont("helvetica", "normal")
        .setFontSize(7)
        .setTextColor(...MUTED);
      const label = `Page ${p} of ${pages}`;
      // The note stops 6 mm short of the page label: a long note (a long name in it) ran on
      // underneath "Page X of Y" (found while fixing WP-225).
      const room = this.pageW - 2 * M - this.d.getTextWidth(label) - 6;
      this.t.text(this.fit(methodNote, room), M, this.footY);
      this.t.text(label, this.pageW - M, this.footY, { align: "right" });
    }
  }
}
