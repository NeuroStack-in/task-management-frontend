"use client";

/* ============================================================= *
 *  WorkPulse — Landing interactive islands (client)              *
 *  AuthGate · Reveal · Nav · Hero · CountUp · UseCaseMarquee ·   *
 *  RoleSelector · FaqItem                                        *
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
import { ArrowRight, ChevronDown, Menu, Minus, Play, X, Check } from "lucide-react";
import { HERO_LINES, HERO_LEAD, HERO_SUB, HERO_MICRO, ROLES, USE_CASES, FOOTER_COLUMNS } from "./content";
import { HeroVisual, HeroVisualAside, Visual } from "./visuals";

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

/* ---------------- Brand mark ---------------- */
function BrandMark({ tagline = false }: { tagline?: boolean }) {
  return (
    <Link href="/" aria-label="WorkPulse home" className="flex shrink-0 items-center gap-2.5">
      <span className="flex size-9 items-center justify-center rounded-xl" style={{ background: "var(--wp-accent)" }}>
        <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
          <path d="M2 12h4l2-6 4 12 3-8 2 4h5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="leading-none">
        <span className="wp-display block text-xl" style={{ color: "var(--wp-ink)" }}>WorkPulse</span>
        {tagline ? (
          <span className="mt-1 block text-[10px] font-semibold tracking-[0.18em] uppercase" style={{ color: "var(--wp-faint)" }}>
            Workforce Platform
          </span>
        ) : null}
      </span>
    </Link>
  );
}

/* ---------------- Nav dropdown ---------------- */
function NavDropdown({ label, items }: { label: string; items: { label: string; href: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-sm font-medium transition-colors hover:opacity-70"
        style={{ color: "var(--wp-ink-2)" }}
      >
        {label}
        <ChevronDown className="size-4 transition-transform duration-200" style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open ? (
        <div className="wp-nav-panel">
          {items.map((it) => (
            <Link key={it.label} href={it.href} className="wp-nav-item" onClick={() => setOpen(false)}>
              {it.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ---------------- Nav (solid bar, tagline logo, dropdowns, pill CTA) ---------------- */
const MOBILE_LINKS = [
  { label: "Product", href: "/#features" },
  { label: "Solutions", href: "/#roles" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/#faq" },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50" style={{ background: "var(--wp-surface)", borderBottom: "1px solid var(--wp-border)", boxShadow: "0 1px 2px rgb(56 40 24 / 0.04)" }}>
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <BrandMark tagline />
        <div className="hidden items-center gap-7 md:flex">
          <NavDropdown label="Product" items={FOOTER_COLUMNS[0].links} />
          <NavDropdown label="Solutions" items={FOOTER_COLUMNS[1].links} />
          <Link href="/pricing" className="text-sm font-medium hover:opacity-70" style={{ color: "var(--wp-ink-2)" }}>Pricing</Link>
          <Link href="/#faq" className="text-sm font-medium hover:opacity-70" style={{ color: "var(--wp-ink-2)" }}>FAQ</Link>
        </div>
        <div className="hidden items-center gap-4 md:flex">
          <Link href="/login" className="text-sm font-semibold hover:opacity-70" style={{ color: "var(--wp-ink)" }}>Log in</Link>
          <Link href="/register" className="wp-btn" style={{ background: "var(--wp-ink)", color: "#fff", padding: "0.6rem 1.2rem" }}>
            Start free <ArrowRight className="size-4" />
          </Link>
        </div>
        <button type="button" className="md:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)} style={{ color: "var(--wp-ink)" }}>
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </nav>

      {open ? (
        <div className="border-t px-5 pt-2 pb-5 md:hidden" style={{ borderColor: "var(--wp-border)" }}>
          <div className="flex flex-col">
            {MOBILE_LINKS.map((l) => (
              <Link key={l.label} href={l.href} onClick={() => setOpen(false)} className="py-3 text-base font-medium" style={{ color: "var(--wp-ink-2)" }}>
                {l.label}
              </Link>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Link href="/login" onClick={() => setOpen(false)} className="wp-btn wp-btn-ghost flex-1">Log in</Link>
            <Link href="/register" onClick={() => setOpen(false)} className="wp-btn wp-btn-primary flex-1">Start free</Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}

/* ---------------- Clock backdrop (dark hero) ---------------- */
const CARDINALS: [string, number, number][] = [
  ["12", 100, 27],
  ["3", 171, 103],
  ["6", 100, 179],
  ["9", 29, 103],
];

function ClockBg() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* teal center glow */}
      <span className="absolute top-[42%] left-1/2 size-[62vw] max-w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--wp-accent) 24%, transparent), transparent 60%)" }} />
      <svg className="absolute top-[42%] left-1/2 aspect-square w-[min(140vw,920px)] -translate-x-1/2 -translate-y-1/2" viewBox="0 0 200 200" fill="none">
        {/* dial rings */}
        <circle cx="100" cy="100" r="94" stroke="rgb(200 230 235 / 0.10)" strokeWidth="0.5" />
        <circle cx="100" cy="100" r="70" stroke="rgb(200 230 235 / 0.05)" strokeWidth="0.4" />
        {/* 60 minute ticks (every 5th is an hour tick) — rotated with integer
            degrees so there is no floating-point server/client mismatch */}
        {Array.from({ length: 60 }).map((_, i) => {
          const major = i % 5 === 0;
          return (
            <line
              key={i}
              x1="100"
              y1="8"
              x2="100"
              y2={major ? 18 : 13}
              transform={`rotate(${i * 6} 100 100)`}
              stroke={major ? "color-mix(in srgb, var(--wp-accent-glow) 70%, transparent)" : "rgb(200 230 235 / 0.14)"}
              strokeWidth={major ? 1 : 0.5}
              strokeLinecap="round"
            />
          );
        })}
        {/* cardinal numerals */}
        {CARDINALS.map(([t, x, y]) => (
          <text key={t} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="wp-mono" style={{ fontSize: "7px", fill: "rgb(200 230 235 / 0.3)" }}>
            {t}
          </text>
        ))}
        {/* hands — posed ~10:10 */}
        <g className="wp-clock-hand" style={{ transform: "rotate(305deg)" }}>
          <line x1="100" y1="105" x2="100" y2="58" stroke="rgb(200 230 235 / 0.55)" strokeWidth="2.6" strokeLinecap="round" />
        </g>
        <g className="wp-clock-hand" style={{ transform: "rotate(60deg)" }}>
          <line x1="100" y1="107" x2="100" y2="42" stroke="rgb(200 230 235 / 0.42)" strokeWidth="1.8" strokeLinecap="round" />
        </g>
        {/* sweeping second hand */}
        <g className="wp-clock-hand wp-clock-second">
          <line x1="100" y1="112" x2="100" y2="34" stroke="var(--wp-accent-glow)" strokeWidth="0.9" strokeLinecap="round" />
        </g>
        {/* hub */}
        <circle cx="100" cy="100" r="2.6" fill="var(--wp-accent-glow)" />
        <circle cx="100" cy="100" r="4.6" fill="none" stroke="color-mix(in srgb, var(--wp-accent-glow) 45%, transparent)" strokeWidth="0.6" />
      </svg>
    </div>
  );
}

/* ---------------- Hero (dark, centered — Infiniqon-style) ---------------- */
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

      {/* product peek — overlaps the hero/body boundary */}
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
