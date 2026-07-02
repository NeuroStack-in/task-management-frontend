"use client";

import { useState } from "react";
import {
  ShieldCheck,
  KeyRound,
  Laptop,
  Smartphone,
  Copy,
  QrCode,
  type LucideIcon,
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
import { useAccountSecurityStore } from "@/stores/account-security.store";
import { useAuthStore } from "@/stores/auth.store";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";

/** Demo authenticator secret + recovery codes (frontend-only stand-in). */
const TOTP_SECRET = "JBSW Y3DP EHPK 3PXP";
const RECOVERY_CODES = [
  "4F2K-9QX7",
  "B8M3-7TLP",
  "Z1C6-2WD9",
  "9HRA-5NK2",
  "Q3VE-8YB4",
  "L7XP-1MD6",
  "T2KF-6RZ8",
  "C9WN-3JQ5",
];

interface SessionRow {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  current?: boolean;
  icon: LucideIcon;
}

const SESSIONS: SessionRow[] = [
  {
    id: "s1",
    device: "Chrome on Windows",
    location: "Bengaluru, IN",
    lastActive: "Active now",
    current: true,
    icon: Laptop,
  },
  {
    id: "s2",
    device: "Safari on iPhone",
    location: "Bengaluru, IN",
    lastActive: "2 days ago",
    icon: Smartphone,
  },
];

export function AccountSecuritySettings() {
  const enabled = useAccountSecurityStore((s) => s.twoFactorEnabled);
  const setTwoFactor = useAccountSecurityStore((s) => s.setTwoFactor);

  // Roles WITH the org Security Center (Owner/Admin) keep "Login & security" +
  // "Two-factor authentication"; everyone reaching this via the personal rail
  // (Employee, Manager/Team Lead, …) sees "Security" + "Multi-factor
  // authentication". Matches the settings rail label.
  const { can } = usePermissions();
  const orgSecurity = can("security:view");
  const heading = orgSecurity ? "Login & security" : "Security";
  const mfa = orgSecurity
    ? "Two-factor authentication"
    : "Multi-factor authentication";
  const mfaLower = mfa.toLowerCase();

  const [setupOpen, setSetupOpen] = useState(false);
  const [code, setCode] = useState("");
  // QR encodes the secret — hidden until revealed to avoid screen-share exposure.
  const [qrShown, setQrShown] = useState(false);

  // otpauth URI for authenticator apps, built from the demo secret + signed-in
  // email; deterministic (no Date.now/random). Secret stored with spaces for
  // readability — strip them for the URI.
  const userEmail = useAuthStore((s) => s.user?.email);
  const account = userEmail ?? "member@workpulse.app";
  const otpauthUri =
    `otpauth://totp/WorkPulse:${encodeURIComponent(account)}` +
    `?secret=${TOTP_SECRET.replace(/\s/g, "")}` +
    `&issuer=WorkPulse&algorithm=SHA1&digits=6&period=30`;
  const [showCodes, setShowCodes] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });

  const verify = () => {
    if (code.length !== 6) return;
    setTwoFactor(true);
    setSetupOpen(false);
    setCode("");
    setShowCodes(true);
    toast.success(`${mfa} enabled`);
  };

  const disable = () => {
    setTwoFactor(false);
    toast.success(`${mfa} turned off`);
  };

  const savePassword = () => {
    if (!pw.current || !pw.next) {
      toast.error("Enter your current and new password");
      return;
    }
    if (pw.next.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (pw.next !== pw.confirm) {
      toast.error("New passwords don't match");
      return;
    }
    setPw({ current: "", next: "", confirm: "" });
    toast.success("Password updated");
  };

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
                  {enabled ? "On" : "Off"}
                </Badge>
              </p>
              <p className="text-sm text-muted-foreground">
                Require a code from your authenticator app when you sign in.
              </p>
              {enabled ? (
                <button
                  type="button"
                  onClick={() => setShowCodes(true)}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  View recovery codes
                </button>
              ) : null}
            </div>
          </div>
          {enabled ? (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={disable}
            >
              Turn off
            </Button>
          ) : (
            <Button size="sm" className="shrink-0" onClick={() => setSetupOpen(true)}>
              Enable
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
            Use at least 8 characters.
          </p>
          <div className="space-y-3 sm:max-w-sm">
            <div className="space-y-1.5">
              <Label htmlFor="cur-pw">Current password</Label>
              <Input
                id="cur-pw"
                type="password"
                value={pw.current}
                onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-pw">New password</Label>
              <Input
                id="new-pw"
                type="password"
                value={pw.next}
                onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cf-pw">Confirm new password</Label>
              <Input
                id="cf-pw"
                type="password"
                value={pw.confirm}
                onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
              />
            </div>
            <Button size="sm" onClick={savePassword}>
              Update password
            </Button>
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
            Devices currently signed in to your account.
          </p>
          {/* Show ~3 sessions; the rest scroll within this fixed height so the
              card never grows tall. */}
          <div className="max-h-56 space-y-2.5 overflow-y-auto pr-1">
            {SESSIONS.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                    <div>
                      <p className="flex items-center gap-2 text-sm font-medium">
                        {s.device}
                        {s.current ? (
                          <span className="rounded-full bg-success/12 px-1.5 py-0.5 text-[10px] font-medium text-success">
                            This device
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.location} · {s.lastActive}
                      </p>
                    </div>
                  </div>
                  {!s.current ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toast.success(`Signed out ${s.device}`)}
                    >
                      Sign out
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </CardContent>
        </Card>
      </div>

      {/* 2FA setup dialog */}
      <Dialog
        open={setupOpen}
        onOpenChange={(v) => {
          if (!v) {
            setSetupOpen(false);
            setCode("");
            setQrShown(false);
          }
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
              {qrShown ? (
                <button
                  type="button"
                  onClick={() => setQrShown(false)}
                  aria-label="Hide QR code"
                  title="Click to hide"
                  className="rounded-lg border border-border bg-white p-3 transition hover:ring-2 hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
                >
                  <QRCodeSVG
                    value={otpauthUri}
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
              <p className="mt-1 font-mono text-sm font-semibold tracking-widest">
                {TOTP_SECRET}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="otp">6-digit code</Label>
              <Input
                id="otp"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="123456"
                className="tracking-[0.4em]"
              />
            </div>
          </div>
          <DialogFooter showCloseButton>
            <Button onClick={verify} disabled={code.length !== 6}>
              Verify &amp; enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recovery codes dialog */}
      <Dialog open={showCodes} onOpenChange={setShowCodes}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Recovery codes</DialogTitle>
            <DialogDescription>
              Save these somewhere safe. Each can be used once if you lose your
              device.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {RECOVERY_CODES.map((c) => (
              <code
                key={c}
                className="rounded-md border border-border bg-muted/40 px-2 py-1.5 text-center font-mono text-sm"
              >
                {c}
              </code>
            ))}
          </div>
          <DialogFooter showCloseButton>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard?.writeText(RECOVERY_CODES.join("\n"));
                toast.success("Recovery codes copied");
              }}
            >
              <Copy className="size-4" /> Copy codes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
