"use client";

import { Laptop } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { usePermissions } from "@/hooks/use-permissions";
import { useSessions } from "@/modules/security/use-sessions";
import { MfaCard } from "./mfa-card";
import { PasswordCard } from "./password-card";

/**
 * Epoch ms → a short relative label. Real sessions carry `{session_id, last_seen}` only —
 * Cognito exposes no device / IP / location without its paid advanced-security tier, and there is
 * no per-session revoke endpoint (§15), so this section is honestly lean and read-only.
 */
function timeAgo(ms: number | null): string {
  if (!ms) return "Unknown";
  const diff = Date.now() - ms;
  if (diff < 0) return "Just now";
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "Active now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return d === 1 ? "Yesterday" : `${d}d ago`;
}

/**
 * The personal account-security page (/settings/login-security).
 *
 * MFA and password are **shared components** — Owner/Admin get the same two controls inside the org
 * Security Center, which is the only security destination in their rail. Keeping one implementation
 * each is what stops the personal and org views drifting apart.
 */
export function AccountSecuritySettings() {
  // Roles WITH the org Security Center (Owner/Admin) reach this page directly rather than via the
  // rail, so the heading matches whichever label brought them here.
  const { can } = usePermissions();
  const heading = can("security:view") ? "Login & security" : "Security";

  // Active sessions — real, from GET /v1/me/sessions (sorted newest-first). Lean + read-only.
  const {
    sessions,
    loading: sessionsLoading,
    error: sessionsError,
  } = useSessions();

  return (
    <div className="space-y-6">
      <PageHeader
        title={heading}
        description="Protect your account with multi-factor authentication and a strong password."
      />

      {/* ── Multi-factor authentication (shared with the org Security Center) ── */}
      <MfaCard />

      {/* Password + active sessions, side by side on large screens. */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* ── Password: update via emailed code (shared with the org Security Center) ── */}
        <PasswordCard />

        {/* ── Active sessions ── */}
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <Laptop className="size-4 text-muted-foreground" />
              <p className="font-medium">Active sessions</p>
            </div>
            <p className="-mt-1 text-sm text-muted-foreground">
              Devices currently signed in to your account. Per-session sign-out
              isn&apos;t available yet.
            </p>
            {/* Show ~3 sessions; the rest scroll within this fixed height so the
                card never grows tall. */}
            <div className="max-h-56 space-y-2.5 overflow-y-auto pr-1">
              {sessionsLoading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Loading sessions…
                </p>
              ) : sessionsError ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {sessionsError}
                </p>
              ) : sessions.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No active sessions recorded.
                </p>
              ) : (
                sessions.map((s, i) => (
                  <div
                    key={s.session_id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Laptop className="size-4" />
                      </span>
                      <div>
                        <p className="flex items-center gap-2 text-sm font-medium">
                          Web session
                          {i === 0 ? (
                            <span className="rounded-full bg-success/12 px-1.5 py-0.5 text-[10px] font-medium text-success">
                              This device
                            </span>
                          ) : null}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {s.session_id} · {timeAgo(s.last_seen)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
