"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth.store";
import {
  AuthError,
  hasPendingTotpChallenge,
} from "@/modules/auth/services/auth.service";
import { cn } from "@/lib/utils";

const LENGTH = 6;

/**
 * Answers the real Cognito TOTP challenge (`SOFTWARE_TOKEN_MFA`). The login page stashes the
 * half-authenticated `CognitoUser` in the auth service and routes here; that state is in-memory
 * only, so a hard refresh on this page loses the challenge — we detect that and send the user
 * back to sign in.
 */
export function MfaForm() {
  const router = useRouter();
  const params = useSearchParams();
  const completeMfa = useAuthStore((s) => s.completeMfa);
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const [submitting, setSubmitting] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  // Read once on first render — the challenge only appears via a login redirect, never later.
  const [hasChallenge] = useState(() => hasPendingTotpChallenge());

  const code = digits.join("");
  const complete = code.length === LENGTH;

  const setDigit = (i: number, value: string) => {
    const char = value.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = char;
      return next;
    });
    if (char && i < LENGTH - 1) inputs.current[i + 1]?.focus();
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    if (!text) return;
    e.preventDefault();
    const next = Array(LENGTH).fill("");
    for (let i = 0; i < text.length; i++) next[i] = text[i];
    setDigits(next);
    inputs.current[Math.min(text.length, LENGTH - 1)]?.focus();
  };

  const verify = async () => {
    if (!complete || submitting) return;
    setSubmitting(true);
    try {
      await completeMfa(code);
      toast.success("Verified", { description: "Welcome back." });
      const from = params.get("from");
      router.replace(from && from.startsWith("/") ? from : "/dashboard");
    } catch (err) {
      const isRetryable = err instanceof AuthError && err.kind === "credentials";
      toast.error("Verification failed", {
        description:
          err instanceof AuthError ? err.message : "Something went wrong.",
      });
      if (isRetryable) {
        // Wrong code — the challenge is still live; clear for another attempt.
        setDigits(Array(LENGTH).fill(""));
        inputs.current[0]?.focus();
        setSubmitting(false);
      } else {
        router.replace("/login");
      }
    }
  };

  if (!hasChallenge) {
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <span className="mb-1 flex size-12 items-center justify-center rounded-full bg-feature-tint text-primary">
            <ShieldCheck className="size-6" />
          </span>
          <CardTitle className="text-xl">Verification expired</CardTitle>
          <CardDescription>
            This page only works right after entering your password. Sign in
            again to get a new verification prompt.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            className="w-full"
            render={<Link href="/login" />}
            nativeButton={false}
          >
            Back to sign in
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <span className="mb-1 flex size-12 items-center justify-center rounded-full bg-feature-tint text-primary">
          <ShieldCheck className="size-6" />
        </span>
        <CardTitle className="text-xl">Multi-factor verification</CardTitle>
        <CardDescription>
          Enter the 6-digit code from your authenticator app.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center gap-2" onPaste={onPaste}>
          {digits.map((d, i) => (
            <Input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              value={d}
              onChange={(e) => setDigit(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              inputMode="numeric"
              maxLength={1}
              aria-label={`Digit ${i + 1}`}
              className={cn(
                "size-12 p-0 text-center font-mono text-lg tabular-nums",
                i === 2 && "mr-2",
              )}
            />
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          The code refreshes every 30 seconds — if it doesn&apos;t match, wait
          for the next one.
        </p>
      </CardContent>
      <CardFooter className="flex-col gap-3">
        <Button className="w-full" disabled={!complete || submitting} onClick={verify}>
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Verifying…
            </>
          ) : (
            "Verify"
          )}
        </Button>
        <Link
          href="/login"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Back to sign in
        </Link>
      </CardFooter>
    </Card>
  );
}
