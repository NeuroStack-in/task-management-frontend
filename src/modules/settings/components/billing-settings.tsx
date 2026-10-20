"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Check, CreditCard, FileText, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader } from "@/components/shared/loader";
import { ApiError } from "@/lib/api";
import { usePermissions } from "@/hooks/use-permissions";
import { refreshEntitlements } from "@/hooks/use-features";
import { effectiveFromState, useEntitlementsStore } from "@/stores/entitlements.store";
import {
  annualSaving,
  cadenceOf,
  downgradeLoss,
  FEATURE_LABELS,
  PLAN_TIERS,
  priceFor,
  type Cadence,
  type FeatureKeyId,
  type PlanTier,
} from "@/modules/billing/lib/plans";
import { formatCurrency } from "@/lib/currency";
import { changePlan } from "@/modules/billing/services/billing.service";
import { useBilling } from "@/modules/billing/use-billing";
import { cn } from "@/lib/utils";

/** A plan switch, or a cadence switch on the current plan, waiting for confirmation. */
type Pending =
  | { kind: "plan"; tier: PlanTier; cadence: Cadence }
  | { kind: "cadence"; tier: PlanTier; cadence: Cadence };

const linkClass = "text-primary font-medium underline-offset-2 hover:underline";

/**
 * Billing (Settings → Billing) — plan, seats, plan switching, payment and invoices.
 *
 * **This is the only billing page.** There used to be two: this panel, and a `BillingView` under
 * `/billing` that carried the plan switcher. `/billing` had been reduced to a `redirect()` back to
 * here, so the "Billing Center" button on this page pointed at a route that pointed back at this
 * page — a loop — and `BillingView` was orphaned, imported by nothing. The net effect was that
 * **no user could change their plan from the UI at all**, even though `POST /v1/billing/change-plan`
 * was live and working. The switcher now lives here and that component is gone.
 *
 * Payment and invoices stay honest "not enabled" placeholders — there is no provider and no
 * endpoint, and inventing UI for either would be a promise the product cannot keep.
 */
