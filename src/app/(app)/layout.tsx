import { AppearanceSync } from "@/components/layout/appearance-sync";
import { AuthGuard } from "@/components/layout/auth-guard";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { RouteGate } from "@/components/layout/route-gate";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      {/* Adopts the account's stored theme + palette (GET /v1/me/appearance) wherever the app runs.
          Inside AuthGuard because it needs a session; renders nothing. */}
      <AppearanceSync />
      {/* RouteGate sits inside the shell: a page the viewer can't open shows its wall as the page
          content, with the sidebar and top bar still there (UX audit XC-02 / SHELL-01). */}
      <DashboardShell>
        <RouteGate>{children}</RouteGate>
      </DashboardShell>
    </AuthGuard>
  );
}
