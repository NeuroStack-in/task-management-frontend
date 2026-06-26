"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { cn } from "@/lib/utils";

const LENGTH = 6;
const RESEND_SECONDS = 30;

export function MfaForm() {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const [submitting, setSubmitting] = useState(false);
  const [seconds, setSeconds] = useState(RESEND_SECONDS);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (seconds <= 0) return;
    const id = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [seconds]);

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
    if (!complete) return;
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 600));
    toast.success("Verified", { description: "Welcome back." });
    router.push("/dashboard");
  };

  const resend = () => {
    setSeconds(RESEND_SECONDS);
    toast.info("A new code has been sent (simulated).");
  };

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
          Didn&apos;t get a code?{" "}
          {seconds > 0 ? (
            <span>Resend in {seconds}s</span>
          ) : (
            <button
              type="button"
              onClick={resend}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Resend code
            </button>
          )}
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
