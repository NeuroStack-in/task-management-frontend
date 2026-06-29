import Link from "next/link";
import { ArrowRight, ChevronRight, type LucideIcon } from "lucide-react";
import { MarketingNav } from "@/modules/marketing/marketing-nav";
import { MarketingFooter } from "@/modules/marketing/marketing-footer";
import { Reveal } from "@/modules/marketing/reveal";
import { LiveTimer } from "@/modules/marketing/product/live-timer";
import { ProductGallery } from "@/modules/marketing/product/product-gallery";
import { PRODUCTS, productHref } from "@/modules/marketing/products";

const HERO_ANIM: Record<string, React.ReactNode> = {
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
  gallery?: { src: string; title: string; body: string }[];
  /** Deeper "how it works" — ordered, technical. */
  how: { heading: string; steps: { title: string; body: string }[] };
  /** Scannable technical specs — standards, formats, limits. */
  specs: { label: string; value: string }[];
  related: string[];
  faqs: { q: string; a: string }[];
  cta: { title: string; body: string };
}

export function ProductPage({ data }: { data: ProductPageData }) {
  const split = Boolean(data.heroAnim);
  const related = data.related
    .map((s) => PRODUCTS.find((p) => p.slug === s))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <div className="m-root min-h-screen overflow-x-hidden">
      <MarketingNav />

      {/* Hero */}
      <section className="relative overflow-hidden px-5 pt-32 pb-16 sm:pt-40">
        <div className="m-aurora" aria-hidden="true">
          <span style={{ width: "44vw", height: "44vw", left: "4%", top: "0%", background: "var(--m-accent)", animation: "m-drift-a 28s ease-in-out infinite" }} />
          <span style={{ width: "38vw", height: "38vw", right: "2%", top: "-4%", background: "var(--m-accent-3)", animation: "m-drift-c 32s ease-in-out infinite" }} />
        </div>
        <div className={`relative z-10 mx-auto ${split ? "grid max-w-6xl items-center gap-10 lg:grid-cols-2" : "max-w-3xl text-center"}`}>
          <div className={split ? "text-center lg:text-left" : ""}>
            <nav className={`m-enter-up mb-6 flex items-center gap-1.5 text-xs ${split ? "justify-center lg:justify-start" : "justify-center"}`} style={{ color: "var(--m-muted)" }}>
              <Link href="/" className="hover:underline">Product</Link>
              <ChevronRight className="size-3" />
              <span style={{ color: "var(--m-accent-ink)" }}>{data.eyebrow}</span>
            </nav>
            <h1 className="m-display m-enter-up text-[clamp(2.2rem,5.5vw,3.6rem)] leading-[1.04] font-semibold" style={{ animationDelay: "120ms" }}>
              {data.title}
            </h1>
            <p className={`m-enter-up mt-5 max-w-2xl text-base leading-relaxed sm:text-lg ${split ? "lg:mx-0" : "mx-auto"} mx-auto`} style={{ color: "var(--m-muted)", animationDelay: "200ms" }}>
              {data.lede}
            </p>
            <div className={`m-enter-up mt-8 flex flex-wrap items-center gap-3 ${split ? "justify-center lg:justify-start" : "justify-center"}`} style={{ animationDelay: "280ms" }}>
              <Link href="/register" className="m-btn m-btn-primary">
                Start free trial <ArrowRight className="size-4" />
              </Link>
              <Link href="/pricing" className="m-btn m-btn-ghost">
                View pricing
              </Link>
            </div>
          </div>
          {split ? <div>{HERO_ANIM[data.heroAnim!]}</div> : null}
        </div>
      </section>

      {/* Problem statement */}
      <section className="px-5 pb-4">
        <Reveal className="mx-auto max-w-4xl">
          <div className="m-card p-8 sm:p-10" style={{ background: "var(--m-surface)" }}>
            <p className="text-sm font-medium tracking-wide uppercase" style={{ color: "var(--m-accent-ink)" }}>
              The problem
            </p>
            <h2 className="m-display mt-3 text-2xl font-semibold sm:text-3xl">{data.problem.heading}</h2>
            <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--m-muted)" }}>
              {data.problem.body}
            </p>
          </div>
        </Reveal>
      </section>

      {/* Capabilities */}
      <section className="px-5 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-sm font-medium tracking-wide uppercase" style={{ color: "var(--m-accent-ink)" }}>
              Capabilities
            </p>
            <h2 className="m-display mt-3 max-w-2xl text-3xl font-semibold sm:text-4xl">
              Engineered for {data.eyebrow.toLowerCase()} at scale.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data.capabilities.map((c, i) => {
              const Icon = c.icon;
              return (
                <Reveal key={c.title} delay={i * 60}>
                  <div className="m-card h-full p-6">
                    <span className="inline-flex size-11 items-center justify-center rounded-xl" style={{ background: "color-mix(in srgb, var(--m-accent) 16%, transparent)", color: "var(--m-accent)" }}>
                      <Icon className="size-5" />
                    </span>
                    <h3 className="m-display mt-4 text-base font-semibold">{c.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--m-muted)" }}>
                      {c.body}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* See it in action — product screenshots (dark band, glass frames) */}
      {data.gallery ? (
        <section
          className="relative overflow-hidden px-5 py-20 sm:py-28"
          style={{ background: "linear-gradient(180deg, #0b302d 0%, #0a2422 100%)", color: "#fff" }}
        >
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <span className="absolute rounded-full" style={{ width: "52vw", height: "52vw", left: "-12%", top: "-24%", background: "radial-gradient(circle, rgba(95,168,159,0.28), transparent 60%)" }} />
            <span className="absolute rounded-full" style={{ width: "44vw", height: "44vw", right: "-12%", bottom: "-20%", background: "radial-gradient(circle, rgba(244,176,150,0.16), transparent 60%)" }} />
          </div>
          <div className="relative mx-auto max-w-6xl">
            <Reveal>
              <p className="text-sm font-medium tracking-wide uppercase" style={{ color: "#7fd1c5" }}>
                See it in action
              </p>
              <h2 className="m-display mt-3 max-w-2xl text-3xl font-semibold text-white sm:text-4xl">
                Captured, reviewed, and approved in one place.
              </h2>
            </Reveal>
            <ProductGallery items={data.gallery} />
          </div>
        </section>
      ) : null}

      {/* How it works */}
      <section className="px-5 py-20 sm:py-24" style={{ background: "var(--m-surface)" }}>
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <p className="text-sm font-medium tracking-wide uppercase" style={{ color: "var(--m-accent-ink)" }}>
              How it works
            </p>
            <h2 className="m-display mt-3 max-w-2xl text-3xl font-semibold sm:text-4xl">{data.how.heading}</h2>
          </Reveal>
          <div className="mt-12 space-y-5">
            {data.how.steps.map((s, i) => (
              <Reveal key={s.title} delay={i * 70}>
                <div className="m-card flex gap-5 p-6">
                  <span
                    className="m-mono flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                    style={{ background: "color-mix(in srgb, var(--m-accent) 14%, transparent)", color: "var(--m-accent-ink)" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="m-display text-lg font-semibold">{s.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--m-muted)" }}>
                      {s.body}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Technical specs */}
      <section className="px-5 py-20 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-sm font-medium tracking-wide uppercase" style={{ color: "var(--m-accent-ink)" }}>
              Technical specifications
            </p>
            <h2 className="m-display mt-3 text-3xl font-semibold sm:text-4xl">The details that matter to IT.</h2>
          </Reveal>
          <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border sm:grid-cols-2 lg:grid-cols-3" style={{ borderColor: "var(--m-border)", background: "var(--m-border)" }}>
            {data.specs.map((s) => (
              <div key={s.label} className="p-5" style={{ background: "var(--m-bg)" }}>
                <p className="text-xs font-medium tracking-wide uppercase" style={{ color: "var(--m-muted)" }}>
                  {s.label}
                </p>
                <p className="m-display mt-1.5 text-base font-semibold">{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Related products */}
      {related.length ? (
        <section className="px-5 pb-8">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <h2 className="m-display text-xl font-semibold">Explore related modules</h2>
            </Reveal>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {related.map((p, i) => {
                const Icon = p.icon;
                return (
                  <Reveal key={p.slug} delay={i * 60}>
                    <Link href={productHref(p.slug)} className="m-card flex items-center gap-3 p-5 transition-transform duration-300 hover:-translate-y-0.5">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl" style={{ background: "color-mix(in srgb, var(--m-accent) 14%, transparent)", color: "var(--m-accent)" }}>
                        <Icon className="size-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{p.name}</span>
                        <span className="block truncate text-xs" style={{ color: "var(--m-muted)" }}>{p.tagline}</span>
                      </span>
                      <ArrowRight className="ml-auto size-4 shrink-0" style={{ color: "var(--m-accent)" }} />
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* CTA band */}
      <section className="px-5 py-24 sm:py-28">
        <Reveal>
          <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[28px] border p-10 text-center sm:p-16" style={{ borderColor: "var(--m-border)", background: "var(--m-surface)" }}>
            <div className="m-aurora" aria-hidden="true" style={{ opacity: 0.4 }}>
              <span style={{ width: "40%", height: "120%", left: "8%", top: "-20%", background: "var(--m-accent)", animation: "m-drift-a 24s ease-in-out infinite" }} />
              <span style={{ width: "40%", height: "120%", right: "6%", top: "-10%", background: "var(--m-accent-3)", animation: "m-drift-b 28s ease-in-out infinite" }} />
            </div>
            <div className="relative">
              <h2 className="m-display text-3xl font-semibold sm:text-4xl">{data.cta.title}</h2>
              <p className="mx-auto mt-4 max-w-md text-base" style={{ color: "var(--m-muted)" }}>{data.cta.body}</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/register" className="m-btn m-btn-primary">
                  Start free trial <ArrowRight className="size-4" />
                </Link>
                <Link href="/login" className="m-btn m-btn-ghost">
                  Talk to sales
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <MarketingFooter />
    </div>
  );
}
