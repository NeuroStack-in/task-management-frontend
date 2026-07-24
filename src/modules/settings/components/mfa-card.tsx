"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, QrCode, ShieldCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
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
import {
  beginTotpEnrollment,
  confirmTotpEnrollment,
  disableTotp,
  fetchTotpEnabled,
  SessionExpiredError,
  type TotpEnrollment,
} from "@/modules/auth/services/account-security.service";
import { cn } from "@/lib/utils";

const MFA = "Multi-factor authentication";

/** Group the base32 secret into 4-char blocks so it can be typed without losing your place. */
function formatSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

/**
 * The signed-in user's own TOTP MFA — status, enrol (QR → verify), and turn off.
 *
 * **MFA is optional and user-managed** (product decision 2026-07-23): the Cognito pool enforces
 * nothing, so this card is the only way anyone turns it on. Once enabled, Cognito issues a
 * `SOFTWARE_TOKEN_MFA` challenge at every subsequent sign-in (handled by /mfa).
 *
 * Shared deliberately: employees reach it on /settings/login-security, Owner/Admin inside the org
 * Security Center — which previously showed them a read-only posture row, leaving them with no way
 * to enrol themselves at all. One implementation, so the two can't drift.
 *
 * @param embedded render only the status row (no `Card` shell), for hosting inside an existing card.
 */
export function MfaCard({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();

  /** Cognito session died mid-action → back to sign in, returning here after. */
  const expireToLogin = useCallback(() => {
    toast.error("Session expired", { description: "Please sign in again." });
    router.push(`/login?from=${encodeURIComponent(pathname)}`);
  }, [router, pathname]);

  /* ── Status (real, from getUserData) ── */
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
      toast.success(`${MFA} enabled`, {
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
      toast.success(`${MFA} turned off`);
    } catch (err) {
      if (err instanceof SessionExpiredError) return expireToLogin();
      toast.error("Couldn't turn off MFA", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setDisabling(false);
    }
  };

  const enabled = mfaStatus === "on";

  const row = (
    <>
      <div className="flex gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-feature-tint text-primary">
          <ShieldCheck className="size-5" />
        </span>
        <div className="space-y-0.5">
          <p className="flex items-center gap-2 font-medium">
            {MFA}
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
    </>
  );

  return (
    <>
      {embedded ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {row}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            {row}
          </CardContent>
        </Card>
      )}

      {/* Setup dialog — real secret from associateSoftwareToken */}
      <Dialog
        open={setupOpen}
        onOpenChange={(v) => {
          if (!v && !verifying) closeSetup();
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Set up {MFA.toLowerCase()}</DialogTitle>
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
    </>
  );
}
