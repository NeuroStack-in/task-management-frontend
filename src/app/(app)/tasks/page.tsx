import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Tasks" };

export default function Page() {
  return (
    <ComingSoon
      title="Tasks"
      description="Task list, kanban, calendar, and timeline views."
      phase={2}
    />
  );
}
