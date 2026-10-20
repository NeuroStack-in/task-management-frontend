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
  reauthenticate,
  SessionExpiredError,
  type TotpEnrollment,
} from "@/modules/auth/services/account-security.service";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/errors";
import { sessionCanSelfManage } from "@/lib/oauth";
import { useAuthStore } from "@/stores/auth.store";

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
 * `SOFTWARE_TOKEN_MFA` challenge at every subsequent **password** sign-in (handled by /mfa). The
 * Google path (`lib/oauth.ts`) swaps its code for tokens with no challenge step, so the card says
 * which sign-ins it protects.
 *
 * Lives on /settings/login-security, which every role's rail lists. Owner/Admin used to get it
 * embedded in the org Security page instead, a second copy of the same control on a page about
 * organisation policy (UX audit SET-08).
 *
 * @param embedded render only the status row (no `Card` shell), for hosting inside an existing card.
 */
export function MfaCard({ embedded = false }: { embedded?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();

  const logout = useAuthStore((s) => s.logout);

  /**
   * Cognito session died mid-action → back to sign in, returning here after.
   *
   * Signs out **first**. With the store still "authenticated", `/login` sent the user straight back
   * to `from`, which re-mounted this card, which redirected again — an endless bounce with a toast
   * per lap (QA audit 2026-10-08, WP-095).
   */
  const expireToLogin = useCallback(() => {
    toast.error("Session expired", { description: "Please sign in again." });
    logout();
    router.push(`/login?from=${encodeURIComponent(pathname)}`);
  }, [logout, router, pathname]);

  /* ── Status (real, from getUserData) ── */
  // `federated`: a Google (Hosted-UI) session, whose token can't use Cognito's self-service APIs —
  // not an error a reload could fix, which is what this card used to say (WP-337).
  const [mfaStatus, setMfaStatus] = useState<
    "loading" | "on" | "off" | "error" | "federated"
  >("loading");
  useEffect(() => {
    let cancelled = false;
    fetchTotpEnabled()
      .then((on) => {
        if (!cancelled) setMfaStatus(on ? "on" : "off");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof SessionExpiredError) return expireToLogin();
        void sessionCanSelfManage().then((ok) => {
          if (!cancelled) setMfaStatus(ok === false ? "federated" : "error");
        });
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
  // …and so is the same secret as text. It was printed in clear under the hidden QR the whole time,
  // which defeated the point of hiding the QR (QA audit 2026-10-08, WP-522).
  const [secretShown, setSecretShown] = useState(false);
  const [disabling, setDisabling] = useState(false);
  /** Turning MFA off weakens the account; it asks first instead of acting on one click (WP-393). */
  const [confirmOff, setConfirmOff] = useState(false);
  /** The step-up proof (WP-393): the password and the current authenticator code. */
  const [offPassword, setOffPassword] = useState("");
  const [offCode, setOffCode] = useState("");
  const [offError, setOffError] = useState<string | null>(null);

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
        description: friendlyError(err, "Try again in a moment."),
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
    setSecretShown(false);
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
        description:
          "You'll be asked for a code the next time you sign in with your email and password.",
      });
    } catch (err) {
      if (err instanceof SessionExpiredError) return expireToLogin();
      setCodeError(friendlyError(err, "That code isn't right. Check it and try again."));
    } finally {
      setVerifying(false);
    }
  };

  const closeOff = () => {
    setConfirmOff(false);
    setOffPassword("");
    setOffCode("");
    setOffError(null);
  };

  const disable = async () => {
    setDisabling(true);
    setOffError(null);
    try {
      // Prove it's the account holder first — password and the current code (WP-393).
      await reauthenticate(offPassword, offCode);
      await disableTotp();
      setMfaStatus("off");
      closeOff();
      toast.success(`${MFA} turned off`);
    } catch (err) {
      if (err instanceof SessionExpiredError) return expireToLogin();
      setOffError(friendlyError(err, "Couldn't turn off MFA. Try again in a moment."));
    } finally {
      setDisabling(false);
    }
  };

  const enabled = mfaStatus === "on";

  const row = (
    <>
      <div className="flex gap-3">
        <span className="bg-feature-tint text-primary mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl">
          <ShieldCheck className="size-5" />
        </span>
        <div className="space-y-0.5">
          <p className="flex items-center gap-2 font-medium">
            {MFA}
            <Badge
              className={cn(
                enabled ? "bg-success/12 text-success" : "bg-muted text-muted-foreground",
              )}
            >
              {mfaStatus === "loading"
                ? "…"
                : mfaStatus === "error"
                  ? "Unknown"
                  : mfaStatus === "federated"
                    ? "Not available here"
                    : enabled
                      ? "On"
                      : "Off"}
            </Badge>
          </p>
          {/* "When you sign in with your email and password": the Google path exchanges its code for
              tokens with no challenge step, so this code is never asked for there (WP-131). */}
          {/* Owner decision 2026-10-09 (WP-131): a Google sign-in is protected by the Google account's
              own two-step verification; WorkPulse's code covers password sign-ins. Google is the only
              social provider (Microsoft was removed 2026-09-30). */}
          <p className="text-muted-foreground text-sm">
            Require a code from your authenticator app when you sign in with your email
            and password. If you sign in with Google, your Google account&apos;s own
            two-step verification protects you — turn it on in your{" "}
            <a
              href="https://myaccount.google.com/signinoptions/two-step-verification"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              Google account
            </a>
            .
          </p>
          {mfaStatus === "error" ? (
            <p className="text-muted-foreground text-sm">
              Couldn&apos;t load your MFA status — reload to retry.
            </p>
          ) : mfaStatus === "federated" ? (
            <p className="text-muted-foreground text-sm">
              You signed in with Google, so your Google account&apos;s two-step
              verification protects this sign-in. To use a WorkPulse authenticator code
              too, sign in with your email and password and turn it on here.
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
          onClick={() => setConfirmOff(true)}
          disabled={disabling}
        >
          Turn off
        </Button>
      ) : (
        <Button
          size="sm"
          className="shrink-0"
          onClick={startEnrollment}
          disabled={starting || mfaStatus === "error" || mfaStatus === "federated"}
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
              Scan the QR code with your authenticator app, then enter the 6-digit code it
              shows.
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
                  className="border-border hover:ring-primary/40 focus-visible:ring-primary/50 rounded-lg border bg-white p-3 transition hover:ring-2 focus-visible:ring-2 focus-visible:outline-none"
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
                  className="border-border bg-muted/40 text-muted-foreground hover:border-primary/40 hover:bg-muted hover:text-foreground flex size-[218px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed transition-colors"
                >
                  <QrCode className="size-8" />
                  <span className="text-sm font-medium">Show QR code</span>
                </button>
              )}
              <p className="text-muted-foreground text-xs">
                {qrShown
                  ? "Scan with Google Authenticator, Authy, or 1Password · click to hide"
                  : "Reveal the code to scan it with your authenticator app."}
              </p>
            </div>

            {/* Manual fallback for anyone who can't scan — the same secret, so hidden the same way. */}
            <div className="border-border bg-muted/40 rounded-lg border p-3 text-center">
              {secretShown ? (
                <>
                  <p className="text-muted-foreground text-xs">
                    Enter this key in your authenticator app
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold tracking-widest break-all">
                    {enrollment ? formatSecret(enrollment.secret) : "…"}
                  </p>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setSecretShown(true)}
                  className="text-muted-foreground hover:text-foreground text-xs font-medium underline-offset-2 hover:underline"
                >
                  Can&apos;t scan? Show the setup key
                </button>
              )}
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
              {codeError ? <p className="text-destructive text-xs">{codeError}</p> : null}
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

      {/* Turn off — confirmed, never one click (WP-393). */}
      <Dialog
        open={confirmOff}
        onOpenChange={(v) => {
          if (!v && !disabling) closeOff();
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Turn off {MFA.toLowerCase()}?</DialogTitle>
            <DialogDescription>
              You&apos;ll sign in with your password alone. Turning it back on later means
              scanning a new QR code. To confirm it&apos;s you, enter your password and
              the current code from your authenticator app.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (offPassword && offCode.length === 6 && !disabling) void disable();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="mfa-off-password">Password</Label>
              <Input
                id="mfa-off-password"
                type="password"
                autoComplete="current-password"
                value={offPassword}
                onChange={(e) => setOffPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mfa-off-code">Authenticator code</Label>
              <Input
                id="mfa-off-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={offCode}
                onChange={(e) =>
                  setOffCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
            </div>
            {offError ? (
              <p role="alert" className="text-destructive text-sm">
                {offError}
              </p>
            ) : null}
          </form>
          <DialogFooter showCloseButton>
            <Button
              variant="destructive"
              onClick={disable}
              disabled={disabling || !offPassword || offCode.length !== 6}
            >
              {disabling ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Turning off…
                </>
              ) : (
                "Turn off"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
