"use client";

import Papa from "papaparse";
import { jsPDF } from "jspdf";
import { FileBarChart, FileText, Lock, Sheet } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermissions } from "@/hooks/use-permissions";
import { REPORTS, type ReportDef } from "@/lib/mock-insights";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportCsv(report: ReportDef) {
  const csv = Papa.unparse({ fields: report.columns, data: report.rows });
  downloadBlob(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    `${report.id}-report.csv`,
  );
  toast.success("CSV exported", { description: `${report.name}.csv` });
}

function exportPdf(report: ReportDef) {
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
  report.columns.forEach((c, i) =>
    doc.text(String(c), margin + i * colW, y),
  );
  doc.setDrawColor(210);
  doc.line(margin, y + 2, margin + usable, y + 2);
  doc.setFont("helvetica", "normal");
  y += 9;

  for (const row of report.rows) {
    row.forEach((cell, i) =>
      doc.text(String(cell), margin + i * colW, y),
    );
    y += 8;
    if (y > pageH - 14) {
      doc.addPage();
      y = 20;
    }
  }

  doc.save(`${report.id}-report.pdf`);
  toast.success("PDF exported", { description: `${report.name}.pdf` });
}

export function ReportsView() {
  const { can } = usePermissions();
  const canExport = can("reports:export");

  return (
    <div className="space-y-5">
      {!canExport ? (
        <div className="flex items-center gap-2.5 rounded-2xl bg-muted px-5 py-3 text-sm text-muted-foreground">
          <Lock className="size-4" />
          You can view reports, but exporting requires the{" "}
          <span className="font-medium text-foreground">Export Reports</span>{" "}
          permission.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((report) => (
          <Card key={report.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-feature-tint text-primary">
                  <FileBarChart className="size-5" />
                </span>
                <Badge variant="outline">{report.period}</Badge>
              </div>
              <CardTitle className="mt-3">{report.name}</CardTitle>
              <CardDescription>{report.description}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto space-y-4">
              {/* Mini preview */}
              <div className="overflow-hidden rounded-xl border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {report.columns.slice(0, 3).map((c) => (
                        <TableHead key={c} className="h-8 text-xs">
                          {c}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.rows.slice(0, 3).map((row, ri) => (
                      <TableRow key={ri}>
                        {row.slice(0, 3).map((cell, ci) => (
                          <TableCell key={ci} className="py-1.5 text-xs">
                            {String(cell)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground">
                {report.rows.length} rows · {report.columns.length} columns
              </p>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={!canExport}
                  onClick={() => exportCsv(report)}
                >
                  <Sheet className="size-4" /> CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={!canExport}
                  onClick={() => exportPdf(report)}
                >
                  <FileText className="size-4" /> PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
