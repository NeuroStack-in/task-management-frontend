import "../marketing.css";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, Minus } from "lucide-react";
import { MarketingNav } from "@/modules/marketing/marketing-nav";
import { MarketingFooter } from "@/modules/marketing/marketing-footer";
import { Reveal } from "@/modules/marketing/reveal";

export const metadata: Metadata = {
  title: "Pricing — WorkPulse",
  description:
    "Simple, per-seat pricing. Start free, or trial Starter and Enterprise for 14 days — no card required.",
};

/**
 * The three tiers, mirroring `Plan` in `crates/wp-contracts/src/plans.rs`:
 * `free | starter | enterprise`. The server can only ever issue one of these, so a
 * fourth tier here would be a plan nobody can actually buy.
 *
 * Was Free/Pro/Max, with a fourth "Enterprise" that existed only on the landing page —
 * the surfaces disagreed with each other and none matched the catalog. Pro became
 * Starter; Max folded into Enterprise.
 */
const PLANS = [
  {
    name: "Free",
    price: "$0",
    unit: "forever",
    tagline: "For individuals and very small teams getting started.",
    features: ["Core time tracking & timesheets", "Up to 5 members", "1 active project", "7-day activity history", "Community support"],
    cta: "Get started free",
    featured: false,
  },
  {
    name: "Starter",
    price: "$12",
    unit: "/ user / mo",
    tagline: "For growing teams that need real insight.",
    features: ["Everything in Free", "Activity & productivity analytics", "Unlimited projects & tasks", "Reports, dashboards & exports", "Attendance & payroll", "Priority support"],
    cta: "Start free trial",
    featured: false,
  },
  {
    name: "Enterprise",
    price: "$22",
    unit: "/ user / mo",
    tagline: "For organizations operating at scale.",
    features: ["Everything in Starter", "AI anomaly & burnout detection", "Audit logs, DPA & data residency", "Advanced security & roles", "Custom contracts & premier SLA", "Dedicated success manager"],
    cta: "Start free trial",
    featured: true,
  },
];

const COMPARISON: { label: string; values: [string | boolean, string | boolean, string | boolean] }[] = [
  { label: "Time tracking & timesheets", values: [true, true, true] },
  { label: "Members", values: ["Up to 5", "Unlimited", "Unlimited"] },
  { label: "Active projects", values: ["1", "Unlimited", "Unlimited"] },
  { label: "Activity & productivity analytics", values: [false, true, true] },
  { label: "Screenshots & app/URL usage", values: [false, true, true] },
  { label: "Attendance & payroll", values: [false, true, true] },
  { label: "Reports & exports", values: ["Basic", true, true] },
  { label: "AI insights & anomaly detection", values: [false, false, true] },
  { label: "Google & Microsoft sign-in", values: [true, true, true] },
  { label: "Audit logs, DPA & data residency", values: [false, false, true] },
  { label: "Support", values: ["Community", "Priority", "Dedicated CSM"] },
];

const FAQS = [
  { q: "How does per-seat billing work?", a: "You're billed per active user per month. Suspended and uninvited users don't count. Annual billing saves ~17% over monthly." },
  { q: "Is there really a free plan?", a: "Yes — Free is free forever for up to 5 members. Starter and Enterprise include a 14-day free trial with no card required." },
  { q: "Can I change plans later?", a: "Upgrade or downgrade anytime. Upgrades are prorated immediately; downgrades take effect at the next cycle." },
  { q: "Do you offer enterprise terms?", a: "Enterprise includes audit logs, data residency, advanced roles, and a signed DPA. Talk to sales for volume and procurement." },
];

function Cell({ v }: { v: string | boolean }) {
  if (v === true) return <Check className="mx-auto size-4" style={{ color: "var(--m-accent)" }} />;
  if (v === false) return <Minus className="mx-auto size-4" style={{ color: "var(--m-faint)" }} />;
  return <span className="text-sm" style={{ color: "var(--m-muted)" }}>{v}</span>;
}

