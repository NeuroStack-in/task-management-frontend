"use client";

/**
 * The four-term productivity-weight editor (Utilisation / Quality / Focus / Reliability), shared by
 * the org-default card and the per-department sheet. It edits **whole percentages** and only ever
 * hands its parent **fractions summing to 1.0** (the API shape) — converting at `onSubmit`.
 *
 * Validation (React Hook Form + Zod): each term 0–100, and the four must total exactly 100 before
 * the Save button enables. A live "must total 100%" helper tracks the running sum as you type.
 */
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  WEIGHT_META,
  WEIGHT_TERMS,
  isValidPercentSum,
  percentsSum,
  toFractions,
  type PercentWeights,
} from "../../lib/productivity-weights";
import type { ProductivityWeights } from "../../services/productivity.service";

const term = z.coerce
  .number({ invalid_type_error: "0–100" })
  .int("Whole numbers only")
  .min(0, "0–100")
  .max(100, "0–100");

const schema = z
  .object({ u: term, q: term, f: term, r: term })
  .refine((v) => v.u + v.q + v.f + v.r === 100, {
    message: "The four weights must total 100%.",
    path: ["r"],
  });

type FormShape = z.infer<typeof schema>;

export function WeightsForm({
  values,
  canManage,
  busy = false,
  submitLabel = "Save weights",
  onSubmit,
  footerLeft,
}: {
  /** Baseline percentages (from the server or the inherited defaults). Reseeds the form on change. */
  values: PercentWeights;
  canManage: boolean;
  busy?: boolean;
  submitLabel?: string;
  onSubmit: (fractions: ProductivityWeights) => void | Promise<void>;
  /** Extra controls at the left of the footer (e.g. reset-to-defaults). */
  footerLeft?: React.ReactNode;
}) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormShape>({
    resolver: zodResolver(schema),
    defaultValues: values,
    mode: "onChange",
  });

  // Reseed when the baseline changes (a fresh server load, or a reset-to-defaults from the parent).
  useEffect(() => {
    reset(values);
  }, [values, reset]);

  const live = watch();
  const liveSum = percentsSum({
    u: Number(live.u) || 0,
    q: Number(live.q) || 0,
    f: Number(live.f) || 0,
    r: Number(live.r) || 0,
  });
  const sumOk = liveSum === 100;

  const submit = handleSubmit((v) => {
    if (!isValidPercentSum(v)) return; // belt-and-braces; the refine already blocks it
    return onSubmit(toFractions(v));
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {WEIGHT_TERMS.map((t) => (
          <div key={t} className="space-y-1.5 rounded-lg border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`weight-${t}`} className="text-sm font-medium">
                {WEIGHT_META[t].label}
              </Label>
              <div className="flex items-center gap-1">
                <Input
                  id={`weight-${t}`}
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  inputMode="numeric"
                  disabled={!canManage || busy}
                  className="w-20 text-right tabular-nums"
                  aria-invalid={!!errors[t]}
                  {...register(t)}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{WEIGHT_META[t].blurb}</p>
          </div>
        ))}
      </div>

      {/* Live total — the sum-to-100 gate, echoed as a helper. */}
      <div
        className={cn(
          "flex items-center justify-between rounded-md border px-3 py-2 text-sm",
          sumOk
            ? "border-positive/40 bg-positive/10 text-foreground"
            : "border-warning/40 bg-warning/10 text-foreground",
        )}
      >
        <span className="flex items-center gap-2">
          {sumOk ? <Check className="size-4 text-positive" /> : null}
          <span className="text-muted-foreground">Total</span>
        </span>
        <span className="tabular-nums font-medium">
          {liveSum}% <span className="text-muted-foreground">/ must total 100%</span>
        </span>
      </div>

      {canManage && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">{footerLeft}</div>
          <Button type="submit" size="sm" disabled={busy || !sumOk || !isDirty}>
            {busy ? "Saving…" : submitLabel}
          </Button>
        </div>
      )}
    </form>
  );
}
