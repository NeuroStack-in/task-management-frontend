import { AppearanceSync } from "@/components/layout/appearance-sync";
import { AuthGuard } from "@/components/layout/auth-guard";
import { DashboardShell } from "@/components/layout/dashboard-shell";

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
      <DashboardShell>{children}</DashboardShell>
    </AuthGuard>
  );
}
