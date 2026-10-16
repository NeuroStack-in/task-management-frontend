/**
 * Report export helpers — CSV / PDF generation for the report library. PDFs print through the
 * shared {@link ReportDoc}, the employee report's document style (owner request 2026-10-16). Restored
 * from the preview's `report-export.ts` (papaparse for CSV, jsPDF for the table + a combined
 * "Download all" pack), with one change: it operates on the module-local {@link ReportDef} (`timeframe` instead of
 * the preview's `period`) and imports **no `lib/mock-*`**. The rows it writes are the real composed
 * rows from `../use-reports-data.ts`, so every exported file is honest.
 *
 * Functions run in click handlers only (they touch `document` / `URL`).
 *
 * PDF text goes through the `PdfText` writer: rows carry people's and projects' names, and one
 * character outside Latin-1 used to garble its whole cell. A report with such text loads a Unicode
 * font from `/fonts/` first (QA audit 2026-10-08, WP-225); a Latin-only one renders as before.
 */
import { toast } from "sonner";
import { downloadBlob } from "@/lib/download";
import { buildPdf } from "@/modules/employees/lib/pdf-text";
import {
  ReportDoc,
  generatedStamp,
  type ReportCol,
} from "@/modules/employees/lib/report-doc";
import { OMITTED, REPORT_CATEGORY_LABEL, type ReportDef } from "./report-def";
import { CSV_BOM, csvBody, toCsv } from "@/lib/csv";

/** A cell that reads as a quantity — right-aligned, like every number in a WorkPulse report. */
const NUMERIC = /^[-+]?[\d.,]+\s*(%|h|m|s|hrs?|min)?$|^\d+h(\s?\d+m)?$|^\d{1,2}:\d{2}$/i;

/** Headers that name a quantity — for a column whose every cell is "—". */
const QUANTITY_HEADER =
  /%|\bhrs?\b|hours|rate|count|days|present|absent|late|leave|score|trend|#/i;

/**
 * Column widths from what the columns hold — a name gets room, a count doesn't — scaled to the page,
 * and right-aligned where the values are numbers.
 */
function columnsFor(doc: ReportDoc, report: ReportDef): ReportCol[] {
  return doc.fitColumns(
    report.columns.map((header, i) => {
      const cells = report.rows
        .map((r) => String(r[i] ?? ""))
        .filter((c) => c && c !== OMITTED);
      const longest = Math.max(
        header.length,
        ...cells.slice(0, 200).map((c) => Math.min(c.length, 40)),
      );
      // With nothing but dashes to go on, the header says whether the column is a quantity.
      const numeric = cells.length
        ? cells.filter((c) => NUMERIC.test(c.trim())).length / cells.length >= 0.8
        : QUANTITY_HEADER.test(header);
      return {
        header,
        width: Math.max(6, Math.min(longest, 40)),
        align: numeric ? "right" : "left",
      };
    }),
  );
}

/** Landscape once a table has more columns than a portrait page reads comfortably. */
const orientationFor = (reports: ReportDef[]) =>
  reports.some((r) => r.columns.length > 7)
    ? ("landscape" as const)
    : ("portrait" as const);

/**
 * One report under its own heading: what it measures, then its table. Reports flow one after
 * another, as the employee report's sections do — a page per report left most pages blank.
 */
function drawReportBody(doc: ReportDoc, heading: string, report: ReportDef) {
  const note = [REPORT_CATEGORY_LABEL[report.category], report.timeframe]
    .filter(Boolean)
    .join(" · ");
  doc.section(heading, note);
  if (report.description) doc.paragraph(report.description);
  doc.table(columnsFor(doc, report), report.rows, { empty: "No rows for this period." });
}

/** The footer every analytics PDF carries. */
const footer = (what: string, stamp: string) =>
  `WorkPulse · ${what} · ${stamp.replace(/^Generated/, "generated")} · — means the value wasn't measured, never zero`;