export default function PricingPage() {
  return (
    <div className="m-root min-h-screen overflow-x-hidden">
      <MarketingNav />

      {/* Hero */}
      <section className="relative overflow-hidden px-5 pt-32 pb-12 sm:pt-40">
        <div className="m-aurora" aria-hidden="true">
          <span style={{ width: "42vw", height: "42vw", left: "8%", top: "0%", background: "var(--m-accent)", animation: "m-drift-a 28s ease-in-out infinite" }} />
          <span style={{ width: "36vw", height: "36vw", right: "4%", top: "-4%", background: "var(--m-accent-3)", animation: "m-drift-c 32s ease-in-out infinite" }} />
        </div>
        <div className="relative z-10 mx-auto max-w-2xl text-center">
          <p className="m-enter-up text-sm font-medium tracking-wide uppercase" style={{ color: "var(--m-accent-ink)" }}>
            Pricing
          </p>
          <h1 className="m-display m-enter-up mt-3 text-[clamp(2.2rem,5vw,3.4rem)] leading-tight font-semibold" style={{ animationDelay: "80ms" }}>
            Simple, per-seat pricing.
          </h1>
          <p className="m-enter-up mx-auto mt-5 max-w-xl text-base leading-relaxed sm:text-lg" style={{ color: "var(--m-muted)", animationDelay: "160ms" }}>
            Start free, or trial Starter and Enterprise for 14 days — no card required. Pay per
            active user, billed monthly or annually.
          </p>
        </div>
      </section>

      {/* Plans */}
      <section className="px-5 pb-8">
        <div className="mx-auto grid max-w-5xl items-stretch gap-6 lg:grid-cols-3">
          {PLANS.map((p, i) => (
            <Reveal key={p.name} delay={i * 80}>
              <div
                className="m-card relative flex h-full flex-col p-7"
                style={p.featured ? { borderColor: "var(--m-accent)", boxShadow: "0 24px 60px -36px color-mix(in srgb, var(--m-accent) 55%, transparent)" } : undefined}
              >
                {p.featured ? (
                  <span className="absolute -top-3 left-7 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "var(--m-accent)", color: "var(--m-on-accent)" }}>
                    Recommended
                  </span>
                ) : null}
                <h3 className="m-display text-lg font-semibold">{p.name}</h3>
                <p className="mt-1 text-sm" style={{ color: "var(--m-muted)" }}>{p.tagline}</p>
                <p className="mt-5">
                  <span className="m-display text-4xl font-semibold">{p.price}</span>{" "}
                  <span className="text-sm" style={{ color: "var(--m-muted)" }}>{p.unit}</span>
                </p>
                <ul className="mt-6 flex-1 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0" style={{ color: "var(--m-accent)" }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className={`m-btn mt-7 w-full ${p.featured ? "m-btn-primary" : "m-btn-ghost"}`}>
                  {p.cta}
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Comparison table */}
      <section className="px-5 py-20 sm:py-24">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <h2 className="m-display text-center text-3xl font-semibold sm:text-4xl">Compare plans</h2>
          </Reveal>
          <Reveal>
            <div className="mt-10 overflow-hidden rounded-2xl border" style={{ borderColor: "var(--m-border)" }}>
              <table className="w-full text-left">
                <thead>
                  <tr style={{ background: "var(--m-surface)" }}>
                    <th className="p-4 text-sm font-semibold">Capability</th>
                    {/* Driven off PLANS so the table can't drift from the cards above. */}
                    {PLANS.map((p) => p.name).map((h) => (
                      <th key={h} className="p-4 text-center text-sm font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row, i) => (
                    <tr key={row.label} style={{ borderTop: "1px solid var(--m-border)", background: i % 2 ? "color-mix(in srgb, var(--m-surface) 50%, transparent)" : "transparent" }}>
                      <td className="p-4 text-sm">{row.label}</td>
                      {row.values.map((v, j) => (
                        <td key={j} className="p-4 text-center">
                          <Cell v={v} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-5 py-16 sm:py-20" style={{ background: "var(--m-surface)" }}>
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <h2 className="m-display text-center text-3xl font-semibold sm:text-4xl">Billing questions</h2>
          </Reveal>
          <div className="mt-10 divide-y" style={{ borderColor: "var(--m-border)" }}>
            {FAQS.map((f, i) => (
              <Reveal key={f.q} delay={i * 50}>
                <div className="py-5">
                  <p className="font-medium">{f.q}</p>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--m-muted)" }}>{f.a}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 py-24 sm:py-28">
        <Reveal>
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="m-display text-3xl font-semibold sm:text-4xl">Start free today.</h2>
            <p className="mx-auto mt-4 max-w-md text-base" style={{ color: "var(--m-muted)" }}>
              No card required. Be up and running in an afternoon.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/register" className="m-btn m-btn-primary">
                Get started <ArrowRight className="size-4" />
              </Link>
              <Link href="/login" className="m-btn m-btn-ghost">Talk to sales</Link>
            </div>
          </div>
        </Reveal>
      </section>

      <MarketingFooter />
    </div>
  );
}
