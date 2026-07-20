"use client";

/* ============================================================= *
 *  WorkPulse â€” Landing interactive islands (client)              *
 *  AuthGate Â· Reveal Â· Nav Â· Hero Â· CountUp Â· UseCaseMarquee Â·   *
 *  RoleSelector Â· FaqItem                                        *
 * ============================================================= */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { ArrowRight, ChevronDown, Minus, Play, Check } from "lucide-react";
import { HERO_LINES, HERO_LEAD, HERO_SUB, HERO_MICRO, ROLES, USE_CASES } from "./content";
import { HeroVisual, HeroVisualAside, Visual } from "./visuals";
import { ClockBackdrop } from "@/modules/marketing/clock-backdrop";

function reduced() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* Fire once when scrolled into view. */
function useInViewOnce<T extends HTMLElement>(cb: () => void, threshold = 0.25) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          cb();
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

/* ---------------- Auth gate ---------------- */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s.hydrated);
  useEffect(() => {
    if (hydrated && isAuthenticated) router.replace("/dashboard");
  }, [hydrated, isAuthenticated, router]);
  if (hydrated && isAuthenticated) return null;
  return <>{children}</>;
}

/* ---------------- Scroll reveal ---------------- */
export function Reveal({
  children,
  delay = 0,
  variant,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  variant?: "up" | "left" | "right" | "scale";
  className?: string;
}) {
  const [inView, setInView] = useState(false);
  const ref = useInViewOnce<HTMLDivElement>(() => setInView(true), 0.15);
  return (
    <div
      ref={ref}
      className={`wp-reveal ${inView ? "wp-in" : ""} ${className}`}
      data-variant={variant ?? "up"}
      style={{ ["--d" as string]: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* `BrandMark` lived here and went with the nav — the shared `MarketingNav` and `Footer` each render
   their own logo. */


/* ---------------- Nav ----------------
 * The landing used to carry its own `Nav` + `NavDropdown` here. It has been replaced by the
 * shared `MarketingNav` (see `app/page.tsx`), which is what every other marketing page already
 * used. Keeping a second, landing-only navbar is how the two drifted apart in the first place:
 * this one had a different product list and different CTA wording from the rest of the site.
 * If the landing ever needs nav behaviour the others do not, add a prop to `MarketingNav`
 * rather than forking it again. */

/* ---------------- Clock backdrop (dark hero) ----------------
   The dial itself now lives in `@/modules/marketing/clock-backdrop` so the auth screens can carry
   the same mark. This is the hero's crop of it: oversized and bleeding past the section edges. */
function ClockBg() {
  return <ClockBackdrop />;
}

/* ---------------- Hero (dark, centered â€” Infiniqon-style) ---------------- */
export function Hero() {
  const words = HERO_LINES.flat();
  const total = 140 + words.length * 75;
  let wi = 0;
  return (
    <>
      <section className="wp-hero-dark px-5 pt-20 pb-44 sm:pt-24 sm:pb-56">
        <ClockBg />
        <div className="wp-hero-scrim" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-3xl text-center">
          <p className="wp-kicker mb-6" style={{ color: "var(--wp-accent-glow)", opacity: 0, animation: "wp-rise 0.7s var(--wp-ease) 60ms forwards" }}>
            The workforce platform
          </p>
          <h1 className="wp-hero-title text-[clamp(2.6rem,7.5vw,5.2rem)]">
            {HERO_LINES.map((line, li) => (
              <span key={li} className="block">
                {line.map((tk, i) => {
                  const d = 140 + wi * 75;
                  wi += 1;
                  return (
                    <span
                      key={i}
                      className={`wp-word ${tk.em ? "wp-serif-italic" : ""}`}
                      style={{ ["--d" as string]: `${d}ms`, color: tk.em ? "#bfe9df" : "#fff", fontWeight: tk.em ? 600 : 700 }}
                    >
                      {tk.w}
                      {i < line.length - 1 ? " " : ""}
                    </span>
                  );
                })}
              </span>
            ))}
          </h1>
          <p className="mx-auto mt-7 max-w-xl text-lg font-semibold sm:text-xl" style={{ color: "#fff", opacity: 0, animation: `wp-rise 0.7s var(--wp-ease) ${total + 120}ms forwards` }}>
            {HERO_LEAD}
          </p>
          <p className="wp-hero-muted mx-auto mt-3 max-w-lg text-base leading-relaxed" style={{ opacity: 0, animation: `wp-rise 0.7s var(--wp-ease) ${total + 240}ms forwards` }}>
            {HERO_SUB}
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3" style={{ opacity: 0, animation: `wp-rise 0.7s var(--wp-ease) ${total + 360}ms forwards` }}>
            <Link href="/register" className="wp-btn wp-btn-primary">
              Start free <ArrowRight className="size-4" />
            </Link>
            <a href="#features" className="wp-btn" style={{ background: "rgb(255 255 255 / 0.08)", color: "#fff", border: "1px solid rgb(255 255 255 / 0.24)" }}>
              <Play className="size-4" /> See it in action
            </a>
          </div>
          <p className="mx-auto mt-4 text-sm" style={{ color: "rgb(224 236 238 / 0.5)", opacity: 0, animation: `wp-rise 0.7s var(--wp-ease) ${total + 480}ms forwards` }}>
            {HERO_MICRO}
          </p>
        </div>
      </section>

      {/* product peek â€” overlaps the hero/body boundary */}
      <div className="relative z-20 -mt-32 mb-4 px-5">
        <div className="mx-auto grid max-w-4xl items-start gap-5 md:grid-cols-2">
          <HeroVisual />
          <HeroVisualAside />
        </div>
      </div>
    </>
  );
}

/* ---------------- Count-up ---------------- */
export function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [n, setN] = useState(0);
  const ref = useInViewOnce<HTMLSpanElement>(() => {
    if (reduced()) {
      setN(to);
      return;
    }
    const duration = 1200;
    let start = 0;
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / duration);
      setN(Math.round((1 - Math.pow(1 - p, 3)) * to));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, 0.5);
  return (
    <span ref={ref} className="wp-count">
      {n}
      {suffix}
    </span>
  );
}

/* ---------------- Use-case marquee ---------------- */
export function UseCaseMarquee() {
  const row = [...USE_CASES, ...USE_CASES];
  return (
    <div className="wp-marquee-mask overflow-hidden">
      <div className="wp-marquee items-center gap-8 py-1">
        {row.map((u, i) => (
          <span key={i} className="flex shrink-0 items-center gap-8">
            <span className="wp-display text-xl whitespace-nowrap sm:text-2xl" style={{ color: "var(--wp-ink-2)", opacity: 0.75 }}>{u}</span>
            <span className="size-1.5 rounded-full" style={{ background: "var(--wp-accent)" }} />
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Role selector ---------------- */
export function RoleSelector() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const focusTab = useCallback((i: number) => {
    const next = (i + ROLES.length) % ROLES.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const map: Record<string, number | undefined> = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: ROLES.length - 1 };
    const target = map[e.key];
    if (target !== undefined) {
      e.preventDefault();
      focusTab(target);
    }
  };

  const role = ROLES[active];

  return (
    <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
      <div>
        <div role="tablist" aria-label="See WorkPulse by role" className="flex flex-wrap gap-2">
          {ROLES.map((r, i) => {
            const Icon = r.icon;
            const selected = i === active;
            return (
              <button
                key={r.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                role="tab"
                id={`role-tab-${r.id}`}
                aria-selected={selected}
                aria-controls={`role-panel-${r.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(i)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors"
                style={selected ? { background: "var(--wp-accent)", color: "#fff" } : { background: "var(--wp-surface)", color: "var(--wp-muted)", border: "1px solid var(--wp-border-strong)" }}
              >
                <Icon className="size-4" /> {r.label}
              </button>
            );
          })}
        </div>

        <div key={role.id} role="tabpanel" id={`role-panel-${role.id}`} aria-labelledby={`role-tab-${role.id}`} data-active="true" className="wp-panel mt-8">
          <h3 className="wp-display text-3xl sm:text-4xl" style={{ color: "var(--wp-ink)" }}>{role.headline}</h3>
          <p className="mt-4 max-w-md text-base leading-relaxed" style={{ color: "var(--wp-muted)" }}>{role.body}</p>
          <ul className="mt-5 space-y-2.5">
            {role.points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm">
                <Check className="mt-0.5 size-4 shrink-0" style={{ color: "var(--wp-accent)" }} />
                <span style={{ color: "var(--wp-ink-2)" }}>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div key={role.id} className="wp-panel" data-active="true">
        <Visual kind={role.visual} />
      </div>
    </div>
  );
}

/* ---------------- FAQ ---------------- */
export function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="py-1">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-4 py-5 text-left" aria-expanded={open}>
        <span className="wp-display text-lg" style={{ color: "var(--wp-ink)" }}>{q}</span>
        <span className="shrink-0" style={{ color: "var(--wp-accent)" }}>{open ? <Minus className="size-5" /> : <ChevronDown className="size-5" />}</span>
      </button>
      <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
        <div className="overflow-hidden">
          <p className="pb-5 text-[15px] leading-relaxed" style={{ color: "var(--wp-muted)" }}>{a}</p>
        </div>
      </div>
    </div>
  );
}
