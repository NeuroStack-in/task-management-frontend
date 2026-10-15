/**
 * The ten `/product/*` pages, on the landing's surface (owner request 2026-10-15): the dark clock
 * hero, a "problem" card riding up over its edge, then the cream page — chapter-numbered
 * capabilities, the screenshots in a dark band, a dial-marked "how it works" timeline, the specs,
 * and the dark closing panel. It was a separate dark-petrol design with its own nav and footer.
 *
 * The copy is unchanged and still comes from `content.ts`; only the presentation moved. Two button
 * labels changed: "Start free trial" is now "Start free" — there is no trial, every plan is free
 * during the beta.
 */
import Link from "next/link";
import { ArrowRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { PublicShell } from "@/modules/marketing/public/public-shell";
import { PageHero } from "@/modules/marketing/public/page-hero";
import { ClockCta, SectionHead } from "@/modules/marketing/public/clock-cta";
import { Reveal } from "@/modules/marketing/landing/client";
import { LiveTimer } from "@/modules/marketing/product/live-timer";
import { ProductGallery } from "@/modules/marketing/product/product-gallery";
import { PRODUCTS, productHref } from "@/modules/marketing/products";

const HERO_ANIM: Record<string, ReactNode> = {
  timer: <LiveTimer />,
};

export interface Capability {
  icon: LucideIcon;
  title: string;
  body: string;
}

export interface ProductPageData {
  slug: string;
  eyebrow: string;
  icon: LucideIcon;
  title: string;
  lede: string;
  /** Optional live hero animation key (renders text-left / visual-right). */
  heroAnim?: keyof typeof HERO_ANIM;
  /** The operational problem, in business terms. */
  problem: { heading: string; body: string };
  capabilities: Capability[];
  /** Optional product screenshots showcased in a "See it in action" section. */
  /** `width`/`height` are the image's pixel size — set, so its box is reserved before it loads. */
  gallery?: { src: string; width: number; height: number; title: string; body: string }[];
  /** Deeper "how it works" — ordered, technical. */
  how: { heading: string; steps: { title: string; body: string }[] };
  /** Scannable technical specs — standards, formats, limits. */
  specs: { label: string; value: string }[];
  related: string[];
  faqs: { q: string; a: string }[];
  cta: { title: string; body: string };
}

/**
 * The italic teal accent for a page title: the clause after a dash, else the second sentence, else
 * the last two words. ("Security built in — *not bolted on.*")
 */
function emphasise(title: string): ReactNode {
  const dash = title.lastIndexOf(" — ");
  if (dash > 0) {
    return (
      <>
        {title.slice(0, dash)} — <em>{title.slice(dash + 3)}</em>
      </>
    );
  }
  const stop = title.indexOf(". ");
  if (stop > 0) {
    return (
      <>
        {title.slice(0, stop + 1)} <em>{title.slice(stop + 2)}</em>
      </>
    );
  }
  return lastWords(title, 2);
}

function lastWords(text: string, n: number): ReactNode {
  const words = text.split(" ");
  if (words.length <= n) return text;
  return (
    <>
      {words.slice(0, -n).join(" ")} <em>{words.slice(-n).join(" ")}</em>
    </>
  );
}

/** "AI Insights" → "AI insights", "Integrations & API" → "integrations & API": acronyms keep their case. */
function inSentence(name: string): string {
  return name
    .split(" ")
    .map((w) => (w.length > 1 && w === w.toUpperCase() ? w : w.toLowerCase()))
    .join(" ");
}

/** Step n of total as a small dial: twelve ticks, the arc swept to n/total, the number at the hub. */
function StepDial({ n, total }: { n: number; total: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex size-16 shrink-0 items-center justify-center rounded-full" style={{ background: "var(--wp-surface)", boxShadow: "var(--wp-shadow-sm)" }}>
      <svg viewBox="0 0 64 64" className="absolute inset-0 size-full" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <line
            key={i}
            x1="32"
            y1="3.5"
            x2="32"
            y2={i % 3 === 0 ? 7.5 : 6}
            transform={`rotate(${i * 30} 32 32)`}
            stroke={i % 3 === 0 ? "var(--wp-accent-glow)" : "var(--wp-border-strong)"}
            strokeWidth={i % 3 === 0 ? 1.4 : 1}
            strokeLinecap="round"
          />
        ))}
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--wp-accent-soft)" strokeWidth="3" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="var(--wp-accent)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${((n / total) * c).toFixed(2)} ${c.toFixed(2)}`}
          transform="rotate(-90 32 32)"
        />
      </svg>
      <span className="wp-mono relative text-sm font-semibold" style={{ color: "var(--wp-accent-ink)" }}>
        {String(n).padStart(2, "0")}
      </span>
    </span>
  );
}

const STEP_COLS: Record<number, string> = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4" };

export function ProductPage({ data }: { data: ProductPageData }) {
  const Icon = data.icon;
  const related = data.related
    .map((s) => PRODUCTS.find((p) => p.slug === s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const steps = data.how.steps;

  return (
    <PublicShell>
      <PageHero
        // The landing page's product section — there is no /product index (WP-541).
        crumbs={[{ label: "Product", href: "/#features" }, { label: data.eyebrow }]}
        badge={
          <span
            className="flex size-14 items-center justify-center rounded-2xl"
            style={{ background: "rgb(255 255 255 / 0.07)", border: "1px solid rgb(255 255 255 / 0.18)", color: "var(--wp-accent-glow)" }}
          >
            <Icon className="size-6" aria-hidden="true" />
          </span>
        }
        title={emphasise(data.title)}
        lede={data.lede}
        actions={
          <>
            <Link href="/register" className="wp-btn wp-btn-primary">
              Start free <ArrowRight className="size-4" />
            </Link>
            <Link href="/pricing" className="wp-btn wp-btn-glass">
              View pricing
            </Link>
          </>
        }
        micro="Free during beta · No credit card required"
        aside={data.heroAnim ? HERO_ANIM[data.heroAnim] : undefined}
        overlap="md"
      />

      {/* The problem — rides up over the hero's edge. */}
      <section className="relative z-10 -mt-20 px-5 sm:-mt-24">
        <Reveal className="mx-auto max-w-5xl">
          <div className="wp-card grid gap-5 p-8 sm:p-12 lg:grid-cols-[1fr_1.1fr] lg:items-end lg:gap-14" style={{ boxShadow: "var(--wp-shadow)" }}>
            <div>
              <p className="wp-kicker">The problem</p>
              <h2 className="wp-display mt-4 text-[clamp(1.7rem,3.4vw,2.5rem)]" style={{ color: "var(--wp-ink)" }}>
                {data.problem.heading}
              </h2>
            </div>
            <p className="text-base leading-relaxed sm:text-lg" style={{ color: "var(--wp-muted)" }}>
              {data.problem.body}
            </p>
          </div>
        </Reveal>
      </section>

      {/* Capabilities — chapter-numbered, the way the landing numbers its features. */}
      <section className="px-5 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            align="start"
            kicker="Capabilities"
            title={
              <>
                Engineered for {inSentence(data.eyebrow)} <em>at scale.</em>
              </>
            }
          />
          {/* Hairline grid: the gaps show the border colour through. Revealed as one piece — per-cell
              fades would flash the gap colour while a cell is still transparent. */}
          <Reveal>
            <div
              className="mt-14 grid gap-px overflow-hidden rounded-[24px] border sm:grid-cols-2 lg:grid-cols-3"
              style={{ background: "var(--wp-border)", borderColor: "var(--wp-border)" }}
            >
              {data.capabilities.map((c, i) => {
                const CapIcon = c.icon;
                return (
                  <div key={c.title} className="p-7 sm:p-8" style={{ background: "var(--wp-surface)" }}>
                    <div className="flex items-start justify-between">
                      <span className="wp-display text-4xl leading-none" style={{ color: "var(--wp-accent-glow)" }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        className="flex size-10 items-center justify-center rounded-xl"
                        style={{ background: "var(--wp-accent-soft)", color: "var(--wp-accent-ink)" }}
                      >
                        <CapIcon className="size-[18px]" aria-hidden="true" />
                      </span>
                    </div>
                    <h3 className="wp-display mt-6 text-xl" style={{ color: "var(--wp-ink)" }}>
                      {c.title}
                    </h3>
                    <p className="mt-2.5 text-[15px] leading-relaxed" style={{ color: "var(--wp-muted)" }}>
                      {c.body}
                    </p>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </div>
      </section>

      {/* See it in action — the screenshots, on the hero's dark surface. */}
      {data.gallery ? (
        <section className="wp-hero-dark px-5 py-24 sm:py-32">
          <span
            className="pointer-events-none absolute rounded-full"
            aria-hidden="true"
            style={{ width: "56vw", height: "56vw", left: "-14%", top: "-22%", background: "radial-gradient(circle, color-mix(in srgb, var(--wp-accent) 26%, transparent), transparent 62%)" }}
          />
          <div className="relative mx-auto max-w-6xl">
            <Reveal>
              <p className="wp-kicker" style={{ color: "var(--wp-accent-glow)" }}>
                See it in action
              </p>
              <h2 className="wp-page-title mt-4 max-w-2xl text-[clamp(2rem,4.5vw,3.1rem)]">
                Captured, reviewed, and approved <em>in one place.</em>
              </h2>
            </Reveal>
            <ProductGallery items={data.gallery} />
          </div>
        </section>
      ) : null}

      {/* How it works — a minute ruler for a timeline, one dial per step. */}
      <section className="px-5 py-24 sm:py-32" style={{ background: "var(--wp-bg-2)" }}>
        <div className="mx-auto max-w-6xl">
          <SectionHead kicker="How it works" title={lastWords(data.how.heading, 1)} />
          <ol className={`relative mt-16 grid gap-12 ${STEP_COLS[steps.length] ?? "lg:grid-cols-3"} lg:gap-10`}>
            <span className="wp-ticks absolute inset-x-[12%] top-[18px] hidden lg:block" aria-hidden="true" />
            {steps.map((s, i) => (
              <li key={s.title}>
                <Reveal delay={i * 110} className="flex gap-5 lg:flex-col lg:items-center lg:text-center">
                  <StepDial n={i + 1} total={steps.length} />
                  <div>
                    <h3 className="wp-display text-2xl lg:mt-6" style={{ color: "var(--wp-ink)" }}>
                      {s.title}
                    </h3>
                    <p className="mt-2.5 text-[15px] leading-relaxed lg:mx-auto lg:max-w-xs" style={{ color: "var(--wp-muted)" }}>
                      {s.body}
                    </p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Technical specs */}
      <section className="px-5 pt-24 sm:pt-32">
        <div className="mx-auto max-w-6xl">
          <SectionHead
            align="start"
            kicker="Technical specifications"
            title={
              <>
                The details that matter <em>to IT.</em>
              </>
            }
          />
          <Reveal>
            <dl
              className="mt-12 grid gap-px overflow-hidden rounded-[24px] border sm:grid-cols-2 lg:grid-cols-3"
              style={{ background: "var(--wp-border)", borderColor: "var(--wp-border)" }}
            >
              {data.specs.map((s) => (
                <div key={s.label} className="p-6 sm:p-7" style={{ background: "var(--wp-surface)" }}>
                  <dt className="text-[0.7rem] font-semibold tracking-[0.14em] uppercase" style={{ color: "var(--wp-faint)" }}>
                    {s.label}
                  </dt>
                  <dd className="wp-display mt-2 text-xl" style={{ color: "var(--wp-ink)" }}>
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </section>

      {/* Related products */}
      {related.length ? (
        <section className="px-5 pt-24 sm:pt-28">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <p className="wp-kicker">Keep exploring</p>
            </Reveal>
            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              {related.map((p, i) => {
                const RelIcon = p.icon;
                return (
                  <Reveal key={p.slug} delay={i * 70} className="h-full">
                    <Link href={productHref(p.slug)} className="wp-card wp-lift group flex h-full flex-col p-6">
                      <span className="flex items-center justify-between">
                        <span
                          className="flex size-11 items-center justify-center rounded-xl"
                          style={{ background: "var(--wp-accent-soft)", color: "var(--wp-accent-ink)" }}
                        >
                          <RelIcon className="size-5" aria-hidden="true" />
                        </span>
                        <ArrowUpRight
                          className="size-5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                          style={{ color: "var(--wp-accent)" }}
                          aria-hidden="true"
                        />
                      </span>
                      <span className="wp-display mt-5 block text-xl" style={{ color: "var(--wp-ink)" }}>
                        {p.name}
                      </span>
                      <span className="mt-1 block text-sm" style={{ color: "var(--wp-muted)" }}>
                        {p.tagline}
                      </span>
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* Was "Talk to sales" → the sign-in form: there is no sales contact to reach. Pricing is a
          real next step (WP-541). */}
      <ClockCta
        title={lastWords(data.cta.title, 1)}
        body={data.cta.body}
        primary={{ label: "Start free", href: "/register" }}
        secondary={{ label: "See pricing", href: "/pricing" }}
      />
    </PublicShell>
  );
}
