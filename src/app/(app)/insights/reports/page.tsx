import { redirect } from "next/navigation";

// The Reports tab was merged into /insights/ai-reports (gated by `ai:view` — see
// constants/navigation.ts). Redirect this legacy route there so it isn't reachable
// fail-open by direct URL.
export default function Page() {
  redirect("/insights/ai-reports");
}
