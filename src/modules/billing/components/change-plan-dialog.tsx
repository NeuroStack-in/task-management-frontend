"use client";

/**
 * Confirmation for `POST /v1/billing/change-plan`.
 *
 * A plan change is money-adjacent and has downstream consequences (it emits `billing.plan_changed`,
 * which `identity` uses to reconcile entitlements), so it is never fired straight off a button — the
 * user sees exactly what is changing, including whether the new seat cap would sit below the seats
 * currently in use, before confirming.
 */
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import {
  BILLING_CADENCES,
  type BillingCadence,
  type BillingOverview,
  type ChangePlanRequest,
  type ServerPlan,
} from "../services/billing.service";

function isCadence(value: string): value is BillingCadence {
  return (BILLING_CADENCES as readonly string[]).includes(value);
}

export function ChangePlanDialog({
  open,
  onOpenChange,
  overview,
  targetPlan,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overview: BillingOverview;
  /** The plan being switched to. `null` while the dialog is closed. */
  targetPlan: ServerPlan | null;
  onConfirm: (req: ChangePlanRequest) => Promise<BillingOverview>;
}) {
  const [cadence, setCadence] = useState<BillingCadence>("monthly");
  const [busy, setBusy] = useState(false);

  // Start from the subscription's current cadence when it is one we can express; the server keeps
  // whatever it already had if we send nothing, so this is a genuine default, not an invention.
  useEffect(() => {
    if (open) {
      setCadence(isCadence(overview.cadence) ? overview.cadence : "monthly");
    }
  }, [open, overview.cadence]);

  if (!targetPlan) return null;

  const downgradeToFree = targetPlan === "free";

  async function confirm() {
    if (!targetPlan) return;
    setBusy(true);
    try {
      const next = await onConfirm({ plan: targetPlan, cadence });
      toast.success(`Now on the ${next.plan} plan`, {
        description:
          next.seat_cap > 0
            ? `${next.seats_used} of ${next.seat_cap} seats · billed ${next.cadence}`
            : `${next.seats_used} seats in use · billed ${next.cadence}`,
      });
      onOpenChange(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // A state guard rejected it — the subscription moved under us (or another change is mid-chain).
        toast.error("The subscription changed while you were deciding.", {
          description: `${e.message} Reload the billing page and try again.`,
        });
      } else {
        toast.error(
          e instanceof ApiError ? e.message : "Couldn't change the plan. Try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {downgradeToFree ? "Downgrade to Free" : `Switch to ${targetPlan}`}
          </DialogTitle>
          <DialogDescription>
            This changes your organization&apos;s subscription immediately and updates what every
            member can access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3 rounded-xl border bg-muted/40 px-4 py-3 text-sm">
            <span className="capitalize text-muted-foreground">{overview.plan}</span>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            <span className="font-medium capitalize">{targetPlan}</span>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Billing cadence</Label>
            <Select
              value={cadence}
              onValueChange={(v) => {
                if (typeof v === "string" && isCadence(v)) setCadence(v);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BILLING_CADENCES.map((c) => (
                  <SelectItem key={c} value={c}>
                    <span className="capitalize">{c}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* The seat cap is derived server-side from the plan, so a downgrade can land under the
              seats already in use. Warn, but don't block — the server allows it. */}
          {downgradeToFree ? (
            <p className="flex gap-2 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2.5 text-xs text-muted-foreground">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              The Free plan has a smaller seat cap. Your{" "}
              <span className="font-medium text-foreground">{overview.seats_used}</span> seats in use
              may exceed it after the change.
            </p>
          ) : null}

          <p className="text-xs text-muted-foreground">
            No payment is collected — payments aren&apos;t enabled in this environment, so the change
            applies straight away.
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="button" onClick={confirm} disabled={busy}>
            {busy ? "Applying…" : downgradeToFree ? "Downgrade" : "Confirm switch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
