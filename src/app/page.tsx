"use client";

/* ============================================================= *
 *  WorkPulse — Landing page (full marketing site)                *
 *  Nav · Hero+preview · Logos · Stats · Features · How it works  *
 *  Use cases · Testimonials · Pricing · FAQ · CTA · Footer       *
 * ============================================================= */

import "./marketing.css";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import {
  Activity,
  AlarmClock,
  ArrowRight,
  Bell,
  Briefcase,
  CalendarCheck,
  CalendarClock,
  Camera,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  CreditCard,
  DollarSign,
  Fingerprint,
  FolderKanban,
  Gauge,
  Globe,
  Headset,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  LineChart,
  Mail,
  Minus,
  MonitorSmartphone,
  ScrollText,
  Search,
  ShieldCheck,
  Star,
  Sun,
  Users,
  Wallet,
} from "lucide-react";
import { MarketingNav } from "@/modules/marketing/marketing-nav";
import { MarketingFooter } from "@/modules/marketing/marketing-footer";
import { GoogleIcon, MicrosoftIcon } from "@/modules/marketing/brand-icons";
import { productHref } from "@/modules/marketing/products";
import { Reveal } from "@/modules/marketing/reveal";

const HEADLINE = [
  ["Your", "workforce,"],
  ["in", "perfect", "rhythm."],
];

const STATS = [
  { value: "29", label: "modules, one platform" },
  { value: "1-tap", label: "time tracking, anywhere" },
  { value: "SOC 2", label: "Type II · GDPR ready" },
  { value: "99.9%", label: "uptime SLA" },
];

