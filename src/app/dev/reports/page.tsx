import type { Metadata } from "next";
import { DevReportsView } from "@/modules/dev-reports/dev-reports-view";

export const metadata: Metadata = { title: "Dev · Reports" };

export default function DevReportsPage() {
  return (
    <div className="mx-auto min-h-screen max-w-6xl px-6 py-8">
      <h1 className="mb-6 font-display text-2xl font-semibold tracking-tight">
        Reports — prototype
      </h1>
      <DevReportsView />
    </div>
  );
}
