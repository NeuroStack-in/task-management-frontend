"use client";

/**
 * The three plan cards on `/pricing`, with a monthly / annual switch above them.
 *
 * The switch is real: the catalog carries both prices (`pricePerSeat`, `annualPerSeat`) and billing
 * takes either cadence (`billing.service.ts`). Monthly is the default so the first figure anyone sees
 * is the one the landing page quotes.
 */
import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { tierOf } from "@/modules/billing/lib/plans";
import { Reveal } from "@/modules/marketing/landing/client";
import { ANNUAL_SAVING_PCT, PUBLIC_PLANS } from "./content";

type Cadence = "monthly" | "annual";

export function PlanCards() {
  const [cadence, setCadence] = useState<Cadence>("monthly");

  return (
    <>
      <div className="flex justify-center">
        <div role="radiogroup" aria-label="Billing period" className="wp-seg">
          {(["monthly", "annual"] as const).map((c) => (
            <button key={c} type="button" role="radio" aria-checked={cadence === c} onClick={() => setCadence(c)}>
              {c === "monthly" ? "Monthly" : "Annual"}
              {c === "annual" ? <span className="wp-seg-save">Save up to {ANNUAL_SAVING_PCT}%</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-10 grid max-w-6xl items-stretch gap-6 lg:grid-cols-3">
        {PUBLIC_PLANS.map((p, i) => {
          const t = tierOf(p.id);
          const price = cadence === "annual" ? t.annualPerSeat : t.pricePerSeat;
          const free = t.pricePerSeat === 0;
          return (
            <Reveal key={p.id} delay={i * 90} className="h-full">
              <div
                className="wp-card relative flex h-full flex-col overflow-hidden p-7 sm:p-8"
                style={
                  p.featured
                    ? {
                        borderColor: "var(--wp-accent)",
                        boxShadow: "0 30px 70px -34px color-mix(in srgb, var(--wp-accent) 60%, transparent)",
                      }
                    : { boxShadow: "var(--wp-shadow)" }
                }
              >
                {p.featured ? (
                  <>
                    <span
                      className="pointer-events-none absolute inset-x-0 top-0 h-28"
                      aria-hidden="true"
                      style={{ background: "linear-gradient(180deg, var(--wp-accent-soft), transparent)" }}
                    />
                    <span
                      className="absolute top-6 right-6 rounded-full px-3 py-1 text-xs font-semibold"
                      style={{ background: "var(--wp-accent)", color: "#fff" }}
                    >
                      Recommended
                    </span>
                  </>
                ) : null}

                <div className="relative">
                  <h3 className="wp-display text-2xl" style={{ color: "var(--wp-ink)" }}>
                    {p.name}
                  </h3>
                  <p className="mt-1.5 min-h-[2.5rem] text-sm leading-snug" style={{ color: "var(--wp-muted)" }}>
                    {p.tagline}
                  </p>

                  <p className="mt-6 flex items-baseline gap-1.5">
                    <span className="wp-display text-6xl" style={{ color: "var(--wp-ink)" }}>
                      ${price}
                    </span>
                    <span className="text-sm" style={{ color: "var(--wp-muted)" }}>
                      {free ? "forever" : "/ user / mo"}
                    </span>
                  </p>
                  <p className="wp-mono mt-1.5 h-4 text-xs" style={{ color: "var(--wp-faint)" }}>
                    {free ? "No card, no time limit" : cadence === "annual" ? `billed annually · $${t.pricePerSeat} if monthly` : "billed monthly"}
                  </p>
                </div>

                <div className="my-6 h-px" style={{ background: "var(--wp-border)" }} />

                <ul className="relative flex-1 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--wp-ink-2)" }}>
                      <span
                        className="mt-px flex size-[18px] shrink-0 items-center justify-center rounded-full"
                        style={{ background: "var(--wp-accent-soft)", color: "var(--wp-accent-ink)" }}
                      >
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link href="/register" className={`wp-btn relative mt-8 w-full ${p.featured ? "wp-btn-primary" : "wp-btn-ghost"}`}>
                  {p.cta}
                </Link>
              </div>
            </Reveal>
          );
        })}
      </div>
    </>
  );
}
