"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  KeyRound,
  Laptop,
  Loader2,
  QrCode,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/use-permissions";
import { useSessions } from "@/modules/security/use-sessions";
import {
  beginTotpEnrollment,
  changePassword,
  confirmTotpEnrollment,
  disableTotp,
  fetchTotpEnabled,
  SessionExpiredError,
  type TotpEnrollment,
} from "@/modules/auth/services/account-security.service";
import { PASSWORD_RULES, validatePassword } from "@/lib/password";
import { cn } from "@/lib/utils";

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

/** Space the base32 secret into groups of 4 for manual entry. */
function formatSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Real self-service account security against the signed-in Cognito session:
 * TOTP MFA enrollment (associateSoftwareToken → QR → verifySoftwareToken →
 * setUserMfaPreference) and password change (changePassword). No backend REST
 * route is involved — Cognito is the system of record.
 */
export function AccountSecuritySettings() {
  const router = useRouter();

  // Roles WITH the org Security Center (Owner/Admin) keep "Login & security" +
  // "Two-factor authentication"; everyone reaching this via the personal rail
  // (Employee, Manager/Team Lead, …) sees "Security" + "Multi-factor
  // authentication". Matches the settings rail label.
  const { can } = usePermissions();
  const orgSecurity = can("security:view");
  const heading = orgSecurity ? "Login & security" : "Security";
  const mfa = "Multi-factor authentication";
  const mfaLower = mfa.toLowerCase();

  /** Cognito session died mid-action → send them back to sign in (returning here after). */
  const expireToLogin = useCallback(() => {
    toast.error("Session expired", { description: "Please sign in again." });
    router.push(`/login?from=${encodeURIComponent("/settings/login-security")}`);
  }, [router]);

  /* ── MFA status (real, from getUserData) ── */
  const [mfaStatus, setMfaStatus] = useState<"loading" | "on" | "off" | "error">(
    "loading",
  );
  useEffect(() => {
    let cancelled = false;
    fetchTotpEnabled()
      .then((on) => {
        if (!cancelled) setMfaStatus(on ? "on" : "off");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof SessionExpiredError) expireToLogin();
        else setMfaStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [expireToLogin]);

  /* ── Enrollment dialog ── */
  const [setupOpen, setSetupOpen] = useState(false);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [starting, setStarting] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  // QR encodes the secret — hidden until revealed to avoid screen-share exposure.
  const [qrShown, setQrShown] = useState(false);
  const [disabling, setDisabling] = useState(false);

  const startEnrollment = async () => {
    setStarting(true);
    try {
      // Fresh secret from Cognito (associateSoftwareToken); a re-run replaces it.
      const e = await beginTotpEnrollment();
      setEnrollment(e);
      setSetupOpen(true);
    } catch (err) {
      if (err instanceof SessionExpiredError) return expireToLogin();
      toast.error("Couldn't start MFA setup", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setStarting(false);
    }
  };

  const closeSetup = () => {
    setSetupOpen(false);
    setEnrollment(null);
    setCode("");
    setCodeError(null);
    setQrShown(false);
  };

  const verify = async () => {
    if (code.length !== 6 || verifying) return;
    setVerifying(true);
    setCodeError(null);
    try {
      // verifySoftwareToken(code) then setUserMfaPreference(TOTP preferred).
      await confirmTotpEnrollment(code);
      setMfaStatus("on");
      closeSetup();
      toast.success(`${mfa} enabled`, {
        description: "You'll be asked for a code at your next sign-in.",
      });
    } catch (err) {
      if (err instanceof SessionExpiredError) return expireToLogin();
      setCodeError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  const disable = async () => {
    setDisabling(true);
    try {
      await disableTotp();
      setMfaStatus("off");
      toast.success(`${mfa} turned off`);
    } catch (err) {
      if (err instanceof SessionExpiredError) return expireToLogin();
      toast.error("Couldn't turn off MFA", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDisabling(false);
    }
  };

  /* ── Password change ── */
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [savingPw, setSavingPw] = useState(false);

  const savePassword = async () => {
    if (savingPw) return;
    if (!pw.current || !pw.next) {
      toast.error("Enter your current and new password");
      return;
    }
    // Same pool-policy validation as signup/invite/reset (lib/password.ts).
    const policyError = validatePassword(pw.next);
    if (policyError) {
      toast.error(policyError);
      return;
    }
    if (pw.next !== pw.confirm) {
      toast.error("New passwords don't match");
      return;
    }
    setSavingPw(true);
    try {
      await changePassword(pw.current, pw.next);
      setPw({ current: "", next: "", confirm: "" });
      toast.success("Password updated");
    } catch (err) {
      if (err instanceof SessionExpiredError) return expireToLogin();
      toast.error("Couldn't update password", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSavingPw(false);
    }
  };

  // Active sessions — real, from GET /v1/me/sessions (sorted newest-first). Lean + read-only.
  const {
    sessions,
    loading: sessionsLoading,
    error: sessionsError,
  } = useSessions();

  const enabled = mfaStatus === "on";

  return (
    <div className="space-y-6">
      <PageHeader
        title={heading}
        description={`Protect your account with ${mfaLower} and a strong password.`}
      />

      {/* ── Two-factor authentication ── */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-feature-tint text-primary">
              <ShieldCheck className="size-5" />
            </span>
            <div className="space-y-0.5">
              <p className="flex items-center gap-2 font-medium">
                {mfa}
                <Badge
                  className={cn(
                    enabled
                      ? "bg-success/12 text-success"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {mfaStatus === "loading"
                    ? "…"
                    : mfaStatus === "error"
                      ? "Unknown"
                      : enabled
                        ? "On"
                        : "Off"}
                </Badge>
              </p>
              <p className="text-sm text-muted-foreground">
                Require a code from your authenticator app when you sign in.
              </p>
              {mfaStatus === "error" ? (
                <p className="text-sm text-muted-foreground">
                  Couldn&apos;t load your MFA status — reload to retry.
                </p>
              ) : null}
            </div>
          </div>
          {mfaStatus === "loading" ? (
            <Button variant="outline" size="sm" className="shrink-0" disabled>
              <Loader2 className="size-4 animate-spin" /> Checking…
            </Button>
          ) : enabled ? (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={disable}
              disabled={disabling}
            >
              {disabling ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Turning off…
                </>
              ) : (
                "Turn off"
              )}
            </Button>
          ) : (
            <Button
              size="sm"
              className="shrink-0"
              onClick={startEnrollment}
              disabled={starting || mfaStatus === "error"}
            >
              {starting ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Preparing…
                </>
              ) : (
                "Enable"
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Password + active sessions, side by side on large screens. */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* ── Password ── */}
        <Card>
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-muted-foreground" />
            <p className="font-medium">Password</p>
          </div>
          <p className="-mt-1 text-sm text-muted-foreground">
            {PASSWORD_RULES.join(" · ")}.
          </p>
          <div className="space-y-3 sm:max-w-sm">
            <div className="space-y-1.5">
              <Label htmlFor="cur-pw">Current password</Label>
              <Input
                id="cur-pw"
                type="password"
                autoComplete="current-password"
                value={pw.current}
                onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pw">New password</Label>
              <Input
                id="new-pw"
                type="password"
                autoComplete="new-password"
                value={pw.next}
                onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-pw">Confirm new password</Label>
              <Input
                id="cf-pw"
                type="password"
                autoComplete="new-password"
                value={pw.confirm}
                onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Button size="sm" onClick={savePassword} disabled={savingPw}>
                {savingPw ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Updating…
                  </>
                ) : (
                  "Update password"
                )}
              </Button>
              {/* For anyone who can't remember their current password — the reset flow verifies by
                  emailed code instead, so it doesn't need the old one. */}
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-primary underline-offset-2 hover:underline"
              >
                Forgot your password?
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

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

      {/* 2FA setup dialog — real secret from associateSoftwareToken */}
      <Dialog
        open={setupOpen}
        onOpenChange={(v) => {
          if (!v && !verifying) closeSetup();
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Set up {mfaLower}</DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app, then enter the
              6-digit code it shows.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Scannable QR, hidden until revealed (it encodes the secret). Uses
                literal high-contrast colours so it scans in dark mode too. */}
            <div className="flex flex-col items-center gap-2">
              {qrShown && enrollment ? (
                <button
                  type="button"
                  onClick={() => setQrShown(false)}
                  aria-label="Hide QR code"
                  title="Click to hide"
                  className="rounded-lg border border-border bg-white p-3 transition hover:ring-2 hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
                >
                  <QRCodeSVG
                    value={enrollment.otpauthUri}
                    size={192}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#0a0a0a"
                  />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setQrShown(true)}
                  className="flex size-[218px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted hover:text-foreground"
                >
                  <QrCode className="size-8" />
                  <span className="text-sm font-medium">Show QR code</span>
                </button>
              )}
              <p className="text-xs text-muted-foreground">
                {qrShown
                  ? "Scan with Google Authenticator, Authy, or 1Password · click to hide"
                  : "Reveal the code to scan it with your authenticator app."}
              </p>
            </div>

            {/* Manual fallback for anyone who can't scan */}
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-center">
              <p className="text-xs text-muted-foreground">
                Can&apos;t scan? Enter this secret manually
              </p>
              <p className="mt-1 break-all font-mono text-sm font-semibold tracking-widest">
                {enrollment ? formatSecret(enrollment.secret) : "…"}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="otp">6-digit code</Label>
              <Input
                id="otp"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setCodeError(null);
                }}
                placeholder="123456"
                aria-invalid={!!codeError}
                className="tracking-[0.4em]"
              />
              {codeError ? (
                <p className="text-xs text-destructive">{codeError}</p>
              ) : null}
            </div>
          </div>
          <DialogFooter showCloseButton>
            <Button onClick={verify} disabled={code.length !== 6 || verifying}>
              {verifying ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Verifying…
                </>
              ) : (
                "Verify & enable"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
