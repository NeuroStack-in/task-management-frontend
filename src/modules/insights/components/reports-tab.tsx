"use client";

import { FileDown, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { REPORTS } from "@/lib/mock-insights";

export function ReportsTab() {
  const exportReport = (name: string, format: "CSV" | "PDF") =>
    toast.success(`Exported “${name}”`, { description: `${format} download (simulated).` });

  return (
    <div className="space-y-4">
      {REPORTS.map((report) => (
        <Card key={report.id}>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-lg bg-feature-tint text-primary">
                  <FileText className="size-4" />
                </span>
                {report.name}
              </CardTitle>
              <CardDescription className="mt-1">
                {report.description} · {report.period}
              </CardDescription>
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={() => exportReport(report.name, "CSV")}>
                <FileDown className="size-4" /> CSV
              </Button>
              <Button size="sm" variant="outline" onClick={() => exportReport(report.name, "PDF")}>
                <FileDown className="size-4" /> PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {report.columns.map((c) => (
                      <TableHead key={c}>{c}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.slice(0, 5).map((row, ri) => (
                    <TableRow key={ri}>
                      {row.map((cell, ci) => (
                        <TableCell
                          key={ci}
                          className={ci === 0 ? "font-medium" : "tabular-nums text-muted-foreground"}
                        >
                          {cell === "up" ? (
                            <Badge className="bg-success/12 text-success">▲ up</Badge>
                          ) : cell === "down" ? (
                            <Badge className="bg-destructive/12 text-destructive">▼ down</Badge>
                          ) : cell === "At risk" ? (
                            <Badge className="bg-warning/15 text-warning">At risk</Badge>
                          ) : (
                            cell
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {report.rows.length > 5 ? (
              <p className="pt-3 text-center text-xs text-muted-foreground">
                Showing 5 of {report.rows.length} rows · export for the full report
              </p>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