export function BillingSettings() {
  const { can } = usePermissions();
  const canManage = can("billing:manage");
  const { overview, loading, error, reload } = useBilling();
  // Which features are on right now — what a downgrade would switch off (SET-09).
  const entitlements = useEntitlementsStore();

  /**
   * The prices the plan cards show (UX audit 2026-10-16, SET-10). They always showed the monthly
   * price, though sign-up and /pricing sell annual too. Starts on the org's own cadence; flipping it
   * only changes what is shown until a switch is confirmed.
   */
  const [cadence, setCadence] = useState<Cadence>("monthly");
  const orgCadence = cadenceOf(overview?.cadence);
  useEffect(() => {
    setCadence(orgCadence);
  }, [orgCadence]);

  const [pending, setPending] = useState<Pending | null>(null);
  const [changing, setChanging] = useState(false);

  async function confirmChange() {
    if (!pending) return;
    setChanging(true);
    try {
      const { tier: target, cadence: nextCadence } = pending;
      await changePlan({ plan: target.id, cadence: nextCadence });
      toast.success(
        pending.kind === "cadence"
          ? `Your ${target.name} plan is now billed ${nextCadence === "annual" ? "annually" : "monthly"}.`
          : `You're on the ${target.name} plan.`,
        { description: "Nothing is charged during the beta." },
      );
      setPending(null);
      // Re-fetch so the new plan, cadence and seat cap render.
      reload();
      // …and the shared entitlements the sidebar, route guard and upgrade walls read. They were
      // hydrated once per page load and never again, so the app kept gating on the old plan until
      // a hard reload (QA audit 2026-10-08, WP-335). The server applies the plan to entitlements
      // asynchronously (`billing.plan_changed`), so this waits for it to land.
      if (pending.kind === "plan") {
        void refreshEntitlements(target.id).then((synced) => {
          if (!synced) {
            toast.info("Your new plan is still being applied.", {
              description: "Reload in a minute if a section still looks out of date.",
            });
          }
        });
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        toast.error("You don't have permission to change the plan.");
      } else if (e instanceof ApiError && e.code === "seats_exceed_plan") {
        // The server refuses a plan that can't hold the people already on it (WP-051).
        toast.error("That plan has fewer seats than you use", {
          description: "Deactivate members until you fit its seat limit, then switch.",
        });
      } else {
        toast.error(e instanceof ApiError ? e.message : "Couldn't change the plan. Try again.");
      }
    } finally {
      setChanging(false);
    }
  }

  if (loading && !overview) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader label="Loading billing…" />
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="space-y-6">
        <PageHeader title="Billing" description="Your plan, payment method, and invoices." />
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">{error ?? "Billing is unavailable."}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const tier = PLAN_TIERS.find((t) => t.id === overview.plan);
  // The server counts active members live now (UX audit SET-02 — the stored counter read "0 / 1000
  // seats" in an org of real people). Said as people, linked to the list that holds them.
  const members = `${overview.seats_used} active member${overview.seats_used === 1 ? "" : "s"}`;
  const seatsOf =
    overview.seat_cap > 0 ? ` of ${overview.seat_cap.toLocaleString()} seats on this plan` : "";
  // Already over the cap on the CURRENT plan — worth saying before they pick a smaller one.
  const overCapNow = overview.seat_cap > 0 && overview.seats_used > overview.seat_cap;
  const currentIndex = PLAN_TIERS.findIndex((t) => t.id === overview.plan);
  const cadenceWord = (c: Cadence) => (c === "annual" ? "annually" : "monthly");
  // What this plan would cost once billing starts — said beside "free", never instead of it, and
  // at the org's own cadence.
  const seatWord = overview.seats_used === 1 ? "seat" : "seats";
  const orgPrice = tier ? priceFor(tier, orgCadence) : 0;
  const laterCost = !tier
    ? "The prices below apply only once billing starts."
    : overview.seats_used > 0
      ? `Once billing starts, the ${tier.name} plan would be ${overview.seats_used} ${seatWord} × ${formatCurrency(orgPrice)} = ${formatCurrency(overview.seats_used * orgPrice)} a month, billed ${cadenceWord(orgCadence)}.`
      : `Once billing starts, the ${tier.name} plan would be ${formatCurrency(orgPrice)} per seat a month, billed ${cadenceWord(orgCadence)}.`;
  const canInvite = can("employees:manage");

  // The confirmation's consequences, worked out once.
  const target = pending?.tier ?? null;
  const overCapAfter =
    pending?.kind === "plan" && target !== null && overview.seats_used > target.seatCap;
  const isUpgrade = pending?.kind === "plan" && target !== null && PLAN_TIERS.indexOf(target) > currentIndex;
  const loss =
    pending?.kind === "plan" && tier && target
      ? downgradeLoss(tier, target, (k) => effectiveFromState(entitlements, k))
      : null;
  const stopsCapture =
    loss?.switchedOff.some((k) => k === "monitoring.screenshots" || k === "monitoring.activity") ??
    false;
  const names = (keys: FeatureKeyId[]) => keys.map((k) => FEATURE_LABELS[k]).join(", ");

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Manage your plan, payment method, and invoices." />

      {/* Said first, before any price: nothing is charged during the beta. The page used to open on
          "Enterprise plan · US$22/seat/mo · status: active" beside a red Cancel button, with the only
          hint at the foot of the card (UX audit 2026-10-16, SET-01). */}
      <section
        aria-label="Beta pricing"
        className="border-success/30 bg-success/[0.06] flex gap-3 rounded-2xl border p-4"
      >
        <BadgeCheck className="text-success mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">Free during the beta. You&apos;re not being charged.</p>
          <p className="text-muted-foreground mt-0.5 text-sm">{laterCost}</p>
        </div>
      </section>

      <Card>
        <CardContent className="divide-y p-0">
          {/* Plan — real */}
          <section className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <span className="bg-feature-tint text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                <CreditCard className="size-5" />
              </span>
              <div>
                <p className="font-heading font-semibold capitalize">{overview.plan} plan</p>
                <p className="text-muted-foreground text-sm">
                  {tier?.blurb ?? "Your organization's current subscription."}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  {can("employees:view") ? (
                    <Link
                      href="/employees"
                      className="text-foreground font-medium underline-offset-2 hover:underline"
                    >
                      {members}
                    </Link>
                  ) : (
                    <span className="text-foreground font-medium">{members}</span>
                  )}
                  {seatsOf} · billed {cadenceWord(orgCadence)} ·{" "}
                  {overview.status.replace(/_/g, " ")}
                </p>
                {/* There is no "buy seats" step (UX audit SET-09): a seat is an active member, so
                    the way to add one is to invite someone. Said here, where people look for it. */}
                <p className="text-muted-foreground mt-1.5 text-xs">
                  A seat is an active member: inviting someone adds one, and deactivating someone
                  frees one. There&apos;s nothing to buy separately.
                </p>
                {overCapNow ? (
                  <p className="text-warning mt-1.5 text-xs">
                    You&apos;re using more seats than this plan allows. Upgrade, or deactivate
                    members to come back under the cap.
                  </p>
                ) : null}
              </div>
            </div>
            {canInvite ? (
              <Button
                size="sm"
                variant="outline"
                className="shrink-0 self-start"
                render={<Link href="/employees" />}
                nativeButton={false}
              >
                <UserPlus className="size-3.5" /> Invite people
              </Button>
            ) : null}
          </section>

          {/* Plans — the switcher. Was orphaned in a component no route rendered. */}
          <section className="space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">Plans</p>
              <CadenceSwitch value={cadence} onChange={setCadence} />
            </div>
            {!canManage ? (
              <p className="text-muted-foreground text-xs">
                Only an owner or billing admin can change the plan.
              </p>
            ) : null}
            {/* Looking at the other cadence's prices is not switching to it — say which is which,
                and offer the switch itself. */}
            {cadence !== orgCadence ? (
              <p className="bg-muted/60 text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-3 py-2 text-xs">
                <span>
                  Showing {cadence} prices. Your organization is billed {cadenceWord(orgCadence)}.
                </span>
                {canManage && tier ? (
                  <button
                    type="button"
                    className={linkClass}
                    onClick={() => setPending({ kind: "cadence", tier, cadence })}
                  >
                    Switch to {cadence} billing
                  </button>
                ) : null}
              </p>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-3">
              {PLAN_TIERS.map((t, i) => {
                const current = t.id === overview.plan;
                // "Upgrade" vs "Switch" reads off the tier's position, so the button says what it
                // actually does. It used to say "Switch" for all three, which is why nobody could
                // find an upgrade button.
                const label = i > currentIndex ? "Upgrade" : "Switch";
                const saving = cadence === "annual" ? annualSaving(t) : 0;
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "flex flex-col rounded-2xl border p-4",
                      current ? "border-primary bg-primary/[0.03]" : "border-border",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{t.name}</p>
                      {current ? (
                        <Badge variant="secondary" className="text-[11px]">
                          Current
                        </Badge>
                      ) : null}
                    </div>
                    {/* Free first, then the price it would be — never the price alone (SET-01). */}
                    <p className="text-success mt-1 text-xs font-medium">Free during the beta</p>
                    <p className="font-display text-xl font-semibold tabular-nums">
                      {formatCurrency(priceFor(t, cadence))}
                      <span className="text-muted-foreground text-xs font-normal">
                        {" "}
                        /seat/mo
                      </span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {t.pricePerSeat === 0
                        ? "Always free"
                        : cadence === "annual"
                          ? `Billed annually${saving > 0 ? ` · save ${saving}%` : ""}`
                          : "Billed monthly"}
                    </p>
                    <ul className="text-muted-foreground mt-3 space-y-1.5 text-xs">
                      {t.features.map((f) => (
                        <li key={f} className="flex items-center gap-1.5">
                          <Check className="text-success size-3 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    {!current ? (
                      <Button
                        size="sm"
                        variant={i > currentIndex ? "default" : "outline"}
                        className="mt-4 w-full"
                        disabled={!canManage}
                        onClick={() => setPending({ kind: "plan", tier: t, cadence })}
                      >
                        {label}
                      </Button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Payment — no endpoint yet */}
          <section className="space-y-3 p-5">
            <p className="text-sm font-semibold">Payment</p>
            <div className="text-muted-foreground flex items-center gap-2.5 text-sm">
              <CreditCard className="size-4" />
              No payment method on file — payments aren&apos;t enabled yet.
            </div>
          </section>

          {/* Invoices — no endpoint yet */}
          <section className="space-y-3 p-5">
            <p className="text-sm font-semibold">Invoices</p>
            <div className="text-muted-foreground flex items-center gap-2.5 text-sm">
              <FileText className="size-4" />
              No invoices yet. Invoicing isn&apos;t enabled for this environment.
            </div>
          </section>

          {/* Cancellation — there is no billing period to run out (nothing is charged yet), so the
              copy says what is true: self-serve cancellation isn't available (WP-526). */}
          <section className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">Cancel plan</p>
              <p className="text-muted-foreground text-xs">
                Self-serve cancellation isn&apos;t available yet. Contact support to cancel.
              </p>
            </div>
            {/* Neutral, not red: nothing is being paid for, so there is nothing to lose (SET-01). */}
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={!canManage}
              onClick={() =>
                toast.info("Self-serve cancellation isn't enabled yet.", {
                  description: "Contact support to change your plan.",
                })
              }
            >
              Cancel
            </Button>
          </section>
        </CardContent>
      </Card>

      <Dialog open={pending !== null} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pending?.kind === "cadence"
                ? `Switch to ${pending.cadence} billing?`
                : `Switch to ${target?.name ?? ""}?`}
            </DialogTitle>
            <DialogDescription>
              {pending?.kind === "cadence" && target ? (
                <>
                  Your {target.name} plan would be billed {cadenceWord(pending.cadence)} at{" "}
                  {formatCurrency(priceFor(target, pending.cadence))}/seat/mo instead of{" "}
                  {formatCurrency(priceFor(target, orgCadence))}/seat/mo once billing starts. Your
                  plan, seats and features don&apos;t change. Nothing is charged — payments
                  aren&apos;t enabled yet.
                </>
              ) : pending && target ? (
                <>
                  Your organization moves from the{" "}
                  <span className="capitalize">{overview.plan}</span> plan to {target.name} (
                  {formatCurrency(priceFor(target, pending.cadence))}/seat/mo, billed{" "}
                  {cadenceWord(pending.cadence)}
                  {target.seatCap > 0
                    ? `, up to ${target.seatCap.toLocaleString()} seats`
                    : ", unlimited seats"}
                  ). The change takes effect immediately. Nothing is charged — payments aren&apos;t
                  enabled yet.
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          {/* What a downgrade takes away, by name (UX audit SET-09). The server switches off every
              feature the new plan doesn't allow the moment it applies (`apply_plan_change`); the
              dialog used to say only that it "adjusts which features your plan allows". */}
          {loss && (loss.switchedOff.length > 0 || loss.unavailable.length > 0 || loss.seatCap) ? (
            <div className="space-y-2 text-sm">
              <p className="font-medium">What you lose</p>
              <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-xs">
                {loss.switchedOff.length > 0 ? (
                  <li>
                    <span className="text-destructive font-medium">Switched off for everyone now:</span>{" "}
                    {names(loss.switchedOff)}.
                    {stopsCapture
                      ? " The desktop agents stop capturing screenshots and activity on every device."
                      : ""}
                  </li>
                ) : null}
                {loss.unavailable.length > 0 ? (
                  <li>
                    <span className="text-foreground font-medium">No longer available:</span>{" "}
                    {names(loss.unavailable)}.
                  </li>
                ) : null}
                {loss.seatCap !== null && tier ? (
                  <li>
                    <span className="text-foreground font-medium">Seat limit:</span>{" "}
                    {tier.seatCap.toLocaleString()} → {loss.seatCap.toLocaleString()} active
                    members.
                  </li>
                ) : null}
              </ul>
            </div>
          ) : null}
          {overCapAfter && target ? (
            // The server refuses this switch outright (`seats_exceed_plan`); it said "reduce active
            // members after switching", which never got that far.
            <p className="bg-warning/10 text-warning rounded-lg px-3 py-2 text-xs">
              You have {overview.seats_used} active members — more than the {target.name} plan&apos;s{" "}
              {target.seatCap.toLocaleString()}. Deactivate members until you fit, then switch.
            </p>
          ) : null}
          {/* Upgrading widens the plan's ceiling but does NOT switch new features on: the server
              recomputes `allowed` and leaves `enabled` alone, so someone still has to turn them on
              in Settings → Features. Saying so here prevents "I upgraded and nothing changed". */}
          {isUpgrade ? (
            <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-2 text-xs">
              New features are added to your plan but stay switched off. Turn them on in{" "}
              {can("settings:view") ? (
                <Link href="/settings/features" className={linkClass}>
                  Settings → Features
                </Link>
              ) : (
                <span className="text-foreground font-medium">Settings → Features</span>
              )}
              .
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)} disabled={changing}>
              Cancel
            </Button>
            <Button onClick={confirmChange} disabled={changing || overCapAfter}>
              {changing
                ? "Switching…"
                : pending?.kind === "cadence"
                  ? `Switch to ${pending.cadence} billing`
                  : `Switch to ${target?.name ?? ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Monthly / Annual — which prices the plan cards show (UX audit SET-10). */
function CadenceSwitch({ value, onChange }: { value: Cadence; onChange: (c: Cadence) => void }) {
  const options: { value: Cadence; label: string }[] = [
    { value: "monthly", label: "Monthly" },
    { value: "annual", label: "Annual" },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Show prices billed"
      className="bg-muted inline-flex rounded-lg p-0.5"
    >
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                e.preventDefault();
                // Focus follows the selection (the radio-group pattern).
                const other = e.currentTarget.parentElement?.querySelector<HTMLElement>(
                  '[role="radio"][aria-checked="false"]',
                );
                onChange(o.value === "monthly" ? "annual" : "monthly");
                other?.focus();
              }
            }}
            tabIndex={on ? 0 : -1}
            className={cn(
              "rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none",
              on ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