const FEATURES = [
  {
    eyebrow: "Time tracking",
    icon: Clock,
    title: "Track time without the friction",
    body: "A one-tap timer on web, desktop, and mobile turns into clean, automatic timesheets — ready for approval, payroll, and billing.",
    bullets: ["One-tap & idle-aware timer", "Automatic timesheets", "Approvals & corrections"],
    mock: "timesheet" as const,
    slug: "time-tracking",
  },
  {
    eyebrow: "Activity & productivity",
    icon: Activity,
    title: "See where focus actually goes",
    body: "Active vs. idle time, app & site usage, and a productivity score per person and team — context, not surveillance theatre.",
    bullets: ["Active vs. idle analysis", "App & website usage", "Productivity score"],
    mock: "activity" as const,
    slug: "activity-monitoring",
  },
  {
    eyebrow: "Projects & attendance",
    icon: FolderKanban,
    title: "Plan, assign, and stay on track",
    body: "Kanban boards, attendance, schedules, and leave live next to the time data — so delivery and capacity are always in view.",
    bullets: ["Kanban projects & tasks", "Attendance & schedules", "Leave & approvals"],
    mock: "kanban" as const,
    slug: "projects",
  },
  {
    eyebrow: "Screenshots",
    icon: Camera,
    title: "Proof of work, captured with consent",
    body: "Optional, policy-gated screenshots at set intervals — blurred by default and fully audited — so you get proof of work without the surveillance theatre.",
    bullets: ["Interval screenshot capture", "Blur & privacy controls", "Searchable, audited gallery"],
    mock: "screenshots" as const,
    slug: "activity-monitoring",
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
];

const MODULE_GROUPS = [
  {
    icon: Clock,
    title: "Time & projects",
    items: [
      "One-tap timer & timesheets",
      "Attendance & schedules",
      "Kanban projects & tasks",
      "Leave & approvals",
    ],
  },
  {
    icon: Users,
    title: "People & payroll",
    items: [
      "Employee directory & profiles",
      "Payroll periods & exports",
      "Departments, teams & roles",
      "Org settings & working hours",
    ],
  },
  {
    icon: Activity,
    title: "Monitoring & insights",
    items: [
      "Active vs. idle & app usage",
      "Screenshots & timelines",
      "Live dashboards & reports",
      "AI summaries & anomalies",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Control & security",
    items: [
      "Roles & permissions (RBAC)",
      "SSO / SAML, SCIM & MFA",
      "Audit logs & approvals",
      "Desktop agents & remote support",
    ],
  },
];

const ENTERPRISE = [
  { icon: KeyRound, title: "SSO / SAML & SCIM", body: "One-click sign-on and automated user provisioning for your whole org." },
  { icon: Fingerprint, title: "MFA & session policies", body: "Enforce multi-factor, session limits, and device-level controls." },
  { icon: ScrollText, title: "Audit logs", body: "Every action, permission change, and login — captured and searchable." },
  { icon: Globe, title: "Data residency & DPA", body: "Choose where data lives; encrypted in transit and at rest." },
  { icon: Headset, title: "Approval-gated remote support", body: "Consent-based remote sessions with a full audit trail." },
  { icon: MonitorSmartphone, title: "Desktop agent management", body: "Roll out, configure, and monitor agent health at scale." },
];

const COMPLIANCE = ["SOC 2", "GDPR", "ISO 27001", "DPA"];

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
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
      <MarketingNav onDark />

      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden px-5 pt-36 pb-12 sm:pt-44 sm:pb-16">
        {/* Dusk gradient backdrop — fades into the page */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{ background: "#0b1413" }}
        />
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <span className="absolute rounded-full" style={{ width: "72vw", height: "72vw", left: "50%", top: "32%", transform: "translate(-50%, -50%)", background: "radial-gradient(circle, color-mix(in srgb, var(--m-accent) 28%, transparent), transparent 60%)" }} />
          <span className="absolute rounded-full" style={{ width: "50vw", height: "50vw", left: "-12%", top: "-14%", background: "radial-gradient(circle, color-mix(in srgb, var(--m-accent) 20%, transparent), transparent 62%)", animation: "m-drift-a 30s ease-in-out infinite" }} />
          <span className="absolute rounded-full" style={{ width: "44vw", height: "44vw", right: "-14%", top: "-8%", background: "radial-gradient(circle, rgba(120,190,180,0.18), transparent 62%)", animation: "m-drift-c 34s ease-in-out infinite" }} />
        </div>

        <div ref={heroRef} className="relative z-10 mx-auto max-w-3xl text-center" style={{ willChange: "transform, opacity" }}>
          <h1 className="m-display font-light tracking-tight text-white text-[clamp(2.9rem,8.5vw,5.6rem)] leading-[1.0]">
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
          <p className="m-enter-up mx-auto mt-6 max-w-xl text-base leading-relaxed sm:text-lg" style={{ color: "rgb(255 255 255 / 0.84)", animationDelay: `${wordCount * 80 + 220}ms` }}>
            Time tracking, attendance, activity, and projects in one platform —
            turned into a single clear signal so you can run a healthier, more
            productive team.
          </p>
          <div className="m-enter-up mt-9 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: `${wordCount * 80 + 360}ms` }}>
            <Link href="/register" className="m-btn" style={{ background: "#ffffff", color: "var(--m-accent-ink)" }}>
              Get started free <ArrowRight className="size-4" />
            </Link>
            <Link href="/login" className="m-btn" style={{ background: "rgb(255 255 255 / 0.14)", color: "#fff", border: "1px solid rgb(255 255 255 / 0.34)", backdropFilter: "blur(6px)" }}>
              Book a demo
            </Link>
          </div>
          <p className="m-enter-up mt-4 text-xs" style={{ color: "rgb(255 255 255 / 0.7)", animationDelay: `${wordCount * 80 + 460}ms` }}>
            No credit card required · 14-day free trial
          </p>
        </div>

        {/* Product preview — hero scales behind it on scroll */}
        <Reveal className="relative z-10 mx-auto mt-14 max-w-5xl sm:mt-16">
          <div
            className="rounded-[20px] p-2"
            style={{ background: "rgb(255 255 255 / 0.06)", border: "1px solid rgb(255 255 255 / 0.16)", backdropFilter: "blur(6px)", boxShadow: "0 50px 120px -40px rgb(8 30 28 / 0.6)" }}
          >
            <DashboardMock />
          </div>
        </Reveal>
      </section>

      {/* ---------------- Social proof (logos + stats) ---------------- */}
      <section className="px-5 py-14">
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
          <Reveal>
            <div className="mt-10 grid max-w-5xl grid-cols-2 gap-px overflow-hidden rounded-3xl border md:mx-auto md:grid-cols-4" style={{ borderColor: "var(--m-border)", background: "var(--m-border)" }}>
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
        </div>
      </section>

      {/* ---------------- Features (dark showcase) ---------------- */}
      <section id="features" className="relative overflow-hidden px-5 py-24 sm:py-28" style={{ background: "#0b1413", color: "#fff" }}>
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <span className="absolute rounded-full" style={{ width: "55vw", height: "55vw", left: "-10%", top: "8%", background: "radial-gradient(circle, color-mix(in srgb, var(--m-accent) 16%, transparent), transparent 62%)" }} />
        </div>
        <div className="relative mx-auto max-w-6xl">
          <Reveal>
            <p className="text-sm font-semibold tracking-wide uppercase" style={{ color: "var(--m-accent-3)" }}>
              One platform
            </p>
          </Reveal>
          <Reveal delay={100}>
            <h2 className="m-display mt-3 max-w-2xl text-3xl font-semibold text-white sm:text-4xl">
              Everything you need to run the work — and the people doing it.
            </h2>
          </Reveal>

          <div className="mt-16 space-y-20">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              const flip = i % 2 === 1;
              return (
                <div key={f.title} className={`grid items-center gap-10 lg:grid-cols-2 ${flip ? "lg:[&>*:first-child]:order-2" : ""}`}>
                  <div>
                    <Reveal>
                      <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--m-accent-3)" }}>
                        <Icon className="size-4" /> {f.eyebrow}
                      </span>
                    </Reveal>
                    <Reveal delay={80} className="mt-3">
                      <h3 className="m-display text-2xl font-semibold text-white sm:text-3xl">
                        {f.title}
                      </h3>
                    </Reveal>
                    <Reveal delay={160} className="mt-3">
                      <p className="text-base leading-relaxed" style={{ color: "rgb(255 255 255 / 0.66)" }}>
                        {f.body}
                      </p>
                    </Reveal>
                    <Reveal delay={240} className="mt-6">
                      <div className="border-t pt-5" style={{ borderColor: "rgb(255 255 255 / 0.12)" }}>
                        <p className="text-[0.7rem] font-semibold tracking-wide" style={{ color: "rgb(255 255 255 / 0.4)" }}>
                          Features
                        </p>
                        <ul className="mt-3 space-y-2">
                          {f.bullets.map((b) => (
                            <li key={b} className="m-mono flex items-center gap-2.5 text-[0.8rem] tracking-wide uppercase" style={{ color: "rgb(255 255 255 / 0.86)" }}>
                              <span className="h-px w-3 shrink-0" style={{ background: "var(--m-accent-3)" }} />
                              {b}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </Reveal>
                    <Reveal delay={320} className="mt-6">
                      <Link
                        href={productHref(f.slug)}
                        className="inline-flex items-center gap-1.5 text-sm font-medium"
                        style={{ color: "var(--m-accent-3)" }}
                      >
                        Explore {f.eyebrow} <ArrowRight className="size-4" />
                      </Link>
                    </Reveal>
                  </div>
                  <Reveal delay={120}>
                    <div className="aspect-[16/10] overflow-hidden rounded-2xl p-1.5" style={{ background: "rgb(255 255 255 / 0.06)", border: "1px solid rgb(255 255 255 / 0.12)", backdropFilter: "blur(6px)" }}>
                      <FeatureMock kind={f.mock} />
                    </div>
                  </Reveal>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------------- Everything included (module grid) ---------------- */}
      <section
        id="platform"
        className="px-5 py-20 sm:py-28"
        style={{ borderTop: "1px solid var(--m-border)" }}
      >
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-center text-sm font-medium tracking-wide uppercase" style={{ color: "var(--m-accent-ink)" }}>
              One platform, every workflow
            </p>
            <h2 className="m-display mx-auto mt-3 max-w-2xl text-center text-3xl font-semibold sm:text-4xl">
              Everything your organization runs on — in one place.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-base leading-relaxed" style={{ color: "var(--m-muted)" }}>
              Replace a stack of point tools with one workforce platform. Time,
              projects, people, monitoring, insights, and controls — all connected.
            </p>
          </Reveal>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {MODULE_GROUPS.map((g, i) => {
              const Icon = g.icon;
              return (
                <Reveal key={g.title} delay={i * 80}>
                  <div className="m-card h-full p-6">
                    <span className="inline-flex size-11 items-center justify-center rounded-xl" style={{ background: "color-mix(in srgb, var(--m-accent) 16%, transparent)", color: "var(--m-accent)" }}>
                      <Icon className="size-5" />
                    </span>
                    <h3 className="m-display mt-4 text-base font-semibold">{g.title}</h3>
                    <ul className="mt-3 space-y-2">
                      {g.items.map((it) => (
                        <li key={it} className="flex items-start gap-2 text-sm" style={{ color: "var(--m-muted)" }}>
                          <Check className="mt-0.5 size-3.5 shrink-0" style={{ color: "var(--m-accent)" }} />
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

      {/* ---------------- Integrations (hub & spoke, dark) ---------------- */}
      <section id="integrations" className="relative overflow-hidden px-5 py-24 sm:py-28" style={{ background: "#0b1413", color: "#fff" }}>
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <span className="absolute top-1/2 left-1/2 size-[55vw] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "radial-gradient(circle, color-mix(in srgb, var(--m-accent) 20%, transparent), transparent 62%)" }} />
        </div>
        <div className="relative mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="text-sm font-semibold tracking-wide uppercase" style={{ color: "var(--m-accent-3)" }}>
              Integrations
            </p>
            <h2 className="m-display mt-3 text-3xl font-semibold sm:text-4xl">Integrates with your workflow.</h2>
            <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed" style={{ color: "rgb(255 255 255 / 0.66)" }}>
              Whether you&apos;re a small business or a large enterprise, WorkPulse
              connects to the tools you already use — Slack, GitHub, Google
              Workspace, Microsoft, and more.
            </p>
          </Reveal>
        </div>

        <Reveal className="relative mt-14">
          <IntegrationsHub />
          {/* mobile fallback */}
          <div className="mx-auto grid max-w-[15rem] grid-cols-3 gap-3 md:hidden">
            {LOGOS.map((l) => (
              <div key={l.name} className="flex aspect-square items-center justify-center rounded-2xl" style={{ background: "rgb(255 255 255 / 0.05)", border: "1px solid rgb(255 255 255 / 0.1)" }}>
                {l.glyph}
              </div>
            ))}
          </div>
        </Reveal>

        <div className="relative mt-12 text-center">
          <Link
            href={productHref("integrations")}
            className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold tracking-wide uppercase transition-colors hover:bg-white/10"
            style={{ background: "rgb(255 255 255 / 0.06)", border: "1px solid rgb(255 255 255 / 0.16)", color: "#fff" }}
          >
            Explore integrations <ChevronRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* ---------------- Enterprise & security ---------------- */}
      <section id="security" className="px-5 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-sm font-medium tracking-wide uppercase" style={{ color: "var(--m-accent-ink)" }}>
              Enterprise &amp; security
            </p>
            <h2 className="m-display mt-3 max-w-2xl text-3xl font-semibold sm:text-4xl">
              Built for IT, trusted by the business.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ENTERPRISE.map((e, i) => {
              const Icon = e.icon;
              return (
                <Reveal key={e.title} delay={i * 70}>
                  <div className="m-card h-full p-6">
                    <span className="inline-flex size-11 items-center justify-center rounded-xl" style={{ background: "color-mix(in srgb, var(--m-accent) 16%, transparent)", color: "var(--m-accent)" }}>
                      <Icon className="size-5" />
                    </span>
                    <h3 className="m-display mt-4 text-base font-semibold">{e.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--m-muted)" }}>
                      {e.body}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
          <Reveal>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              {COMPLIANCE.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium"
                  style={{ borderColor: "var(--m-border-strong)", color: "var(--m-muted)" }}
                >
                  <ShieldCheck className="size-3.5" style={{ color: "var(--m-accent)" }} /> {c}
                </span>
              ))}
            </div>
          </Reveal>
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
      <MarketingFooter />
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

/* Glassmorphic dashboard mock — mirrors the real WorkPulse dashboard. */
const MOCK_NAV = [
  { group: "Work", items: [
    { label: "Dashboard", icon: LayoutDashboard, active: true },
    { label: "Time Tracking", icon: Clock },
    { label: "Projects", icon: FolderKanban },
  ] },
  { group: "Manage", items: [
    { label: "Employees", icon: Users },
    { label: "Attendance", icon: CalendarCheck },
    { label: "Leave", icon: Briefcase },
    { label: "Approvals", icon: CheckCheck },
  ] },
  { group: "Finance", items: [
    { label: "Payroll", icon: Wallet },
    { label: "Billing", icon: CreditCard },
  ] },
  { group: "Analytics", items: [{ label: "Analytics", icon: LineChart }] },
  { group: "Comms", items: [{ label: "Inbox", icon: Mail }] },
];

const MOCK_KPIS = [
  { label: "Productivity Score", value: "69%", delta: "3%", up: false, icon: Gauge, d: "M0 18 L11 14 L22 19 L33 9 L44 15 L55 7" },
  { label: "Hours Tracked", value: "4,477h", delta: "12%", up: true, icon: Clock, d: "M0 20 L11 16 L22 18 L33 8 L44 11 L55 6" },
  { label: "Billable", value: "80%", delta: "5%", up: true, icon: DollarSign, d: "M0 14 L11 18 L22 12 L33 16 L44 8 L55 12" },
  { label: "Avg Activity", value: "84%", delta: "7%", up: true, icon: Activity, d: "M0 16 L11 10 L22 18 L33 12 L44 15 L55 6" },
];

const DONUT = [
  { label: "Present", n: 87, pct: "72%", len: 190, off: 0, color: "var(--m-success)" },
  { label: "Late", n: 13, pct: "11%", len: 29, off: -190, color: "#e0922a" },
  { label: "On leave", n: 10, pct: "8%", len: 21, off: -219, color: "#94a3a5" },
  { label: "Absent", n: 11, pct: "9%", len: 24, off: -240, color: "var(--m-danger)" },
];

const DEADLINES = [
  { task: "Q3 productivity report", due: "Due in 2h", urgent: true },
  { task: "Onboard 3 new hires", due: "Due today", urgent: true },
  { task: "Client billing review", due: "Tomorrow", urgent: false },
  { task: "Security policy update", due: "In 3 days", urgent: false },
];

const glassCard = {
  background: "rgb(255 255 255 / 0.07)",
  border: "1px solid rgb(255 255 255 / 0.13)",
  backdropFilter: "blur(8px)",
} as const;

function DashboardMock() {
  return (
    <div
      className="grid grid-cols-1 overflow-hidden rounded-2xl text-[11px] sm:grid-cols-[150px_1fr]"
      style={{
        background: "linear-gradient(180deg, rgb(255 255 255 / 0.08), rgb(255 255 255 / 0.03))",
        border: "1px solid rgb(255 255 255 / 0.14)",
        backdropFilter: "blur(18px)",
        color: "rgb(238 244 242 / 0.92)",
        "--m-text": "#eef4f2",
        "--m-muted": "rgb(238 244 242 / 0.66)",
        "--m-faint": "rgb(238 244 242 / 0.42)",
        "--m-border": "rgb(255 255 255 / 0.1)",
        "--m-border-strong": "rgb(255 255 255 / 0.2)",
        "--m-surface-2": "rgb(255 255 255 / 0.06)",
        "--m-accent": "#4cc5b8",
        "--m-accent-ink": "#8fe0d6",
        "--m-success": "#57c98a",
        "--m-danger": "#f0796a",
      } as CSSProperties}
    >
      {/* Sidebar */}
      <aside className="hidden flex-col gap-3 p-3 sm:flex" style={{ background: "rgb(255 255 255 / 0.05)", borderRight: "1px solid rgb(255 255 255 / 0.12)" }}>
        <div className="flex items-center gap-2 px-1">
          <span className="flex size-6 items-center justify-center rounded-lg" style={{ background: "var(--m-accent)" }}>
            <Activity className="size-3.5 text-white" />
          </span>
          <span className="m-display text-[13px] font-semibold">WorkPulse</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5" style={{ background: "rgb(255 255 255 / 0.06)", color: "var(--m-muted)" }}>
          <Search className="size-3" /> <span className="text-[10px]">Search…</span>
          <span className="ml-auto rounded px-1 text-[8px]" style={{ background: "rgb(255 255 255 / 0.12)" }}>⌘K</span>
        </div>
        <nav className="flex flex-col gap-2.5">
          {MOCK_NAV.map((grp) => (
            <div key={grp.group}>
              <p className="mb-1 px-2 text-[8px] font-semibold tracking-wider uppercase" style={{ color: "var(--m-faint)" }}>{grp.group}</p>
              <ul className="space-y-0.5">
                {grp.items.map((it) => {
                  const Icon = it.icon;
                  return (
                    <li
                      key={it.label}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                      style={it.active
                        ? { background: "var(--m-accent)", color: "#fff" }
                        : { color: "var(--m-muted)" }}
                    >
                      <Icon className="size-3.5 shrink-0" />
                      <span className="truncate text-[10.5px] font-medium">{it.label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="m-display text-base font-semibold">Hello, Alex</p>
            <p className="text-[10px]" style={{ color: "var(--m-muted)" }}>Monday 29 June · Here&apos;s your organization at a glance.</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex size-7 items-center justify-center rounded-full" style={glassCard}>
              <Bell className="size-3.5" style={{ color: "var(--m-muted)" }} />
              <span className="absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full text-[7px] font-semibold text-white" style={{ background: "var(--m-accent)" }}>4</span>
            </span>
            <span className="flex size-7 items-center justify-center rounded-full" style={glassCard}>
              <Sun className="size-3.5" style={{ color: "var(--m-muted)" }} />
            </span>
            <span className="flex items-center gap-1.5 rounded-full py-1 pr-2 pl-1" style={glassCard}>
              <span className="flex size-5 items-center justify-center rounded-full text-[8px] font-semibold text-white" style={{ background: "var(--m-accent)" }}>AM</span>
              <span className="text-[10px] font-medium">Alex Morgan</span>
            </span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="mt-4 flex items-center justify-between gap-2">
          <div className="inline-flex rounded-full p-0.5" style={glassCard}>
            {["Today", "7 days", "30 days", "Quarter"].map((t) => (
              <span
                key={t}
                className="rounded-full px-2.5 py-1 text-[10px] font-medium"
                style={t === "7 days" ? { background: "var(--m-accent)", color: "#fff" } : { color: "var(--m-muted)" }}
              >
                {t}
              </span>
            ))}
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="text-[10px]" style={{ color: "var(--m-muted)" }}>Updated 20:03</span>
            <span className="flex items-center gap-1 rounded-full px-2.5 py-1" style={glassCard}>
              <Users className="size-3" style={{ color: "var(--m-muted)" }} />
              <span className="text-[10px] font-medium">All teams</span>
              <ChevronDown className="size-3" style={{ color: "var(--m-muted)" }} />
            </span>
          </div>
        </div>

        {/* KPI cards */}
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {MOCK_KPIS.map((k, i) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="rounded-xl p-3" style={glassCard}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px]" style={{ color: "var(--m-muted)" }}>{k.label}</span>
                  <span className="flex size-6 items-center justify-center rounded-full" style={{ background: "color-mix(in srgb, var(--m-accent) 14%, transparent)", color: "var(--m-accent)" }}>
                    <Icon className="size-3" />
                  </span>
                </div>
                <p className="m-display mt-1.5 text-xl font-semibold">{k.value}</p>
                <div className="mt-1.5 flex items-center justify-between">
                  <span
                    className="rounded px-1 py-0.5 text-[9px] font-semibold"
                    style={k.up
                      ? { background: "color-mix(in srgb, var(--m-success) 16%, transparent)", color: "var(--m-success)" }
                      : { background: "color-mix(in srgb, var(--m-danger) 16%, transparent)", color: "var(--m-danger)" }}
                  >
                    {k.up ? "↑" : "↓"} {k.delta}
                  </span>
                  <svg viewBox="0 0 55 24" className="h-6 w-16" fill="none" aria-hidden>
                    <defs>
                      <linearGradient id={`mk-spark-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--m-accent)" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="var(--m-accent)" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={`${k.d} L55 24 L0 24 Z`} fill={`url(#mk-spark-${i})`} />
                    <path d={k.d} stroke="var(--m-accent)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            );
          })}
        </div>

        {/* Charts row */}
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[1.6fr_1fr]">
          {/* Productivity Trends */}
          <div className="rounded-xl p-3.5" style={glassCard}>
            <p className="text-[11px] font-semibold">Productivity Trends</p>
            <p className="text-[9px]" style={{ color: "var(--m-muted)" }}>Active vs. productive time · this week</p>
            <div className="mt-2 flex gap-2">
              <div className="flex flex-col justify-between py-0.5 text-[7px]" style={{ color: "var(--m-faint)" }}>
                {[80, 60, 40, 20, 0].map((y) => <span key={y}>{y}</span>)}
              </div>
              <div className="relative flex-1">
                <svg viewBox="0 0 320 150" className="w-full" fill="none">
                  <defs>
                    <linearGradient id="mk-active" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--m-accent)" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="var(--m-accent)" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="mk-prod" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5b8def" stopOpacity="0.42" />
                      <stop offset="100%" stopColor="#5b8def" stopOpacity="0.04" />
                    </linearGradient>
                  </defs>
                  {[30, 60, 90, 120].map((y) => (
                    <line key={y} x1="4" y1={y} x2="316" y2={y} stroke="var(--m-border)" strokeWidth="1" strokeDasharray="2 4" />
                  ))}
                  <path d="M6 46 C 60 38, 110 36, 160 40 S 260 46, 314 36 L314 150 L6 150 Z" fill="url(#mk-active)" />
                  <path d="M6 46 C 60 38, 110 36, 160 40 S 260 46, 314 36" stroke="var(--m-accent)" strokeWidth="2" />
                  <path d="M6 80 C 60 86, 110 90, 160 80 S 260 66, 314 66 L314 150 L6 150 Z" fill="url(#mk-prod)" />
                  <path d="M6 80 C 60 86, 110 90, 160 80 S 260 66, 314 66" stroke="#5b8def" strokeWidth="2" />
                  <line x1="160" y1="16" x2="160" y2="150" stroke="var(--m-border-strong)" strokeWidth="1" strokeDasharray="3 3" />
                  <circle cx="160" cy="40" r="3.5" fill="var(--m-accent)" stroke="#fff" strokeWidth="1.5" />
                  <circle cx="160" cy="80" r="3.5" fill="#5b8def" stroke="#fff" strokeWidth="1.5" />
                </svg>
                <div
                  className="absolute -translate-x-1/2 rounded-md px-2 py-1 text-[7px] leading-snug shadow-md"
                  style={{ left: "50%", top: "4px", background: "rgb(8 22 20 / 0.82)", border: "1px solid rgb(255 255 255 / 0.16)", backdropFilter: "blur(4px)" }}
                >
                  <p className="font-semibold text-white">Thu</p>
                  <p style={{ color: "var(--m-accent)" }}>Active % : 76</p>
                  <p style={{ color: "#7fb0fb" }}>Productive % : 63</p>
                </div>
              </div>
            </div>
            <div className="mt-1 flex justify-between pl-5 text-[8px]" style={{ color: "var(--m-faint)" }}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}
            </div>
          </div>

          {/* Right column: Attendance + Deadline warnings */}
          <div className="flex flex-col gap-3">
            <div className="rounded-xl p-3.5" style={glassCard}>
              <p className="text-[11px] font-semibold">Attendance</p>
              <div className="mt-1 flex items-center gap-3">
                <div className="relative size-[78px] shrink-0">
                  <svg viewBox="0 0 120 120" className="size-full -rotate-90">
                    {DONUT.map((s) => (
                      <circle
                        key={s.label}
                        cx="60" cy="60" r="42" fill="none"
                        stroke={s.color} strokeWidth="13"
                        strokeDasharray={`${s.len} ${264 - s.len}`}
                        strokeDashoffset={s.off}
                      />
                    ))}
                  </svg>
                  <span className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="m-display text-sm font-semibold leading-none">83%</span>
                    <span className="text-[8px]" style={{ color: "var(--m-muted)" }}>clocked in</span>
                  </span>
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  {DONUT.map((s) => (
                    <div key={s.label} className="flex items-center gap-1.5 text-[9.5px]">
                      <span className="size-1.5 rounded-full" style={{ background: s.color }} />
                      <span style={{ color: "var(--m-muted)" }}>{s.label}</span>
                      <span className="ml-auto font-semibold">{s.n}</span>
                      <span className="w-6 text-right" style={{ color: "var(--m-faint)" }}>{s.pct}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t pt-2 text-[9px]" style={{ borderColor: "var(--m-border)", color: "var(--m-muted)" }}>
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full" style={{ background: "var(--m-success)" }} /> Active now
                </span>
                <span>76 active · 24 inactive</span>
              </div>
            </div>

            {/* Deadline warnings */}
            <div className="flex flex-1 flex-col rounded-xl p-3.5" style={glassCard}>
              <div className="flex items-center gap-1.5">
                <AlarmClock className="size-3.5" style={{ color: "var(--m-accent)" }} />
                <p className="text-[11px] font-semibold">Deadline Warnings</p>
              </div>
              <ul className="mt-2 flex-1 space-y-2">
                {DEADLINES.map((d) => (
                  <li key={d.task} className="flex items-center gap-2 text-[9.5px]">
                    <CalendarClock className="size-3 shrink-0" style={{ color: d.urgent ? "var(--m-danger)" : "var(--m-faint)" }} />
                    <span className="truncate">{d.task}</span>
                    <span className="ml-auto shrink-0 font-medium" style={{ color: d.urgent ? "var(--m-danger)" : "var(--m-faint)" }}>
                      {d.due}
                    </span>
                  </li>
                ))}
              </ul>
              <span className="mt-2 inline-flex items-center gap-1 text-[9px] font-medium" style={{ color: "var(--m-accent-ink)" }}>
                View all deadlines <ArrowRight className="size-3" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- Live-animated feature mockups (light "screenshots") ---- */
type FeatureKind = "timesheet" | "activity" | "kanban" | "screenshots";

const sweepBar = (
  <span className="absolute inset-y-0 w-1/2" style={{ background: "linear-gradient(90deg, transparent, rgb(255 255 255 / 0.55), transparent)", animation: "m-sweep 2.4s linear infinite" }} />
);

const TS_ROWS = [
  { name: "Carole Ryan", days: ["7:01", "7:59", "7:47", "8:58", "8:26", "1:56", "0:54"], total: "43:01", c: "#67b8c9" },
  { name: "Rene Kuhn", days: ["7:01", "7:59", "7:47", "8:58", "8:26", "1:56", "0:54"], total: "43:01", c: "#9ccb6a" },
  { name: "Matt Kuhn", days: ["7:01", "7:59", "7:47", "8:58", "8:26", "1:56", "0:54"], total: "43:01", c: "#6f8fd6" },
  { name: "Rosalyn Harris", days: ["8:06", "9:07", "8:49", "6:59", "6:41", "2:15", "1:02"], total: "42:59", c: "#5fb89a" },
  { name: "Audie Turcotte", days: ["8:06", "9:07", "8:49", "6:59", "6:41", "2:15", "1:02"], total: "42:59", c: "#7fcf8a" },
  { name: "Effie Schoen", days: ["8:06", "9:07", "8:49", "6:59", "6:41", "2:15", "1:02"], total: "42:59", c: "#e58a6a" },
  { name: "Jose Dietrich", days: ["8:06", "9:07", "8:49", "6:59", "6:41", "2:15", "1:02"], total: "42:59", c: "#b78cd6" },
];

function TimesheetMock() {
  return (
    <div className="m-card flex h-full flex-col overflow-hidden text-[9px]">
      <div className="flex items-center justify-between gap-2 border-b p-3" style={{ borderColor: "var(--m-border)" }}>
        <div>
          <p className="text-[11px] font-semibold" style={{ color: "var(--m-text)" }}>This Week</p>
          <p style={{ color: "var(--m-faint)" }}>Jun 22 – 28, 2026</p>
        </div>
        <div className="flex items-center gap-1">
          <span className="rounded-full px-2 py-1 font-medium" style={{ background: "var(--m-accent)", color: "#fff" }}>By employee</span>
          <span className="rounded-full px-2 py-1" style={{ color: "var(--m-muted)" }}>By project</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 px-3 pt-2.5">
        {["All", "Approved", "Pending", "Flagged"].map((p, i) => (
          <span key={p} className="rounded-full px-2 py-0.5" style={i === 0 ? { background: "var(--m-accent)", color: "#fff" } : { border: "1px solid var(--m-border)", color: "var(--m-muted)" }}>{p}</span>
        ))}
        <span className="ml-auto" style={{ color: "var(--m-faint)" }}>3630:11 total</span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden pt-2">
      <table className="w-full">
        <thead>
          <tr style={{ color: "var(--m-faint)" }}>
            <th className="px-3 pb-1 text-left font-medium uppercase">Employee</th>
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <th key={i} className="pb-1 text-center font-medium">{d}</th>)}
            <th className="px-3 pb-1 text-right font-medium uppercase">Total</th>
          </tr>
        </thead>
        <tbody>
          {TS_ROWS.map((r, ri) => (
            <tr key={r.name} className="m-enter-up" style={{ borderTop: "1px solid var(--m-border)", animationDelay: `${ri * 90}ms` }}>
              <td className="px-3 py-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="size-4 rounded" style={{ background: r.c }} />
                  <span className="font-medium" style={{ color: "var(--m-text)" }}>{r.name}</span>
                </div>
              </td>
              {r.days.map((t, ci) => (
                <td key={ci} className="relative py-1.5 text-center font-mono" style={{ color: "var(--m-muted)" }}>
                  {ri === 3 && ci === 0 ? (
                    <span className="absolute inset-x-1 inset-y-0.5 overflow-hidden rounded" style={{ background: "color-mix(in srgb, var(--m-accent) 16%, transparent)" }}>
                      {sweepBar}
                    </span>
                  ) : null}
                  <span className="relative">{t}</span>
                </td>
              ))}
              <td className="px-3 py-1.5 text-right font-mono font-semibold" style={{ color: "var(--m-text)" }}>{r.total}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      <div className="mt-auto flex items-center justify-between border-t px-3 py-2 text-[8px]" style={{ borderColor: "var(--m-border)", color: "var(--m-faint)" }}>
        <span>70 of 100 employees approved</span>
        <span>This week</span>
      </div>
    </div>
  );
}

const ACT_CATS = [
  { label: "Productive", pct: 69, color: "#2fa36a", delay: "0s" },
  { label: "Neutral", pct: 22, color: "#5b8def", delay: "0.5s" },
  { label: "Distracting", pct: 9, color: "#e5544a", delay: "1s" },
];

function ActivityMock() {
  return (
    <div className="m-card flex h-full flex-col overflow-hidden p-3.5 text-[9px]">
      <p className="text-[11px] font-semibold" style={{ color: "var(--m-text)" }}>Activity by hour</p>
      <div className="relative mt-1.5">
        <svg viewBox="0 0 300 90" className="w-full" fill="none">
          <defs>
            <linearGradient id="act-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--m-accent)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--m-accent)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          {[22, 45, 68].map((y) => <line key={y} x1="4" y1={y} x2="296" y2={y} stroke="var(--m-border)" strokeWidth="1" />)}
          <path d="M4 58 C 40 40, 70 34, 100 36 C 140 38, 150 70, 175 64 C 205 58, 220 36, 250 34 C 275 33, 285 50, 296 56 L296 88 L4 88 Z" fill="url(#act-fill)" />
          <path d="M4 58 C 40 40, 70 34, 100 36 C 140 38, 150 70, 175 64 C 205 58, 220 36, 250 34 C 275 33, 285 50, 296 56" stroke="var(--m-accent)" strokeWidth="2" />
        </svg>
        <span className="pointer-events-none absolute inset-y-0 w-px" style={{ background: "color-mix(in srgb, var(--m-accent) 55%, transparent)", animation: "m-scan 4.5s ease-in-out infinite" }} />
      </div>
      <div className="mt-1 flex justify-between text-[7px]" style={{ color: "var(--m-faint)" }}>
        {["8a", "10a", "12p", "2p", "4p", "7p"].map((h) => <span key={h}>{h}</span>)}
      </div>
      <div className="mt-auto grid grid-cols-2 gap-4 pt-3">
        <div>
          <p className="text-[10px] font-semibold" style={{ color: "var(--m-text)" }}>Time by category</p>
          <div className="mt-2 space-y-1.5">
            {ACT_CATS.map((c) => (
              <div key={c.label}>
                <div className="flex justify-between text-[8.5px]">
                  <span style={{ color: "var(--m-muted)" }}>{c.label}</span>
                  <span className="font-semibold" style={{ color: "var(--m-text)" }}>{c.pct}%</span>
                </div>
                <div className="mt-0.5 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--m-surface-2)" }}>
                  <div className="relative h-full overflow-hidden rounded-full" style={{ width: `${c.pct}%`, background: c.color }}>
                    <span className="absolute inset-y-0 w-1/2" style={{ background: "linear-gradient(90deg, transparent, rgb(255 255 255 / 0.6), transparent)", animation: "m-sweep 2.6s linear infinite", animationDelay: c.delay }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold" style={{ color: "var(--m-text)" }}>Active vs Inactive</p>
          <div className="relative mx-auto mt-1 size-[58px]">
            <svg viewBox="0 0 120 120" className="size-full -rotate-90">
              <circle cx="60" cy="60" r="45" fill="none" stroke="var(--m-surface-2)" strokeWidth="14" />
              <circle cx="60" cy="60" r="45" fill="none" stroke="var(--m-accent)" strokeWidth="14" strokeLinecap="round" strokeDasharray="215 283" className="animate-pulse" />
            </svg>
            <span className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="m-display text-[13px] font-semibold" style={{ color: "var(--m-text)" }}>76%</span>
              <span className="text-[7px]" style={{ color: "var(--m-muted)" }}>active</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const PRIO: Record<string, { bg: string; fg: string }> = {
  High: { bg: "rgb(229 84 74 / 0.16)", fg: "#c0463c" },
  Medium: { bg: "rgb(224 146 42 / 0.18)", fg: "#a8691b" },
  Low: { bg: "var(--m-surface-2)", fg: "var(--m-muted)" },
};
const KANBAN = [
  { name: "To do", dot: "#9aa3a8", cards: [
    { t: "Investigate monitor port", p: "Medium", due: "Jul 2", overdue: false },
    { t: "Document firewall card", p: "Low", due: "5d overdue", overdue: true },
  ] },
  { name: "In progress", dot: "var(--m-accent)", cards: [
    { t: "Triage transmitter driver", p: "Medium", due: "Sep 1", overdue: false },
    { t: "Migrate feed interface", p: "Low", due: "", overdue: false },
  ] },
  { name: "In review", dot: "#e0922a", cards: [
    { t: "Ship array matrix", p: "Low", due: "Aug 29", overdue: false },
    { t: "Optimize transmitter", p: "Medium", due: "11d overdue", overdue: true },
  ] },
  { name: "Done", dot: "#2fa36a", cards: [
    { t: "Design feed system", p: "High", due: "", overdue: false },
    { t: "Test feed interface", p: "Medium", due: "", overdue: false },
  ] },
];

function KanbanMock() {
  return (
    <div className="m-card flex h-full flex-col overflow-hidden p-3 text-[9px]">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] font-semibold tracking-wide" style={{ color: "var(--m-muted)" }}>TASKS</p>
        <span className="rounded-md px-2 py-0.5 font-medium" style={{ background: "var(--m-accent)", color: "#fff" }}>+ Add task</span>
      </div>
      <div className="grid flex-1 auto-rows-fr grid-cols-4 gap-2">
        {KANBAN.map((col, ci) => (
          <div key={col.name} className="rounded-lg p-1.5" style={{ background: "var(--m-surface-2)" }}>
            <div className="mb-1.5 flex items-center gap-1 px-0.5">
              <span className="size-1.5 rounded-full" style={{ background: col.dot }} />
              <span className="text-[8.5px] font-medium" style={{ color: "var(--m-text)" }}>{col.name}</span>
              <span className="ml-auto text-[8px]" style={{ color: "var(--m-faint)" }}>{col.cards.length}</span>
            </div>
            <div className="space-y-1.5">
              {col.cards.map((card, di) => {
                const lift = ci === 1 && di === 0;
                return (
                  <div
                    key={card.t}
                    className="rounded-md border p-1.5"
                    style={{ borderColor: "var(--m-border)", background: "var(--m-surface)", ...(lift ? { animation: "m-float 4s ease-in-out infinite", boxShadow: "0 8px 20px -10px color-mix(in srgb, var(--m-accent) 55%, transparent)" } : {}) }}
                  >
                    <p className="leading-snug" style={{ color: "var(--m-text)" }}>{card.t}</p>
                    <div className="mt-1 flex items-center justify-between gap-1">
                      <span className="rounded px-1 text-[7.5px] font-medium" style={{ background: PRIO[card.p].bg, color: PRIO[card.p].fg }}>{card.p}</span>
                      {card.due ? (
                        <span className="text-[7.5px]" style={{ color: card.overdue ? "var(--m-danger)" : "var(--m-faint)" }}>{card.due}</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const SHOTS = [
  { bg: "linear-gradient(135deg,#3b6fd4,#6f8fd6)", t: "09:12" },
  { bg: "linear-gradient(135deg,#2fa36a,#5fb89a)", t: "09:24" },
  { bg: "linear-gradient(135deg,#0f766e,#4cc5b8)", t: "09:31" },
  { bg: "linear-gradient(135deg,#9aa3a8,#c4cdd2)", t: "09:40" },
  { bg: "linear-gradient(135deg,#7c5cf7,#a78bfa)", t: "09:52" },
  { bg: "linear-gradient(135deg,#e0922a,#f0b86a)", t: "10:03" },
  { bg: "linear-gradient(135deg,#3b6fd4,#86c3bb)", t: "10:11" },
  { bg: "linear-gradient(135deg,#2fa36a,#86c3bb)", t: "10:20" },
];

function ScreenshotsMock() {
  const [count, setCount] = useState(1284);
  useEffect(() => {
    const id = setInterval(() => setCount((c) => c + 1), 2200);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="m-card flex h-full flex-col overflow-hidden p-3.5 text-[9px]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Camera className="size-3.5" style={{ color: "var(--m-accent)" }} />
          <p className="text-[11px] font-semibold" style={{ color: "var(--m-text)" }}>Screenshots</p>
        </div>
        <span className="inline-flex items-center gap-1 text-[8.5px] font-medium" style={{ color: "var(--m-accent)" }}>
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full opacity-60" style={{ background: "var(--m-accent)" }} />
            <span className="relative inline-flex size-1.5 rounded-full" style={{ background: "var(--m-accent)" }} />
          </span>
          Capturing
        </span>
      </div>
      <p className="m-display mt-1.5 text-2xl font-semibold tabular-nums" style={{ color: "var(--m-text)" }}>{count.toLocaleString()}</p>
      <p className="-mt-0.5" style={{ color: "var(--m-muted)" }}>captured today</p>
      <div className="mt-3 grid flex-1 auto-rows-fr grid-cols-4 gap-1.5">
        {SHOTS.map((s, i) => (
          <div key={i} className="relative overflow-hidden rounded-md" style={{ background: s.bg, border: "1px solid var(--m-border)" }}>
            <span className="absolute top-1 left-1 h-0.5 w-3 rounded-full bg-white/50" />
            <span className="absolute top-2 left-1 h-0.5 w-5 rounded-full bg-white/30" />
            {i === 2 ? <span className="absolute inset-0 animate-pulse" style={{ background: "color-mix(in srgb, var(--m-accent) 28%, transparent)" }} /> : null}
            <span className="absolute right-1 bottom-0.5 text-[6px] text-white/85">{s.t}</span>
          </div>
        ))}
      </div>
      <p className="mt-auto pt-2 text-[8px]" style={{ color: "var(--m-faint)" }}>Blurred · policy-gated · audited</p>
    </div>
  );
}

function FeatureMock({ kind }: { kind: FeatureKind }) {
  if (kind === "timesheet") return <TimesheetMock />;
  if (kind === "activity") return <ActivityMock />;
  if (kind === "kanban") return <KanbanMock />;
  return <ScreenshotsMock />;
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
    </div>
  );
}

/* ---- Integrations hub & spoke (brand glyphs + connector diagram) ---- */
function SlackGlyph({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 122.8 122.8" className={className} aria-hidden>
      <path d="M25.8 77.6a12.9 12.9 0 1 1-12.9-12.9h12.9v12.9z" fill="#e01e5a" />
      <path d="M32.3 77.6a12.9 12.9 0 0 1 25.8 0v32.3a12.9 12.9 0 1 1-25.8 0V77.6z" fill="#e01e5a" />
      <path d="M45.2 25.8a12.9 12.9 0 1 1 12.9-12.9v12.9H45.2z" fill="#36c5f0" />
      <path d="M45.2 32.3a12.9 12.9 0 0 1 0 25.8H12.9a12.9 12.9 0 1 1 0-25.8h32.3z" fill="#36c5f0" />
      <path d="M97 45.2a12.9 12.9 0 1 1 12.9 12.9H97V45.2z" fill="#2eb67d" />
      <path d="M90.5 45.2a12.9 12.9 0 0 1-25.8 0V12.9a12.9 12.9 0 1 1 25.8 0v32.3z" fill="#2eb67d" />
      <path d="M77.6 97a12.9 12.9 0 1 1-12.9 12.9V97h12.9z" fill="#ecb22e" />
      <path d="M77.6 90.5a12.9 12.9 0 0 1 0-25.8h32.3a12.9 12.9 0 1 1 0 25.8H77.6z" fill="#ecb22e" />
    </svg>
  );
}
function GitHubGlyph({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#fff" aria-hidden>
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.71.08-.71 1.17.08 1.79 1.2 1.79 1.2 1.04 1.79 2.73 1.27 3.4.97.1-.75.41-1.27.74-1.56-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.82 1.19 3.08 0 4.41-2.69 5.39-5.25 5.67.42.36.8 1.07.8 2.16v3.2c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z" />
    </svg>
  );
}
function JiraGlyph({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
      <defs>
        <linearGradient id="jira-a" x1="15.6" y1="6.7" x2="9.4" y2="13" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0052cc" />
          <stop offset="1" stopColor="#2684ff" />
        </linearGradient>
        <linearGradient id="jira-b" x1="16.5" y1="25.4" x2="22.6" y2="19.2" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0052cc" />
          <stop offset="1" stopColor="#2684ff" />
        </linearGradient>
      </defs>
      <path
        fill="#2684ff"
        d="M30.7 15.4 16.8 1.4 15.4 0 4.9 10.6 0.1 15.4a0.9 0.9 0 0 0 0 1.3L9.7 26.3 15.4 32 25.9 21.5l0.2-0.2 4.6-4.6a0.9 0.9 0 0 0 0-1.3zM15.4 20.7l-4.8-4.8 4.8-4.8 4.8 4.8z"
      />
      <path fill="url(#jira-a)" d="M15.4 11.1a8.1 8.1 0 0 1 0-11.4L4.9 10.6l5.7 5.7z" />
      <path fill="url(#jira-b)" d="M20.2 15.9 15.4 20.7a8.1 8.1 0 0 1 0 11.4l10.5-10.5z" />
    </svg>
  );
}
function ZoomGlyph({ className = "size-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect width="24" height="24" rx="6" fill="#2d8cff" />
      <path fill="#fff" d="M6 9.6A1.6 1.6 0 0 1 7.6 8h5A1.6 1.6 0 0 1 14.2 9.6v4.8A1.6 1.6 0 0 1 12.6 16h-5A1.6 1.6 0 0 1 6 14.4V9.6zM15.2 10.6l2.5-1.7c.4-.3 1 0 1 .5v5.2c0 .5-.6.8-1 .5l-2.5-1.7v-2.8z" />
    </svg>
  );
}

const LOGOS = [
  { name: "Slack", glyph: <SlackGlyph /> },
  { name: "GitHub", glyph: <GitHubGlyph /> },
  { name: "Jira", glyph: <JiraGlyph /> },
  { name: "Google", glyph: <GoogleIcon className="size-7" /> },
  { name: "Microsoft", glyph: <MicrosoftIcon className="size-7" /> },
  { name: "Zoom", glyph: <ZoomGlyph /> },
];
const HUB_POS = [
  { x: 13, y: 20 }, { x: 13, y: 50 }, { x: 13, y: 80 },
  { x: 87, y: 20 }, { x: 87, y: 50 }, { x: 87, y: 80 },
];
const HUB_PATHS = [
  "M50 50 C 36 50, 27 20, 13 20",
  "M50 50 L 13 50",
  "M50 50 C 36 50, 27 80, 13 80",
  "M50 50 C 64 50, 73 20, 87 20",
  "M50 50 L 87 50",
  "M50 50 C 64 50, 73 80, 87 80",
];

function IntegrationsHub() {
  return (
    <div className="relative mx-auto hidden h-[360px] w-full max-w-3xl md:block">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" fill="none">
        {HUB_PATHS.map((d, i) => (
          <g key={i}>
            <path d={d} stroke="rgb(255 255 255 / 0.12)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            <path
              d={d}
              stroke="var(--m-accent)"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
              strokeDasharray="1.5 7"
              style={{ animation: "m-flow 1s linear infinite", animationDelay: `${i * 130}ms`, opacity: 0.8 }}
            />
          </g>
        ))}
      </svg>

      {/* central hub */}
      <div
        className="absolute top-1/2 left-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl"
        style={{
          background: "linear-gradient(160deg, color-mix(in srgb, var(--m-accent) 70%, #000), color-mix(in srgb, var(--m-accent) 92%, #000))",
          border: "1px solid color-mix(in srgb, var(--m-accent) 55%, transparent)",
          boxShadow: "0 0 50px -6px color-mix(in srgb, var(--m-accent) 75%, transparent)",
        }}
      >
        <Code2 className="size-7 text-white" />
      </div>

      {/* logo tiles */}
      {LOGOS.map((l, i) => (
        <div
          key={l.name}
          className="absolute flex size-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl transition-transform duration-300 hover:scale-105"
          style={{
            left: `${HUB_POS[i].x}%`,
            top: `${HUB_POS[i].y}%`,
            background: "rgb(255 255 255 / 0.05)",
            border: "1px solid rgb(255 255 255 / 0.1)",
            boxShadow: "inset 0 1px 0 rgb(255 255 255 / 0.06)",
          }}
        >
          {l.glyph}
        </div>
      ))}
    </div>
  );
}

