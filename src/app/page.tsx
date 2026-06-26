"use client";

/* ============================================================= *
 *  WorkPulse — Landing page (full marketing site)                *
 *  Nav · Hero+preview · Logos · Stats · Features · How it works  *
 *  Use cases · Testimonials · Pricing · FAQ · CTA · Footer       *
 * ============================================================= */

import "./marketing.css";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarCheck,
  Check,
  CheckCheck,
  ChevronDown,
  Bot,
  Camera,
  CheckCircle2,
  Clock,
  FolderKanban,
  HeartPulse,
  Menu,
  Minus,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import { Logo } from "@/modules/marketing/logo";
import { Reveal } from "@/modules/marketing/reveal";

const NAV_LINKS = [
  { label: "Product", href: "#features" },
  { label: "Solutions", href: "#solutions" },
  { label: "Pricing", href: "#pricing" },
  { label: "Resources", href: "#faq" },
];

const HEADLINE = [
  ["Your", "workforce,"],
  ["in", "perfect", "rhythm."],
];

const STATS = [
  { value: "12M+", label: "hours tracked" },
  { value: "4.8/5", label: "average rating" },
  { value: "60+", label: "countries" },
  { value: "99.9%", label: "uptime" },
];

const FEATURES = [
  {
    eyebrow: "Time tracking",
    icon: Clock,
    title: "Track time without the friction",
    body: "A one-tap timer on web, desktop, and mobile turns into clean, automatic timesheets — ready for approval, payroll, and billing.",
    bullets: ["One-tap & idle-aware timer", "Automatic timesheets", "Approvals & corrections"],
    mock: "timer" as const,
  },
  {
    eyebrow: "Activity & productivity",
    icon: Activity,
    title: "See where focus actually goes",
    body: "Active vs. idle time, app & site usage, and a productivity score per person and team — context, not surveillance theatre.",
    bullets: ["Active vs. idle analysis", "App & website usage", "Productivity score"],
    mock: "heatmap" as const,
  },
  {
    eyebrow: "Projects & attendance",
    icon: FolderKanban,
    title: "Plan, assign, and stay on track",
    body: "Kanban boards, attendance, schedules, and leave live next to the time data — so delivery and capacity are always in view.",
    bullets: ["Kanban projects & tasks", "Attendance & schedules", "Leave & approvals"],
    mock: "kanban" as const,
  },
  {
    eyebrow: "Reports & insights",
    icon: BarChart3,
    title: "Decisions backed by data",
    body: "Live dashboards, scheduled exports, and AI anomaly detection surface burnout, overtime, and drift before they become problems.",
    bullets: ["Live dashboards & exports", "Burnout & anomaly alerts", "Role-based insights"],
    mock: "chart" as const,
  },
];

const STEPS = [
  { n: "01", title: "Invite your team", body: "Bring people in by email or SSO and group them into teams and projects in minutes." },
  { n: "02", title: "Track time & activity", body: "The timer and lightweight agent capture hours, attendance, and activity automatically." },
  { n: "03", title: "Act on insights", body: "Read one clear pulse, approve timesheets, and catch burnout or overruns early." },
];

const USE_CASES = [
  { icon: CalendarCheck, title: "Field service", body: "GPS-aware clock-in, job costing, and crews that track time from anywhere." },
  { icon: HeartPulse, title: "Remote & hybrid teams", body: "Async-friendly visibility into focus and capacity without micromanaging." },
  { icon: FolderKanban, title: "Agencies & consultancies", body: "Billable hours, project budgets, and client-ready reports out of the box." },
  { icon: ShieldCheck, title: "BPO & support", body: "Shift attendance, adherence, and productivity at scale, with audit trails." },
];

const TESTIMONIALS = [
  { quote: "We replaced three tools with WorkPulse. Timesheets that used to take a day now take ten minutes.", name: "Priya Menon", role: "Head of Operations, Northwind" },
  { quote: "The burnout signals are the real differentiator. We caught two overloaded teams before they cracked.", name: "Daniel Pierce", role: "VP People, Lumen" },
  { quote: "Our field crews actually use it. Clock-in is one tap and the reports just make sense.", name: "Sofia Alvarez", role: "Founder, Cascade Build" },
];

const PRICING = [
  {
    name: "Pro",
    price: "$12",
    tagline: "For growing teams that need real insight.",
    features: ["Time tracking & timesheets", "Activity & productivity", "Unlimited projects & tasks", "Reports & exports", "Priority support"],
    cta: "Start free trial",
    featured: false,
  },
  {
    name: "Max",
    price: "$22",
    tagline: "For organizations operating at scale.",
    features: ["Everything in Pro", "SSO / SAML & SCIM", "Anomaly & burnout AI", "Audit logs, DPA & residency", "Dedicated success manager"],
    cta: "Start free trial",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    tagline: "Procurement, security review & volume.",
    features: ["Everything in Max", "Custom contracts & invoicing", "SAML & SCIM at scale", "Tailored onboarding", "Premier SLA & support"],
    cta: "Talk to sales",
    featured: false,
  },
];

