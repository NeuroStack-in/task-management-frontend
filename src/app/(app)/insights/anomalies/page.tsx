import { redirect } from "next/navigation";

// The AI Insights + Reports tabs were merged into /insights/ai-reports (gated by `ai:view` — see
// constants/navigation.ts). Redirect this legacy route there so it isn't reachable fail-open by
// direct URL — and to the **Alerts** block itself, not the top of a page with no anomalies section
// (UX audit 2026-10-16, MON-06). The block scrolls itself into view once the signals above it load.
export default function Page() {
  redirect("/insights/ai-reports#alerts");
}