/** A single report → CSV file. */
export function exportCsv(report: ReportDef) {
  const csv = toCsv({ fields: report.columns, data: report.rows });
  downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    `${report.id}-report.csv`,
  );
  toast.success("CSV exported", { description: `${report.name}.csv` });
}

/**
 * A single report → PDF, in the same document style as the employee report: accent band, headline
 * cards, sections, a striped table with its header repeated on every page (owner request
 * 2026-10-16).
 */
export async function exportPdf(report: ReportDef) {
  try {
    const doc = await buildPdf((text) => {
      const stamp = generatedStamp();
      const doc = new ReportDoc(text, {
        title: report.name,
        kind: "analytics report",
        stamp,
        orientation: orientationFor([report]),
      });
      doc.cards([
        { label: "Rows", value: String(report.rows.length), hint: "in this report" },
        { label: "Period", value: report.timeframe ?? "—", hint: "covered by the rows" },
        {
          label: "Category",
          value: REPORT_CATEGORY_LABEL[report.category],
          hint: "Analytics",
        },
      ]);
      drawReportBody(doc, "Details", report);
      doc.finish(footer(report.name, stamp));
      return doc.d;
    });
    doc.save(`${report.id}-report.pdf`);
    toast.success("PDF exported", { description: `${report.name}.pdf` });
  } catch {
    toast.error("Couldn't export the PDF. Try again.");
  }
}

/** One combined PDF containing every report — the "overall reports" export. */
export async function exportAllPdf(reports: ReportDef[]) {
  try {
    const doc = await buildPdf((text) => {
      const stamp = generatedStamp();
      const doc = new ReportDoc(text, {
        title: "Reports pack",
        kind: "analytics reports",
        stamp,
        orientation: orientationFor(reports),
      });
      const rows = reports.reduce((n, r) => n + r.rows.length, 0);
      const categories = new Set(reports.map((r) => r.category));
      doc.cards([
        { label: "Reports", value: String(reports.length), hint: "in this pack" },
        { label: "Rows", value: String(rows), hint: "across every report" },
        {
          label: "Categories",
          value: String(categories.size),
          hint: [...categories].map((c) => REPORT_CATEGORY_LABEL[c]).join(", "),
        },
      ]);
      doc.section("Contents");
      doc.table(
        doc.fitColumns([
          { header: "#", width: 6, align: "right" },
          { header: "Report", width: 60 },
          { header: "Category", width: 26 },
          { header: "Period", width: 40 },
          { header: "Rows", width: 14, align: "right" },
        ]),
        reports.map((r, i) => [
          i + 1,
          r.name,
          REPORT_CATEGORY_LABEL[r.category],
          r.timeframe ?? "—",
          r.rows.length,
        ]),
      );
      reports.forEach((report, i) =>
        drawReportBody(doc, `${i + 1}. ${report.name}`, report),
      );
      doc.finish(footer("reports pack", stamp));
      return doc.d;
    });
    doc.save("workpulse-reports.pdf");
    toast.success(`${reports.length} report${reports.length > 1 ? "s" : ""} exported`, {
      description: "workpulse-reports.pdf",
    });
  } catch {
    toast.error("Couldn't export the PDF. Try again.");
  }
}

/** One CSV file with each selected report as a labelled section. */
export function exportSelectedCsv(reports: ReportDef[]) {
  if (reports.length === 1) return exportCsv(reports[0]);
  const csv = reports
    .map((r) => {
      const body = csvBody({ fields: r.columns, data: r.rows });
      return `# ${r.name}${r.timeframe ? ` — ${r.timeframe}` : ""}\n${body}`;
    })
    .join("\n\n");
  downloadBlob(
    new Blob([CSV_BOM + csv], { type: "text/csv;charset=utf-8;" }),
    "workpulse-reports.csv",
  );
  toast.success(`${reports.length} reports exported`, {
    description: "workpulse-reports.csv",
  });
}
