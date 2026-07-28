"use client";

import { useState } from "react";
import { KeyRound, Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { PasswordInput } from "@/components/shared/password-input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  confirmPasswordReset,
  requestPasswordReset,
} from "@/modules/auth/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";
import { PASSWORD_RULES, validatePassword } from "@/lib/password";
import { friendlyError } from "@/lib/errors";

/**
 * Update the signed-in user's password — **one** flow, verified by a one-time code Cognito emails
 * them (`forgotPassword` → `confirmPassword`).
 *
 * Deliberately no "current password" variant: two paths to the same outcome read as two different
 * features and just make the card ambiguous. The emailed code proves identity at least as well as
 * the old password, and it still works for the far more common case — someone who can't recall it.
 *
 * Shared: employees reach it on /settings/login-security, Owner/Admin inside the org Security
 * Center — one implementation, so the two can't drift.
 */
export function PasswordCard() {
  const email = useAuthStore((s) => s.user?.email) ?? "";

  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    if (busy) return;
    if (!email) {
      toast.error("No email address on your account to send a code to");
      return;
    }
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
      toast.success(`We emailed a code to ${email}`);
    } catch (err) {
      toast.error("Couldn't send the code", {
        description: friendlyError(
          err,
          "Check the email address and try again.",
        ),
      });
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (busy) return;
    if (!code.trim()) {
      toast.error("Enter the code from your email");
      return;
    }
    // Same pool-policy check as every other password entry point (lib/password.ts).
    const policyError = validatePassword(next);
    if (policyError) {
      toast.error(policyError);
      return;
    }
    if (next !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setBusy(true);
    try {
      await confirmPasswordReset(email, code, next);
      setSent(false);
      setCode("");
      setNext("");
      setConfirm("");
      toast.success("Password updated — use it the next time you sign in");
    } catch (err) {
      toast.error("Couldn't update your password", {
        description: friendlyError(
          err,
          "Check the code and try again — it may have expired.",
        ),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card id="password" className="scroll-mt-24">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-muted-foreground" />
          <p className="font-medium">Update your password</p>
        </div>
        <p className="-mt-1 text-sm text-muted-foreground">
          {PASSWORD_RULES.join(" · ")}.
        </p>

        <div className="space-y-3 sm:max-w-sm">
          {!sent ? (
            <>
              <p className="text-sm text-muted-foreground">
                We&apos;ll email a one-time code to{" "}
                <span className="font-medium text-foreground">
                  {email || "your address"}
                </span>{" "}
                to confirm it&apos;s you. Your current password isn&apos;t needed.
              </p>
              <Button size="sm" onClick={sendCode} disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Sending…
                  </>
                ) : (
                  "Email me a code"
                )}
              </Button>
            </>
          ) : (
            <>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MailCheck className="size-4 shrink-0 text-success" />
                Code sent to{" "}
                <span className="font-medium text-foreground">{email}</span>
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="pw-code">Verification code</Label>
                <Input
                  id="pw-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="Code from your email"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw-new">New password</Label>
                <PasswordInput
                  id="pw-new"
                  autoComplete="new-password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw-cf">Confirm new password</Label>
                <PasswordInput
                  id="pw-cf"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Button size="sm" onClick={submit} disabled={busy}>
                  {busy ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Updating…
                    </>
                  ) : (
                    "Update password"
                  )}
                </Button>
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={busy}
                  className="text-sm font-medium text-primary underline-offset-2 hover:underline disabled:opacity-50"
                >
                  Resend code
                </button>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
