import "../landing.css";
import "../marketing.css";
import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { PublicShell } from "@/modules/marketing/public/public-shell";
import { PageHero } from "@/modules/marketing/public/page-hero";
import { ClockCta, SectionHead } from "@/modules/marketing/public/clock-cta";
import { FaqItem, Reveal } from "@/modules/marketing/landing/client";
import { PRICING_NOTE } from "@/modules/marketing/landing/content";
import { PlanCards } from "@/modules/marketing/pricing/plan-cards";
import { BILLING_FAQS, COMPARISON, ON_EVERY_PLAN, PUBLIC_PLANS } from "@/modules/marketing/pricing/content";
import { tierOf } from "@/modules/billing/lib/plans";

export const metadata: Metadata = {
  // The root layout's template appends "· WorkPulse"; "Pricing — WorkPulse" came out with the
  // brand twice (QA audit 2026-10-08, WP-379).
  title: "Pricing",
  description:
    "Simple, per-seat pricing — and every plan is free while WorkPulse is in beta. No card required.",
};

const FEATURED = PUBLIC_PLANS.findIndex((p) => p.featured);

function Cell({ v }: { v: string | boolean }) {
  if (v === true)
    return (
      <span
        className="mx-auto flex size-6 items-center justify-center rounded-full"
        style={{ background: "var(--wp-accent-soft)", color: "var(--wp-accent-ink)" }}
      >
        <Check className="size-3.5" strokeWidth={3} aria-hidden="true" />
        <span className="sr-only">Included</span>
      </span>
    );
  if (v === false)
    return (
      <>
        <Minus className="mx-auto size-4" style={{ color: "var(--wp-border-strong)" }} aria-hidden="true" />
        <span className="sr-only">Not included</span>
      </>
    );
  return <span className="text-sm font-medium" style={{ color: "var(--wp-ink-2)" }}>{v}</span>;
}

/**
 * `/pricing`, on the landing's surface (owner request 2026-10-15): the dark clock hero, the plan
 * cards riding up over its edge, then the cream page. It was a separate dark-petrol design.
 *
 * The hero used to offer a "14-day trial" of Starter and Enterprise. There is no trial anywhere in
 * billing or the plan catalog — every plan is simply free during the beta, which is what the rest of
 * the page and the landing already said.
 */
export default function PricingPage() {
  return (
    <PublicShell>
      <PageHero
        kicker="Pricing"
        title={
          <>
            Simple per-seat pricing. <em>Free in beta.</em>
          </>
        }
        lede="Every plan is free while WorkPulse is in beta, with no card required. After that you pay per active member — monthly, or annually for less."
        overlap="lg"
      />

      {/* Plans — pulled up over the hero's edge. */}
      <section className="relative z-10 -mt-32 px-5 sm:-mt-40">
        <PlanCards />
        <Reveal>
          <p className="mx-auto mt-8 max-w-lg text-center text-xs leading-relaxed" style={{ color: "var(--wp-faint)" }}>
            {PRICING_NOTE}
          </p>
        </Reveal>
      </section>

      {/* On every plan */}
      <section className="px-5 pt-20 sm:pt-24">
        <Reveal className="mx-auto max-w-6xl">
          <div className="wp-card grid gap-6 p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-[auto_repeat(4,1fr)] lg:items-center lg:gap-8">
            <p className="wp-kicker lg:pr-2">On every plan</p>
            {ON_EVERY_PLAN.map((r) => {
              const Icon = r.icon ?? Check;
              return (
                <div key={r.label} className="flex items-center gap-3">
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: "var(--wp-accent-soft)", color: "var(--wp-accent-ink)" }}
                  >
                    <Icon className="size-[18px]" />
                  </span>
                  <span className="text-sm font-medium leading-snug" style={{ color: "var(--wp-ink-2)" }}>
                    {r.label}
                  </span>
                </div>
              );
            })}
          </div>
        </Reveal>
      </section>

      {/* Comparison */}
      <section className="px-5 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            kicker="Compare plans"
            title={
              <>
                Every capability, <em>side by side.</em>
              </>
            }
          />
          <Reveal>
            {/* The frame clips the corners; the inner box scrolls sideways. Four columns need more
                than a phone's width, and with `overflow-hidden` alone the Enterprise column was cut
                off with no way to reach it (QA audit 2026-10-08, WP-545). */}
            <div className="wp-card mt-14 overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[40rem] text-left">
                  <thead>
                    <tr>
                      <th scope="col" className="p-5 align-bottom text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--wp-faint)" }}>
                        Capability
                      </th>
                      {/* Driven off the plans so the table can't drift from the cards above. */}
                      {PUBLIC_PLANS.map((p, j) => (
                        <th
                          key={p.id}
                          scope="col"
                          className="w-[19%] p-5 text-center align-bottom"
                          style={j === FEATURED ? { background: "color-mix(in srgb, var(--wp-accent-soft) 60%, transparent)" } : undefined}
                        >
                          <span className="wp-display block text-xl font-medium" style={{ color: "var(--wp-ink)" }}>
                            {p.name}
                          </span>
                          <span className="wp-mono mt-1 block text-xs font-normal" style={{ color: "var(--wp-muted)" }}>
                            ${tierOf(p.id).pricePerSeat}
                            {tierOf(p.id).pricePerSeat ? " / user / mo" : " forever"}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON.map((row) => (
                      <tr key={row.label} style={{ borderTop: "1px solid var(--wp-border)" }}>
                        <th scope="row" className="px-5 py-4 text-sm font-medium" style={{ color: "var(--wp-ink-2)" }}>
                          {row.label}
                        </th>
                        {row.values.map((v, j) => (
                          <td
                            key={j}
                            className="px-5 py-4 text-center"
                            style={j === FEATURED ? { background: "color-mix(in srgb, var(--wp-accent-soft) 60%, transparent)" } : undefined}
                          >
                            <Cell v={v} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Billing questions */}
      <section className="px-5 py-24 sm:py-28" style={{ background: "var(--wp-bg-2)" }}>
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
          <SectionHead
            align="start"
            kicker="Billing"
            title={
              <>
                Questions, <em>answered.</em>
              </>
            }
            lede="How seats are counted, what the beta means for your bill, and how to move between plans."
          />
          <div className="divide-y" style={{ borderColor: "var(--wp-border-strong)" }}>
            {BILLING_FAQS.map((f, i) => (
              <Reveal key={f.q} delay={i * 50}>
                <FaqItem q={f.q} a={f.a} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* "Talk to sales" once sat here and went to the sign-in form — there is no sales contact to
          send anyone to yet (QA audit 2026-10-08, WP-541). */}
      <ClockCta
        title={
          <>
            Start free <em>today.</em>
          </>
        }
        body="No card required while we're in beta. Set up your organization and be running in an afternoon."
        primary={{ label: "Get started", href: "/register" }}
        secondary={{ label: "Log in", href: "/login" }}
      />
    </PublicShell>
  );
}
