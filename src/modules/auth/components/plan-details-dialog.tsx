"use client";

/**
 * Full plan comparison, opened from the (i) beside the plan step's heading.
 *
 * The step itself shows three compact rows — name, one-line pitch, price — because that is what
 * fits a 30rem column without the card outgrowing the viewport. The detail that would not fit
 * (every plan's full feature list) lives here instead of being cut from the product entirely.
 *
 * It is **selectable, not just readable**: choosing a plan here sets it and closes. A dialog that
 * shows you the differences and then makes you close it and find the row again is a worse version
 * of the same information.
 *
 * Prices follow the caller's billing toggle so the two surfaces never disagree — the annual figure
 * is per-user-per-month billed yearly, which is stated rather than implied.
 */

import { Check } from "lucide-react";
import { MModal, PLANS } from "./auth-modals";

export function PlanDetailsDialog({
  open,
  onClose,
  billing,
  selected,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  billing: "monthly" | "annual";
  selected: string;
  onSelect: (planId: string) => void;
}) {
  return (
    <MModal open={open} onClose={onClose} maxW="max-w-2xl">
      <div className="shrink-0 border-b p-5 pr-12" style={{ borderColor: "var(--m-border)" }}>
        <h2 className="m-display text-lg font-semibold" id="plan-details-title">
          Compare plans
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--m-muted)" }}>
          Everything is free while WorkPulse is in beta. You can change plan later in Settings.
        </p>
      </div>

      {/* The shell caps at 92vh; this is the part that scrolls. */}
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <ul className="flex flex-col gap-3">
          {PLANS.map((pl) => {
            const price = billing === "annual" ? pl.annual : pl.monthly;
            const on = selected === pl.id;
            return (
              <li key={pl.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(pl.id);
                    onClose();
                  }}
                  aria-pressed={on}
                  className="m-plancard"
                  data-on={on}
                >
                  <span className="m-plancard__head">
                    <span className="m-plancard__mark" aria-hidden="true">
                      {on ? <Check /> : null}
                    </span>
                    <span className="m-plancard__name">
                      {pl.name}
                      {pl.featured ? <i>Recommended</i> : null}
                    </span>
                    <span className="m-plancard__price">
                      {price === 0 ? "$0" : `$${price}`}
                      <i>
                        {price === 0
                          ? " forever"
                          : billing === "annual"
                            ? " / user / mo, yearly"
                            : " / user / mo"}
                      </i>
                    </span>
                  </span>

                  <span className="m-plancard__tagline">{pl.tagline}</span>

                  <span className="m-plancard__features">
                    {pl.features.map((f) => (
                      <span key={f}>
                        <Check aria-hidden="true" />
                        {f}
                      </span>
                    ))}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="shrink-0 border-t p-4" style={{ borderColor: "var(--m-border)" }}>
        <button type="button" onClick={onClose} className="m-btn m-btn-ghost w-full">
          Close
        </button>
      </div>
    </MModal>
  );
}