const FAQS = [
  { q: "Is WorkPulse employee monitoring or surveillance?", a: "No. WorkPulse focuses on transparent, aggregate signals — hours, attendance, and productivity context — with controls and consent. It's built to support teams, not spy on them." },
  { q: "Does it work on mobile, desktop, and for field teams?", a: "Yes. There's a one-tap timer on web, desktop, and mobile, plus GPS-aware clock-in for crews on the move." },
  { q: "How does billing work?", a: "Plans are per active user, billed monthly or annually. You can start free during our beta — no card required — and upgrade any time." },
  { q: "Is my organization's data secure?", a: "Data is encrypted in transit and at rest. Enterprise plans add SSO/SAML, SCIM, audit logs, and a signed DPA." },
  { q: "Can I import from my current tool?", a: "Yes — import people, projects, and historical time from common tools, or use the API to bring everything across." },
import { Button } from "@/components/ui/button";
import { Sparkline } from "@/components/shared/sparkline";

const FEATURES = [
  { icon: Clock, title: "Time Tracking", desc: "Global timer, timesheets, and auto-submission — no manual busywork." },
  { icon: Activity, title: "Activity Monitoring", desc: "Active vs. inactive analysis, heatmaps, and app & URL insight." },
  { icon: Camera, title: "Screenshots", desc: "Consent-aware capture with a timeline gallery and productivity scoring." },
  { icon: BarChart3, title: "Productivity Analytics", desc: "Trends, comparisons, and exportable reports across the workforce." },
  { icon: Bot, title: "AI Insights", desc: "Daily summaries, recommendations, and automatic anomaly detection." },
  { icon: ShieldCheck, title: "Security & RBAC", desc: "Granular roles, MFA, SSO, and a complete audit trail." },
];

const STATS = [
  { value: "29", label: "Product modules" },
  { value: "5", label: "MVP-first phases" },
  { value: "3 min", label: "To a working demo" },
  { value: "100%", label: "Clickable workflows" },
];

const HERO_PULSE = [40, 58, 50, 67, 62, 78, 71, 86, 80, 92, 84, 96];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrolled(y > 60);
        const el = heroRef.current;
        if (el) {
          const p = Math.min(1, y / 600);
          el.style.transform = `scale(${1 - p * 0.08}) translateY(${p * 30}px)`;
          el.style.opacity = `${Math.max(0, 1 - p * 1.05)}`;
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const wordCount = HEADLINE.flat().length;

  return (
    <div className="m-root min-h-screen overflow-x-hidden">
      {/* ---------------- Navigation ---------------- */}
      <header
        className="fixed inset-x-0 top-0 z-50 transition-[background,backdrop-filter] duration-300"
        style={{
          background: scrolled
            ? "color-mix(in srgb, var(--m-bg) 78%, transparent)"
            : "transparent",
          backdropFilter: scrolled ? "blur(14px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(14px)" : "none",
          borderBottom: scrolled
            ? "1px solid var(--m-border)"
            : "1px solid transparent",
        }}
      >
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
          <Link href="/" aria-label="WorkPulse home" className="shrink-0">
            <Logo />
          </Link>
          <ul className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((l) => (
              <li key={l.label}>
                <a
                  href={l.href}
                  className="group relative text-sm"
                  style={{ color: "var(--m-muted)" }}
                >
                  {l.label}
                  <span className="absolute -bottom-1.5 left-0 h-px w-0 bg-current transition-all duration-300 group-hover:w-full" />
                </a>
              </li>
            ))}
          </ul>
          <div className="hidden shrink-0 items-center gap-2 md:flex">
            <Link href="/login" className="m-btn m-btn-ghost text-sm">
              Log in
            </Link>
            <Link href="/register" className="m-btn m-btn-primary text-sm">
              Get started
            </Link>
          </div>
          {/* Plain button (not .m-btn) so md:hidden isn't overridden by .m-btn display */}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Toggle menu"
            className="flex size-10 shrink-0 items-center justify-center rounded-full border md:hidden"
            style={{ borderColor: "var(--m-border-strong)", color: "var(--m-text)" }}
          >
            {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </nav>
        {menuOpen ? (
          <div
            className="border-t md:hidden"
            style={{
              borderColor: "var(--m-border)",
              background: "color-mix(in srgb, var(--m-bg) 92%, transparent)",
              backdropFilter: "blur(14px)",
            }}
          >
            <ul className="space-y-1 px-5 py-4">
              {[...NAV_LINKS, { label: "Log in", href: "/login" }].map((l, i) => (
                <li
                  key={l.label}
                  className="m-enter-up"
                  style={{ animationDelay: `${i * 60}ms` }}
                >
                  <a
                    href={l.href}
                    onClick={() => setMenuOpen(false)}
                    className="block rounded-lg px-3 py-2.5 text-sm"
                    style={{ color: "var(--m-text)" }}
                  >
                    {l.label}
                  </a>
                </li>
              ))}
              <li className="m-enter-up pt-1" style={{ animationDelay: "300ms" }}>
                <Link
                  href="/register"
                  onClick={() => setMenuOpen(false)}
                  className="m-btn m-btn-primary w-full"
                >
                  Get started
                </Link>
              </li>
            </ul>
          </div>
        ) : null}
      </header>

      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden px-5 pt-32 pb-10 sm:pt-40">
        <div className="m-aurora" aria-hidden="true">
          <span style={{ width: "46vw", height: "46vw", left: "6%", top: "2%", background: "var(--m-accent)", animation: "m-drift-a 26s ease-in-out infinite" }} />
          <span style={{ width: "40vw", height: "40vw", right: "2%", top: "-4%", background: "var(--m-accent-2)", animation: "m-drift-b 32s ease-in-out infinite" }} />
          <span style={{ width: "36vw", height: "36vw", left: "34%", top: "20%", background: "var(--m-accent-3)", animation: "m-drift-c 30s ease-in-out infinite" }} />
        </div>

        <div ref={heroRef} className="relative z-10 mx-auto max-w-3xl text-center" style={{ willChange: "transform, opacity" }}>
          <div className="m-enter-up mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs" style={{ borderColor: "var(--m-border-strong)", color: "var(--m-muted)" }}>
            <span className="size-1.5 rounded-full" style={{ background: "var(--m-success)" }} />
            Workforce activity &amp; productivity · now in beta
          </div>
          <h1 className="m-display text-[clamp(2.6rem,8vw,5.2rem)] leading-[0.98] font-semibold">
            {HEADLINE.map((line, li) => {
              const before = HEADLINE.slice(0, li).reduce((n, l) => n + l.length, 0);
              return (
                <span key={li} className="block">
                  {line.map((w, i) => (
                    <span key={i} className="m-word" style={{ animationDelay: `${(before + i) * 80 + 100}ms` }}>
                      {w}
                      {i < line.length - 1 ? " " : ""}
                    </span>
                  ))}
                </span>
              );
            })}
          </h1>
          <p className="m-enter-up mx-auto mt-7 max-w-xl text-base leading-relaxed sm:text-lg" style={{ color: "var(--m-muted)", animationDelay: `${wordCount * 80 + 220}ms` }}>
            Time tracking, attendance, activity, and projects in one platform —
            turned into a single clear signal so you can run a healthier, more
            productive team.
          </p>
          <div className="m-enter-up mt-9 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: `${wordCount * 80 + 360}ms` }}>
            <Link href="/register" className="m-btn m-btn-primary">
              Get started free <ArrowRight className="size-4" />
            </Link>
            <Link href="/login" className="m-btn m-btn-ghost">
              Log in
            </Link>
          </div>
          <p className="m-enter-up mt-4 text-xs" style={{ color: "var(--m-muted)", animationDelay: `${wordCount * 80 + 460}ms` }}>
            No credit card required · 14-day free trial
          </p>
        </div>

        {/* Product preview — hero scales behind it on scroll */}
        <Reveal className="relative z-0 mx-auto mt-16 max-w-5xl">
          <DashboardMock />
        </Reveal>
      </section>

      {/* ---------------- Logos ---------------- */}
      <section className="px-5 py-12">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-center text-xs tracking-wide uppercase" style={{ color: "var(--m-muted)" }}>
              Trusted by teams in 60+ countries
            </p>
          </Reveal>
          <div className="m-marquee-mask mt-8 overflow-hidden">
            <div className="m-marquee gap-12">
              {[0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5].map((p, i) => (
                <ProofLogo key={i} seed={p} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Stats ---------------- */}
      <section className="px-5 py-12">
        <Reveal>
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-px overflow-hidden rounded-3xl border md:grid-cols-4" style={{ borderColor: "var(--m-border)", background: "var(--m-border)" }}>
            {STATS.map((s) => (
              <div key={s.label} className="p-7 text-center" style={{ background: "var(--m-bg)" }}>
                <p className="m-display text-3xl font-semibold sm:text-4xl" style={{ color: "var(--m-accent)" }}>
                  {s.value}
                </p>
                <p className="mt-1 text-sm" style={{ color: "var(--m-muted)" }}>
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ---------------- Features ---------------- */}
      <section id="features" className="px-5 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-sm font-medium tracking-wide uppercase" style={{ color: "var(--m-accent-ink)" }}>
              One platform
            </p>
            <h2 className="m-display mt-3 max-w-2xl text-3xl font-semibold sm:text-4xl">
              Everything you need to run the work — and the people doing it.
            </h2>
          </Reveal>

          <div className="mt-16 space-y-20">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              const flip = i % 2 === 1;
              return (
                <Reveal key={f.title}>
                  <div className={`grid items-center gap-10 lg:grid-cols-2 ${flip ? "lg:[&>*:first-child]:order-2" : ""}`}>
                    <div>
                      <span className="inline-flex items-center gap-2 text-xs font-medium tracking-wide uppercase" style={{ color: "var(--m-accent-ink)" }}>
                        <Icon className="size-4" /> {f.eyebrow}
                      </span>
                      <h3 className="m-display mt-3 text-2xl font-semibold sm:text-3xl">
                        {f.title}
                      </h3>
                      <p className="mt-3 text-base leading-relaxed" style={{ color: "var(--m-muted)" }}>
                        {f.body}
                      </p>
                      <ul className="mt-5 space-y-2.5">
                        {f.bullets.map((b) => (
                          <li key={b} className="flex items-center gap-2.5 text-sm">
                            <span className="flex size-5 items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--m-accent) 18%, transparent)", color: "var(--m-accent)" }}>
                              <Check className="size-3" />
                            </span>
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <FeatureMock kind={f.mock} />
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section className="px-5 py-20 sm:py-28" style={{ background: "var(--m-surface)" }}>
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-center text-sm font-medium tracking-wide uppercase" style={{ color: "var(--m-accent-ink)" }}>
              How it works
            </p>
            <h2 className="m-display mx-auto mt-3 max-w-xl text-center text-3xl font-semibold sm:text-4xl">
              Live in an afternoon, valuable from day one.
            </h2>
          </Reveal>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 100}>
                <div className="m-card h-full p-7">
                  <span className="m-mono text-sm font-medium" style={{ color: "var(--m-accent-ink)" }}>
                    {s.n}
                  </span>
                  <h3 className="m-display mt-3 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--m-muted)" }}>
                    {s.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Use cases ---------------- */}
      <section id="solutions" className="px-5 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-sm font-medium tracking-wide uppercase" style={{ color: "var(--m-accent-ink)" }}>
              Solutions
            </p>
            <h2 className="m-display mt-3 max-w-2xl text-3xl font-semibold sm:text-4xl">
              Built for the way your teams actually work.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {USE_CASES.map((u, i) => {
              const Icon = u.icon;
              return (
                <Reveal key={u.title} delay={i * 90}>
                  <div className="m-card h-full p-6 transition-transform duration-300 hover:-translate-y-1">
                    <span className="inline-flex size-11 items-center justify-center rounded-xl" style={{ background: "color-mix(in srgb, var(--m-accent) 16%, transparent)", color: "var(--m-accent)" }}>
                      <Icon className="size-5" />
                    </span>
                    <h3 className="m-display mt-4 text-base font-semibold">{u.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--m-muted)" }}>
                      {u.body}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------------- Testimonials ---------------- */}
      <section className="px-5 py-20 sm:py-28" style={{ background: "var(--m-surface)" }}>
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <h2 className="m-display max-w-2xl text-3xl font-semibold sm:text-4xl">
              Teams run calmer on WorkPulse.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 100}>
                <figure className="m-card flex h-full flex-col p-7">
                  <div className="flex gap-0.5" style={{ color: "var(--m-accent)" }}>
                    {Array.from({ length: 5 }).map((_, k) => (
                      <Star key={k} className="size-4 fill-current" />
                    ))}
                  </div>
                  <blockquote className="mt-4 flex-1 text-sm leading-relaxed">
                    “{t.quote}”
                  </blockquote>
                  <figcaption className="mt-5 flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-full text-xs font-semibold" style={{ background: "color-mix(in srgb, var(--m-accent) 18%, transparent)", color: "var(--m-accent)" }}>
                      {t.name.split(" ").map((n) => n[0]).join("")}
                    </span>
                    <span>
                      <span className="block text-sm font-medium">{t.name}</span>
                      <span className="block text-xs" style={{ color: "var(--m-muted)" }}>
                        {t.role}
                      </span>
                    </span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Pricing ---------------- */}
      <section id="pricing" className="px-5 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-center text-sm font-medium tracking-wide uppercase" style={{ color: "var(--m-accent-ink)" }}>
              Pricing
            </p>
            <h2 className="m-display mx-auto mt-3 max-w-xl text-center text-3xl font-semibold sm:text-4xl">
              Simple per-seat pricing. Free while we&apos;re in beta.
            </h2>
          </Reveal>
          <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-3">
            {PRICING.map((p, i) => (
              <Reveal key={p.name} delay={i * 90}>
                <div
                  className="m-card relative flex h-full flex-col p-7"
                  style={
                    p.featured
                      ? { borderColor: "var(--m-accent)", boxShadow: "0 24px 60px -36px color-mix(in srgb, var(--m-accent) 60%, transparent)" }
                      : undefined
                  }
                >
                  {p.featured ? (
                    <span className="absolute -top-3 left-7 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: "var(--m-accent)", color: "var(--m-on-accent)" }}>
                      Most popular
                    </span>
                  ) : null}
                  <h3 className="m-display text-lg font-semibold">{p.name}</h3>
                  <p className="mt-1 text-sm" style={{ color: "var(--m-muted)" }}>
                    {p.tagline}
                  </p>
                  <p className="mt-5">
                    <span className="m-display text-4xl font-semibold">{p.price}</span>
                    {p.price !== "Custom" ? (
                      <span className="text-sm" style={{ color: "var(--m-muted)" }}>
                        {" "}/ user / mo
                      </span>
                    ) : null}
                  </p>
                  <ul className="mt-6 flex-1 space-y-3">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0" style={{ color: "var(--m-accent)" }} />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/register"
                    className={`m-btn mt-7 w-full ${p.featured ? "m-btn-primary" : "m-btn-ghost"}`}
                  >
                    {p.cta}
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- FAQ ---------------- */}
      <section id="faq" className="px-5 py-20 sm:py-28" style={{ background: "var(--m-surface)" }}>
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <h2 className="m-display text-center text-3xl font-semibold sm:text-4xl">
              Frequently asked questions
            </h2>
          </Reveal>
          <div className="mt-10 divide-y" style={{ borderColor: "var(--m-border)" }}>
            {FAQS.map((f, i) => (
              <Reveal key={i} delay={i * 60}>
                <FaqItem q={f.q} a={f.a} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Final CTA ---------------- */}
      <section className="px-5 py-24 sm:py-32">
        <Reveal>
          <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[28px] border p-10 text-center sm:p-16" style={{ borderColor: "var(--m-border)", background: "var(--m-surface)" }}>
            <div className="m-aurora" aria-hidden="true" style={{ opacity: 0.4 }}>
              <span style={{ width: "40%", height: "120%", left: "10%", top: "-20%", background: "var(--m-accent)", animation: "m-drift-a 24s ease-in-out infinite" }} />
              <span style={{ width: "40%", height: "120%", right: "8%", top: "-10%", background: "var(--m-accent-2)", animation: "m-drift-b 28s ease-in-out infinite" }} />
            </div>
            <div className="relative">
              <h2 className="m-display text-3xl font-semibold sm:text-5xl">
                Find your team&apos;s pulse.
              </h2>
              <p className="mx-auto mt-4 max-w-md text-base" style={{ color: "var(--m-muted)" }}>
                Set up your organization in minutes. No card required while
                we&apos;re in beta.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/register" className="m-btn m-btn-primary">
                  Get started free <ArrowRight className="size-4" />
                </Link>
                <Link href="/login" className="m-btn m-btn-ghost">
                  Log in
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---------------- Footer ---------------- */}
      <Footer />
    </div>
  );
}

/* ============================================================= *
 *  Sub-components                                                 *
 * ============================================================= */

function ProofLogo({ seed }: { seed: number }) {
  const names = ["Northwind", "Lumen", "Cascade", "Atlas", "Falcon", "Vertex"];
  const shapes = [
    <circle key="c" cx="11" cy="11" r="9" />,
    <rect key="r" x="2.5" y="2.5" width="17" height="17" rx="5" />,
    <path key="t" d="M11 2 20 19 2 19z" />,
    <path key="d" d="M11 2 20 11 11 20 2 11z" />,
    <rect key="p" x="3" y="3" width="16" height="16" rx="8" />,
    <path key="h" d="M5 4h12v6H5zM5 13h12v6H5z" />,
  ];
  return (
    <div className="flex shrink-0 items-center gap-2.5" style={{ color: "var(--m-muted)", opacity: 0.7 }}>
      <svg width="22" height="22" viewBox="0 0 22 22" fill="currentColor" aria-hidden>
        {shapes[seed % shapes.length]}
      </svg>
      <span className="m-display text-lg font-semibold tracking-tight">
        {names[seed % names.length]}
      </span>
    </div>
  );
}

/* Faux app dashboard (CSS/SVG only — no images) */
function DashboardMock() {
  return (
    <div className="m-card overflow-hidden" style={{ boxShadow: "0 50px 120px -50px rgb(0 0 0 / 0.55)" }}>
      {/* window bar */}
      <div className="flex items-center gap-1.5 border-b px-4 py-3" style={{ borderColor: "var(--m-border)" }}>
        <span className="size-2.5 rounded-full" style={{ background: "#ff5f57" }} />
        <span className="size-2.5 rounded-full" style={{ background: "#febc2e" }} />
        <span className="size-2.5 rounded-full" style={{ background: "#28c840" }} />
        <span className="ml-3 text-xs" style={{ color: "var(--m-muted)" }}>
          app.workpulse.io/dashboard
        </span>
      </div>
      <div className="grid grid-cols-[180px_1fr]">
        {/* sidebar */}
        <div className="hidden flex-col gap-2 border-r p-4 sm:flex" style={{ borderColor: "var(--m-border)" }}>
          <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium" style={{ background: "color-mix(in srgb, var(--m-accent) 16%, transparent)", color: "var(--m-accent)" }}>
            <Activity className="size-3.5" /> Dashboard
          </div>
          {["Time tracking", "Projects", "Employees", "Reports"].map((s) => (
            <div key={s} className="px-2 py-1.5 text-xs" style={{ color: "var(--m-muted)" }}>
              {s}
            </div>
          ))}
        </div>
        {/* main */}
        <div className="p-5">
          <div className="grid grid-cols-3 gap-3">
            {[
              { k: "Hours today", v: "1,284" },
              { k: "Productive", v: "82%" },
              { k: "On time", v: "96%" },
            ].map((c) => (
              <div key={c.k} className="rounded-xl border p-3" style={{ borderColor: "var(--m-border)" }}>
                <p className="text-[0.65rem]" style={{ color: "var(--m-muted)" }}>
                  {c.k}
                </p>
                <p className="m-display mt-1 text-lg font-semibold">{c.v}</p>
              </div>
            ))}
          </div>
          {/* bar chart */}
          <div className="mt-4 flex h-28 items-end gap-2 rounded-xl border p-3" style={{ borderColor: "var(--m-border)" }}>
            {[42, 58, 50, 70, 64, 30, 16].map((h, i) => (
              <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: i === 3 ? "var(--m-accent)" : "color-mix(in srgb, var(--m-accent) 35%, transparent)" }} />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl border p-3" style={{ borderColor: "var(--m-border)" }}>
              <p className="text-[0.65rem]" style={{ color: "var(--m-muted)" }}>Team pulse</p>
              <svg viewBox="0 0 200 40" className="mt-2 w-full" fill="none">
                <path d="M2 30 C 30 24, 45 10, 70 16 S 120 34, 150 18 S 190 8, 198 12" stroke="var(--m-accent)" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
            <div className="rounded-xl border p-3" style={{ borderColor: "var(--m-border)" }}>
              <p className="text-[0.65rem]" style={{ color: "var(--m-muted)" }}>Approvals</p>
              <p className="m-display mt-1 text-lg font-semibold">8 pending</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Small per-feature mockups */
function FeatureMock({ kind }: { kind: "timer" | "heatmap" | "kanban" | "chart" }) {
  return (
    <div className="m-card p-5" style={{ boxShadow: "0 30px 70px -50px rgb(0 0 0 / 0.5)" }}>
      {kind === "timer" ? (
        <div className="flex flex-col items-center py-6">
          <p className="m-mono text-3xl font-semibold" style={{ color: "var(--m-accent)" }}>02:14:08</p>
          <p className="mt-1 text-xs" style={{ color: "var(--m-muted)" }}>Checkout flow · Acme Storefront</p>
          <div className="mt-5 flex gap-2">
            <span className="m-btn m-btn-primary text-sm">Pause</span>
            <span className="m-btn m-btn-ghost text-sm">Switch task</span>
          </div>
        </div>
      ) : null}
      {kind === "heatmap" ? (
        <div className="space-y-1.5 py-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri"].map((d, r) => (
            <div key={d} className="flex items-center gap-1.5">
              <span className="w-8 text-[0.65rem]" style={{ color: "var(--m-muted)" }}>{d}</span>
              <div className="flex flex-1 gap-1">
                {Array.from({ length: 10 }).map((_, c) => {
                  const v = ((r * 7 + c * 3) % 10) * 10 + 12;
                  return <div key={c} className="h-4 flex-1 rounded-[3px]" style={{ background: `color-mix(in srgb, var(--m-accent) ${v}%, var(--m-surface-2))` }} />;
                })}
    <div className="flex min-h-screen flex-col bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="size-5" />
            </div>
            <span className="text-base font-semibold tracking-tight">WorkPulse</span>
          </div>
          <nav className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <a href="#metrics" className="transition-colors hover:text-foreground">Why WorkPulse</a>
            <a href="#security" className="transition-colors hover:text-foreground">Security</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button render={<Link href="/login" />} nativeButton={false} variant="ghost">
              Sign in
            </Button>
            <Button render={<Link href="/register" />} nativeButton={false}>
              Get started
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-2 lg:items-center lg:py-24">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border bg-feature-tint px-3 py-1 text-xs font-medium text-primary">
              <span className="size-1.5 rounded-full bg-primary" />
              Workforce productivity, reimagined
            </div>
            <h1 className="text-balance font-heading text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Measure the{" "}
              <span className="text-primary">rhythm</span> of work.
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-lg text-muted-foreground">
              One calm, privacy-first platform for time tracking, activity
              monitoring, and AI-powered insight — built for modern teams.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button render={<Link href="/register" />} nativeButton={false} size="lg">
                Get started <ArrowRight className="size-4" />
              </Button>
              <Button render={<Link href="/login" />} nativeButton={false} size="lg" variant="outline">
                View live demo
              </Button>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-success" />
              No credit card · runs entirely on mock data.
            </p>
          </div>

          {/* Product preview card */}
          <div className="relative">
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] bg-feature-tint/60 blur-2xl"
            />
            <div className="rounded-3xl border bg-card p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Team productivity</p>
                <span className="rounded-full bg-success/12 px-2 py-0.5 text-xs font-medium text-success">
                  ▲ 3% WoW
                </span>
              </div>

              {/* Featured pulse card */}
              <div className="mt-4 overflow-hidden rounded-2xl bg-feature p-5 text-feature-foreground">
                <p className="text-sm text-feature-foreground/80">Avg. productivity</p>
                <p className="mt-1 font-heading text-4xl font-semibold tabular-nums">86%</p>
                <Sparkline
                  data={HERO_PULSE}
                  area
                  showDot={false}
                  width={420}
                  height={64}
                  className="mt-3 w-full text-white"
                />
              </div>

              {/* Mini stat row */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <PreviewStat label="Active now" value="75" data={[60, 64, 62, 70, 68, 74, 75]} />
                <PreviewStat label="Hours today" value="612h" data={[520, 548, 560, 590, 575, 600, 612]} />
              </div>
            </div>
          </div>
        </section>

        {/* Stat strip */}
        <section id="metrics" className="border-y bg-card/50">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-10 md:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="font-heading text-3xl font-semibold tabular-nums text-foreground">
                  {s.value}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              Everything to run a modern, measured team
            </h2>
            <p className="mt-3 text-muted-foreground">
              Nine surfaces, one quiet control plane — from the live timer to
              AI-written summaries.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border bg-card p-6 shadow-soft transition-shadow hover:shadow-md"
              >
                <div className="mb-4 flex size-11 items-center justify-center rounded-xl bg-feature-tint text-primary">
                  <f.icon className="size-5" />
                </div>
                <h3 className="font-medium">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {kind === "kanban" ? (
        <div className="grid grid-cols-3 gap-2 py-2">
          {[["To do", 2], ["Doing", 1], ["Done", 3]].map(([t, n]) => (
            <div key={t as string} className="rounded-lg p-2" style={{ background: "var(--m-surface-2)" }}>
              <p className="mb-2 text-[0.65rem] font-medium" style={{ color: "var(--m-muted)" }}>{t}</p>
              {Array.from({ length: n as number }).map((_, i) => (
                <div key={i} className="mb-1.5 rounded-md border p-2 text-[0.65rem]" style={{ borderColor: "var(--m-border)", background: "var(--m-surface)" }}>
                  Task {i + 1}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : null}
      {kind === "chart" ? (
        <div className="py-2">
          <div className="flex h-32 items-end gap-2">
            {[40, 55, 48, 66, 60, 74, 80].map((h, i) => (
              <div key={i} className="flex-1 rounded-t" style={{ height: `${h}%`, background: i >= 5 ? "var(--m-accent)" : "color-mix(in srgb, var(--m-accent) 35%, transparent)" }} />
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs" style={{ color: "var(--m-muted)" }}>
            <span>This week</span>
            <span style={{ color: "var(--m-success)" }}>▲ 6%</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="py-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
        aria-expanded={open}
      >
        <span className="font-medium">{q}</span>
        <span className="shrink-0" style={{ color: "var(--m-accent)" }}>
          {open ? <Minus className="size-4" /> : <ChevronDown className="size-4" />}
        </span>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <p className="pb-4 text-sm leading-relaxed" style={{ color: "var(--m-muted)" }}>
            {a}
          </p>
        </div>
      </div>
        </section>

        {/* Security highlight */}
        <section id="security" className="mx-auto max-w-6xl px-6 pb-20">
          <div className="grid gap-10 rounded-3xl border bg-card p-8 shadow-soft lg:grid-cols-2 lg:items-center lg:p-12">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-feature-tint px-3 py-1 text-xs font-medium text-primary">
                <ShieldCheck className="size-3.5" /> Privacy-first
              </div>
              <h2 className="font-heading text-3xl font-semibold tracking-tight">
                Monitoring built on consent, not surveillance.
              </h2>
              <p className="mt-3 text-muted-foreground">
                WorkPulse is a control surface, not a watchtower. Every capture is
                consent-aware, every role is least-privilege, and every action
                lands in the audit log.
              </p>
            </div>
            <ul className="space-y-3">
              {[
                "Granular role-based access control with a wildcard owner role",
                "MFA, SSO, and session policies out of the box",
                "Consent banners and anonymization across monitoring",
                "Full audit trail for permission and login events",
              ].map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  <span className="text-muted-foreground">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA band */}
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="relative overflow-hidden rounded-3xl bg-feature px-8 py-14 text-center text-feature-foreground">
            <div className="pointer-events-none absolute inset-x-0 bottom-0 opacity-25">
              <Sparkline data={HERO_PULSE} area showDot={false} width={1100} height={180} className="w-full text-white" />
            </div>
            <h2 className="relative font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              See your team&apos;s rhythm in minutes.
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-feature-foreground/80">
              Spin up the full demo workspace — no signup friction, no real data.
            </p>
            <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button
                render={<Link href="/register" />}
                nativeButton={false}
                size="lg"
                className="bg-white text-primary hover:bg-white/90"
              >
                Create your workspace <ArrowRight className="size-4" />
              </Button>
              <Button
                render={<Link href="/login" />}
                nativeButton={false}
                size="lg"
                variant="outline"
                className="border-white/30 bg-transparent text-feature-foreground hover:bg-white/10"
              >
                Sign in
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Activity className="size-3.5" />
            </div>
            <span className="font-medium text-foreground">WorkPulse</span>
          </div>
          <p>Phase 1 frontend demo · mock data only.</p>
        </div>
      </footer>
    </div>
  );
}

function Footer() {
  const cols = [
    { h: "Product", links: ["Time tracking", "Activity", "Projects", "Reports", "Integrations"] },
    { h: "Solutions", links: ["Field service", "Remote teams", "Agencies", "Construction"] },
    { h: "Company", links: ["About", "Careers", "Blog", "Contact"] },
    { h: "Resources", links: ["Help center", "API docs", "Status", "Security"] },
    { h: "Legal", links: ["Privacy", "Terms", "DPA"] },
  ];
  return (
    <footer className="border-t px-5 pt-16 pb-10" style={{ borderColor: "var(--m-border)" }}>
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(5,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm" style={{ color: "var(--m-muted)" }}>
              Workforce activity &amp; productivity — one clear pulse for the
              whole organization.
            </p>
            <div className="mt-5 flex gap-2.5">
              <CheckCheck className="size-4" style={{ color: "var(--m-muted)" }} />
              <span className="text-xs" style={{ color: "var(--m-muted)" }}>SOC 2 · GDPR ready</span>
            </div>
          </div>
          {cols.map((c) => (
            <div key={c.h}>
              <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--m-text)" }}>
                {c.h}
              </p>
              <ul className="mt-3 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="text-sm transition-colors hover:opacity-70" style={{ color: "var(--m-muted)" }}>
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t pt-6 sm:flex-row" style={{ borderColor: "var(--m-border)" }}>
          <p className="text-xs" style={{ color: "var(--m-muted)" }}>
            © 2026 WorkPulse. All rights reserved.
          </p>
          <div className="flex gap-5 text-xs" style={{ color: "var(--m-muted)" }}>
            <a href="#" className="hover:opacity-70">Privacy</a>
            <a href="#" className="hover:opacity-70">Terms</a>
            <a href="#" className="hover:opacity-70">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
function PreviewStat({
  label,
  value,
  data,
}: {
  label: string;
  value: string;
  data: number[];
}) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-heading text-xl font-semibold tabular-nums">{value}</p>
      <Sparkline data={data} showDot={false} width={160} height={28} className="mt-2 w-full text-primary" />
    </div>
  );
}
