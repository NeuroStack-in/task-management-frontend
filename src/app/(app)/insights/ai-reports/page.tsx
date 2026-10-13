import type { Metadata } from "next";
import { ReportsExperimental } from "@/modules/insights/components/reports-experimental";

export const metadata: Metadata = { title: "AI reports · Analytics" };

/**
 * The AI-first reports surface (preview layout), fully live. `ReportsExperimental` renders the AI
 * executive briefing hero (`/v1/insights/reports/ai` — permission- and add-on-gated) with the week's
 * top performers and people needing attention, then the full report library (`ReportsLibrary`) —
 * every report composed from real endpoints (activity, timesheets, attendance, projects) with working
 * CSV/PDF export and honest omission where a signal doesn't exist yet.
 */
export default function Page() {
  return <ReportsExperimental />;
}
