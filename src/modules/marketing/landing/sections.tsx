/* ============================================================= *
 *  WorkPulse — Landing sections (server components)              *
 *  Warm editorial layout. Static content renders on the server; *
 *  interactive pieces are client islands (client.tsx).          *
 * ============================================================= */

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check } from "lucide-react";
import {
  STATS,
  FEATURE_BLOCKS,
  MODULE_GROUPS,
  STEPS,
  ENTERPRISE,
  PRINCIPLES,
  PRICING,
  PRICING_NOTE,
  FAQS,
  FOOTER_COLUMNS,
} from "./content";
import { Visual } from "./visuals";
import { Reveal, CountUp, UseCaseMarquee, RoleSelector, FaqItem } from "./client";

/* ---------------- Use-case marquee band ---------------- */
export function MarqueeSection() {
  return (
    <section className="border-y py-8" style={{ borderColor: "var(--wp-border)", background: "var(--wp-bg-2)" }}>
      <p className="wp-kicker mb-5 px-5 text-center">Built for the way teams actually work</p>
      <UseCaseMarquee />
    </section>
  );
}

/* ---------------- Oversized stat band ---------------- */
export function StatsSection() {
  return (
    <section className="px-5 py-20 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map((s, i) => (
          <Reveal key={s.label} delay={i * 90} className="text-center">
            <p className="wp-display text-[clamp(3rem,7vw,4.6rem)]" style={{ color: "var(--wp-accent)" }}>
              {s.to != null ? <CountUp to={s.to} suffix={s.suffix} /> : s.value}
            </p>
            <p className="mt-1 text-sm" style={{ color: "var(--wp-muted)" }}>{s.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Big editorial feature blocks ---------------- */
export function FeaturesSection() {
  return (
    <section id="features" className="px-5 py-8">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="wp-kicker">One platform</p>
          <h2 className="wp-display mt-4 text-[clamp(2rem,4.5vw,3.2rem)]" style={{ color: "var(--wp-ink)" }}>
            Everything you need to run the work — and the people doing it.
          </h2>
        </Reveal>

        <div className="mt-20 space-y-24 sm:space-y-32">
          {FEATURE_BLOCKS.map((f, i) => {
            const Icon = f.icon;
            const flip = i % 2 === 1;
            return (
              <div key={f.idx} className={`grid items-center gap-10 lg:grid-cols-2 lg:gap-16 ${flip ? "lg:[&>*:first-child]:order-2" : ""}`}>
                <Reveal variant={flip ? "right" : "left"}>
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="wp-display text-5xl" style={{ color: "var(--wp-accent-glow)" }}>{f.idx}</span>
                      <span className="wp-kicker inline-flex items-center gap-1.5">
                        <Icon className="size-3.5" /> {f.kicker}
                      </span>
                    </div>
                    <h3 className="wp-display mt-4 text-[clamp(1.9rem,4vw,2.9rem)]" style={{ color: "var(--wp-ink)" }}>{f.title}</h3>
                    <p className="mt-4 max-w-md text-lg leading-relaxed" style={{ color: "var(--wp-muted)" }}>{f.body}</p>
                    <ul className="mt-6 space-y-2.5">
                      {f.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2.5 text-[15px]">
                          <Check className="mt-0.5 size-4 shrink-0" style={{ color: "var(--wp-accent)" }} />
                          <span style={{ color: "var(--wp-ink-2)" }}>{b}</span>
                        </li>
                      ))}
                    </ul>
                    <Link href={`/product/${f.slug}`} className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: "var(--wp-accent-ink)" }}>
                      Explore {f.kicker} <ArrowUpRight className="size-4" />
                    </Link>
                  </div>
                </Reveal>
                <Reveal variant={flip ? "left" : "right"} delay={80}>
                  <Visual kind={f.visual} />
                </Reveal>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Roles ---------------- */
export function RolesSection() {
  return (
    <section id="roles" className="mt-24 px-5 py-20 sm:py-28" style={{ background: "var(--wp-bg-2)" }}>
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <p className="wp-kicker">Built for every role</p>
          <h2 className="wp-display mt-4 text-[clamp(2rem,4.5vw,3.2rem)]" style={{ color: "var(--wp-ink)" }}>
            Everyone sees exactly what they should.
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed" style={{ color: "var(--wp-muted)" }}>
            Role-based access is built in — the dashboard, navigation, and data
            each person sees are shaped by their permissions. One platform, the
            whole organization.
          </p>
        </Reveal>
        <Reveal className="mt-12">
          <RoleSelector />
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Breadth (one platform) ---------------- */
export function BreadthSection() {
  return (
    <section id="platform" className="px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <p className="wp-kicker">One platform, every workflow</p>
          <h2 className="wp-display mt-4 text-[clamp(2rem,4.5vw,3.2rem)]" style={{ color: "var(--wp-ink)" }}>
            Replace the stack. Keep one source of truth.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MODULE_GROUPS.map((g, i) => {
            const Icon = g.icon;
            return (
              <Reveal key={g.title} delay={(i % 3) * 80}>
                <div className="wp-card h-full p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex size-11 items-center justify-center rounded-xl" style={{ background: "var(--wp-accent-soft)", color: "var(--wp-accent-ink)" }}>
                      <Icon className="size-5" />
                    </span>
                    <h3 className="wp-display text-lg" style={{ color: "var(--wp-ink)" }}>{g.title}</h3>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {g.items.map((it) => (
                      <li key={it} className="flex items-start gap-2 text-sm" style={{ color: "var(--wp-muted)" }}>
                        <Check className="mt-0.5 size-3.5 shrink-0" style={{ color: "var(--wp-accent)" }} />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------- How it works ---------------- */
export function HowSection() {
  return (
    <section className="px-5 py-20 sm:py-24" style={{ background: "var(--wp-bg-2)" }}>
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <p className="wp-kicker">How it works</p>
          <h2 className="wp-display mt-4 text-[clamp(2rem,4.5vw,3.2rem)]" style={{ color: "var(--wp-ink)" }}>
            Live in an afternoon.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 100}>
              <div className="border-t pt-6" style={{ borderColor: "var(--wp-border-strong)" }}>
                <span className="wp-display text-5xl" style={{ color: "var(--wp-accent-glow)" }}>{s.n}</span>
                <h3 className="wp-display mt-3 text-xl" style={{ color: "var(--wp-ink)" }}>{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--wp-muted)" }}>{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Security ---------------- */
export function SecuritySection() {
  return (
    <section id="security" className="px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <p className="wp-kicker">Enterprise &amp; security</p>
          <h2 className="wp-display mt-4 text-[clamp(2rem,4.5vw,3.2rem)]" style={{ color: "var(--wp-ink)" }}>
            Architected for IT, trusted by the business.
          </h2>
          <p className="mt-4 max-w-xl text-lg leading-relaxed" style={{ color: "var(--wp-muted)" }}>
            Governance is built into the platform, not bolted on. Here is what
            WorkPulse is designed around from the ground up.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ENTERPRISE.map((e, i) => {
            const Icon = e.icon;
            return (
              <Reveal key={e.title} delay={(i % 3) * 80}>
                <div className="wp-card h-full p-6">
                  <span className="flex size-11 items-center justify-center rounded-xl" style={{ background: "var(--wp-accent-soft)", color: "var(--wp-accent-ink)" }}>
                    <Icon className="size-5" />
                  </span>
                  <h3 className="wp-display mt-4 text-lg" style={{ color: "var(--wp-ink)" }}>{e.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--wp-muted)" }}>{e.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Principles ---------------- */
export function PrinciplesSection() {
  return (
    <section className="px-5 py-20 sm:py-28" style={{ background: "var(--wp-bg-2)" }}>
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <p className="wp-kicker">What we believe</p>
          <h2 className="wp-display mt-4 text-[clamp(2rem,4.5vw,3.2rem)]" style={{ color: "var(--wp-ink)" }}>
            A calmer way to run a productive team.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PRINCIPLES.map((p, i) => {
            const Icon = p.icon;
            return (
              <Reveal key={p.title} delay={i * 100}>
                <div className="wp-card flex h-full flex-col p-7">
                  <span className="flex size-11 items-center justify-center rounded-xl" style={{ background: "var(--wp-accent-soft)", color: "var(--wp-accent-ink)" }}>
                    <Icon className="size-5" />
                  </span>
                  <h3 className="wp-display mt-4 text-xl" style={{ color: "var(--wp-ink)" }}>{p.title}</h3>
                  <p className="mt-2 flex-1 text-[15px] leading-relaxed" style={{ color: "var(--wp-muted)" }}>{p.body}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Pricing ---------------- */
export function PricingSection() {
  return (
    <section id="pricing" className="px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="wp-kicker">Pricing</p>
          <h2 className="wp-display mt-4 text-[clamp(2rem,4.5vw,3.2rem)]" style={{ color: "var(--wp-ink)" }}>
            Simple per-seat pricing. Free in beta.
          </h2>
        </Reveal>
        <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-3">
          {PRICING.map((p, i) => (
            <Reveal key={p.name} delay={i * 90}>
              <div
                className="wp-card relative flex h-full flex-col p-7"
                style={p.featured ? { borderColor: "var(--wp-accent)", boxShadow: "0 24px 60px -32px color-mix(in srgb, var(--wp-accent) 55%, transparent)" } : undefined}
              >
                {p.featured ? (
                  <span className="absolute -top-3 left-7 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "var(--wp-accent)", color: "#fff" }}>Most popular</span>
                ) : null}
                <h3 className="wp-display text-xl" style={{ color: "var(--wp-ink)" }}>{p.name}</h3>
                <p className="mt-1 text-sm" style={{ color: "var(--wp-muted)" }}>{p.tagline}</p>
                <p className="mt-5 flex items-baseline gap-1">
                  <span className="wp-display text-5xl" style={{ color: "var(--wp-ink)" }}>{p.price}</span>
                  {p.price !== "Custom" ? <span className="text-sm" style={{ color: "var(--wp-muted)" }}>/ user / mo</span> : null}
                </p>
                <ul className="mt-6 flex-1 space-y-3">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--wp-ink-2)" }}>
                      <Check className="mt-0.5 size-4 shrink-0" style={{ color: "var(--wp-accent)" }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className={`wp-btn mt-7 w-full ${p.featured ? "wp-btn-primary" : "wp-btn-ghost"}`}>{p.cta}</Link>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <p className="mx-auto mt-8 max-w-lg text-center text-xs" style={{ color: "var(--wp-faint)" }}>{PRICING_NOTE}</p>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- FAQ ---------------- */
export function FaqSection() {
  return (
    <section id="faq" className="px-5 py-20 sm:py-28" style={{ background: "var(--wp-bg-2)" }}>
      <div className="mx-auto max-w-3xl">
        <Reveal className="text-center">
          <p className="wp-kicker">Questions</p>
          <h2 className="wp-display mt-4 text-[clamp(2rem,4.5vw,3.2rem)]" style={{ color: "var(--wp-ink)" }}>Frequently asked</h2>
        </Reveal>
        <div className="mt-10 divide-y" style={{ borderColor: "var(--wp-border-strong)" }}>
          {FAQS.map((f, i) => (
            <Reveal key={i} delay={i * 50}>
              <FaqItem q={f.q} a={f.a} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Final CTA ---------------- */
export function CtaSection() {
  return (
    <section className="px-5 py-24 sm:py-36">
      <Reveal variant="scale">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[32px] p-12 text-center sm:p-20" style={{ background: "var(--wp-ink)" }}>
          <span className="pointer-events-none absolute rounded-full" aria-hidden style={{ width: "40vw", height: "40vw", right: "-10%", top: "-30%", background: "radial-gradient(circle, color-mix(in srgb, var(--wp-accent) 55%, transparent), transparent 60%)" }} />
          <div className="relative">
            <h2 className="wp-display text-[clamp(2.4rem,6vw,4.2rem)]" style={{ color: "#fff" }}>
              Find your team&apos;s <span className="wp-serif-italic" style={{ color: "var(--wp-accent-glow)" }}>pulse.</span>
            </h2>
            <p className="mx-auto mt-4 max-w-md text-base" style={{ color: "rgb(255 255 255 / 0.72)" }}>
              Set up your organization in minutes. No card required while we&apos;re in beta.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/register" className="wp-btn wp-btn-primary">Start free <ArrowRight className="size-4" /></Link>
              <Link href="/login" className="wp-btn" style={{ background: "rgb(255 255 255 / 0.1)", color: "#fff", border: "1px solid rgb(255 255 255 / 0.28)" }}>Log in</Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/* ---------------- Footer (warm, landing-only) ---------------- */
export function Footer() {
  return (
    <footer className="border-t px-5 py-14" style={{ borderColor: "var(--wp-border)", background: "var(--wp-bg-2)" }}>
      <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-[10px]" style={{ background: "var(--wp-accent)" }}>
              <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
                <path d="M2 12h4l2-6 4 12 3-8 2 4h5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="wp-display text-xl" style={{ color: "var(--wp-ink)" }}>WorkPulse</span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed" style={{ color: "var(--wp-muted)" }}>
            The workforce platform that turns time, people, and projects
            into one calm pulse.
          </p>
          {/* "GDPR-ready" was here and is gone: it's an unverifiable compliance claim, and there is
              no DPA, no data-residency choice and no completed assessment behind it. Encryption in
              transit and at rest is a plain fact about the infrastructure, so that stays. */}
          <p className="mt-4 text-xs" style={{ color: "var(--wp-faint)" }}>Encrypted in transit &amp; at rest · Free while in beta</p>
        </div>
        {FOOTER_COLUMNS.map((col) => (
          <div key={col.title}>
            <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--wp-ink-2)" }}>{col.title}</p>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-sm transition-colors hover:opacity-70" style={{ color: "var(--wp-muted)" }}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-12 flex max-w-6xl flex-col items-center justify-between gap-3 border-t pt-6 sm:flex-row" style={{ borderColor: "var(--wp-border)" }}>
        <p className="text-xs" style={{ color: "var(--wp-faint)" }}>© 2026 WorkPulse. All rights reserved.</p>
        <div className="flex gap-5 text-xs" style={{ color: "var(--wp-faint)" }}>
          <Link href="/#faq" className="hover:opacity-70">Privacy</Link>
          <Link href="/#faq" className="hover:opacity-70">Terms</Link>
          <Link href="/#security" className="hover:opacity-70">Security</Link>
        </div>
      </div>
    </footer>
  );
}
