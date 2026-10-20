"use client";

import { useId, useState } from "react";
import { ChevronDown, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A chart's numbers as a table, behind a "Show the numbers" toggle (UX audit 2026-10-16, MON-16).
 *
 * The Analytics charts had no text alternative — a screen reader heard nothing, and every value sat
 * in a tooltip that only a mouse hover could open. This puts the same rows the chart draws in a real
 * table anyone can open: keyboard, screen reader, or a reader who just wants the figure. `summary` is
 * a one-sentence reading of the chart, announced with the toggle so a screen-reader user knows what
 * the table holds before opening it.
 */
export function ChartTable({
  caption,
  columns,
  rows,
  summary,
  className,
}: {
  /** What the table is — "Captures per hour". Also the table's `<caption>`. */
  caption: string;
  columns: string[];
  rows: (string | number)[][];
  /** One sentence on what the chart shows ("Busiest hour: 10am, 34 captures"). */
  summary?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const summaryId = `${id}-summary`;
  if (rows.length === 0) return null;
  return (
    <div className={cn("mt-2", className)}>
      {summary ? (
        <p id={summaryId} className="sr-only">
          {summary}
        </p>
      ) : null}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-describedby={summary ? summaryId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-6 items-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Table2 className="size-3.5" aria-hidden="true" />
        {open ? "Hide the numbers" : "Show the numbers"}
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      <div id={id} hidden={!open} className="mt-2 max-h-72 overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-card">
            <tr className="border-b">
              {columns.map((c, i) => (
                <th
                  key={c}
                  scope="col"
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium text-muted-foreground",
                    i === 0 ? "text-left" : "text-right",
                  )}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className="border-b last:border-0">
                {r.map((cell, ci) =>
                  ci === 0 ? (
                    <th key={ci} scope="row" className="px-3 py-1 text-left text-xs font-normal">
                      {cell}
                    </th>
                  ) : (
                    <td key={ci} className="px-3 py-1 text-right text-xs tabular-nums">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
