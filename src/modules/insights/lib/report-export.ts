/**
 * Report export helpers — CSV / PDF generation shared across the Reports
 * surfaces. Extracted so multiple presentations (the current Reports tab and
 * the experimental redesign) can reuse the exact same export behaviour without
 * duplicating logic. Functions run in click handlers only (they touch
 * `document` / `URL`).
 */
import Papa from "papaparse";
import { jsPDF } from "jspdf";
import { toast } from "sonner";
import { downloadBlob } from "@/lib/download";
import type { ReportDef } from "@/lib/mock-insights";

/** A single report → CSV file. */
export function exportCsv(report: ReportDef) {
  const csv = Papa.unparse({ fields: report.columns, data: report.rows });
  downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    `${report.id}-report.csv`,
  );
  toast.success("CSV exported", { description: `${report.name}.csv` });
}

/** A single report → one-page (landscape) PDF table. */
export function exportPdf(report: ReportDef) {
  const doc = new jsPDF({ orientation: "landscape" });
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const usable = pageW - margin * 2;
  const colW = usable / report.columns.length;

  doc.setFontSize(16);
  doc.text(report.name, margin, 18);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`${report.period} · WorkPulse`, margin, 25);

  let y = 36;
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  report.columns.forEach((c, i) => doc.text(String(c), margin + i * colW, y));
  doc.setDrawColor(210);
  doc.line(margin, y + 2, margin + usable, y + 2);
  doc.setFont("helvetica", "normal");
  y += 9;

  for (const row of report.rows) {
    row.forEach((cell, i) => doc.text(String(cell), margin + i * colW, y));
    y += 8;
    if (y > pageH - 14) {
      doc.addPage();
      y = 20;
    }
  }

  doc.save(`${report.id}-report.pdf`);
  toast.success("PDF exported", { description: `${report.name}.pdf` });
}

/** One combined PDF containing every report — the "overall reports" export. */
export function exportAllPdf(reports: ReportDef[]) {
  const doc = new jsPDF({ orientation: "landscape" });
  const margin = 14;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const usable = pageW - margin * 2;

  // Cover page
  doc.setFontSize(24);
  doc.text("WorkPulse", margin, 28);
  doc.setFontSize(14);
  doc.setTextColor(80);
  doc.text("Reports Pack", margin, 38);
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`${reports.length} reports · generated from WorkPulse`, margin, 48);
  reports.forEach((r, i) =>
    doc.text(`${i + 1}.  ${r.name}  —  ${r.period}`, margin, 62 + i * 7),
  );

  for (const report of reports) {
    doc.addPage();
    const colW = usable / report.columns.length;
    doc.setFontSize(16);
    doc.setTextColor(20);
    doc.text(report.name, margin, 18);
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(`${report.period} · WorkPulse`, margin, 25);

    let y = 36;
    doc.setTextColor(20);
    doc.setFont("helvetica", "bold");
    report.columns.forEach((c, i) => doc.text(String(c), margin + i * colW, y));
    doc.setDrawColor(210);
    doc.line(margin, y + 2, margin + usable, y + 2);
    doc.setFont("helvetica", "normal");
    y += 9;

    for (const row of report.rows) {
      row.forEach((cell, i) => doc.text(String(cell), margin + i * colW, y));
      y += 8;
      if (y > pageH - 14) {
        doc.addPage();
        y = 20;
      }
    }
  }

  doc.save("workpulse-reports.pdf");
  toast.success(
    `${reports.length} report${reports.length > 1 ? "s" : ""} exported`,
    {
      description: "workpulse-reports.pdf",
    },
  );
}

/** One CSV file with each selected report as a labelled section. */
export function exportSelectedCsv(reports: ReportDef[]) {
  if (reports.length === 1) return exportCsv(reports[0]);
  const csv = reports
    .map((r) => {
      const body = Papa.unparse({ fields: r.columns, data: r.rows });
      return `# ${r.name} — ${r.period}\n${body}`;
    })
    .join("\n\n");
  downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    "workpulse-reports.csv",
  );
  toast.success(`${reports.length} reports exported`, {
    description: "workpulse-reports.csv",
  });
}
