import type { Metadata } from "next";
import { EnrollmentView } from "@/modules/agents/components/enrollment-view";

export const metadata: Metadata = { title: "Enrol a device · Settings" };

// The managed-agent enrolment flow (MANAGED-AGENT.md §6.2, Ph3-4): pick an employee → mint a
// one-time code → reveal the code + install command → pending-codes worklist. A tab over the
// existing Device agents section — a genuinely different entity (codes, not devices) with its own
// write surface, so it survives the no-duplicate-pages rule. `agents:manage`; hidden in project mode
// by the view itself.
export default function Page() {
  return <EnrollmentView />;
}
