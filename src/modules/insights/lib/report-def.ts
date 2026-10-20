/**
 * The report-library data shape — a self-contained mirror of the preview's `ReportDef`
 * (`src/lib/mock-insights.ts`), reproduced here so the insights module owns it and **never imports
 * `lib/mock-*`**. The preview built these rows from Faker; here every `ReportDef` is composed from
 * real endpoints (see `../use-reports-data.ts`). The shape is identical so the restored preview UI
 * (`../components/reports-library.tsx`) and the CSV/PDF export (`./report-export.ts`) render it
 * unchanged.
 *
 * Cells are `string | number`. When a report needs a signal the backend does not serve (a trend
 * sparkline, an idle-time measurement, a late qualifier on the oversight index), the composer writes
 * the em dash `"—"` — an honest omission, never a fabricated number.
 */

export type ReportCategory =
  | "workforce"
  | "time"
  | "projects"
  | "attendance"
  | "activity"
  | "monitoring";

export interface ReportDef {
  id: string;
  name: string;
  description: string;
  category: ReportCategory;
  /** Human label for the window the rows cover (e.g. "Oct 12 – Oct 16" or a single day). */
  timeframe?: string;
  /**
   * The same window as ISO dates — what exported file names carry, so a download says which days it
   * holds (UX audit 2026-10-16, MON-05). `from === to` for a single-day report.
   */
  window?: { from: string; to: string };
  columns: string[];
  rows: (string | number)[][];
}

export const REPORT_CATEGORY_LABEL: Record<ReportCategory, string> = {
  workforce: "Workforce",
  time: "Time & Billing",
  projects: "Projects",
  attendance: "Attendance",
  activity: "Activity",
  monitoring: "Monitoring",
};

/** The em dash written wherever a real value does not exist (never a fabricated 0). */
export const OMITTED = "—";
