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
  Bell,
  Briefcase,
  CalendarCheck,
  Check,
  CheckCheck,
  ChevronDown,
  Clock,
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
    mock: "timer" as const,
    slug: "time-tracking",
  },
  {
    eyebrow: "Activity & productivity",
    icon: Activity,
    title: "See where focus actually goes",
    body: "Active vs. idle time, app & site usage, and a productivity score per person and team — context, not surveillance theatre.",
    bullets: ["Active vs. idle analysis", "App & website usage", "Productivity score"],
    mock: "heatmap" as const,
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
    eyebrow: "Reports & insights",
    icon: BarChart3,
    title: "Decisions backed by data",
    body: "Live dashboards, scheduled exports, and AI anomaly detection surface burnout, overtime, and drift before they become problems.",
    bullets: ["Live dashboards & exports", "Burnout & anomaly alerts", "Role-based insights"],
    mock: "chart" as const,
    slug: "reports",
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

const INTEGRATIONS = [
  "Slack", "Microsoft Teams", "Jira", "GitHub",
  "Google Workspace", "Asana", "Zoom", "Notion",
  "Outlook", "GitLab", "Trello", "Zapier",
];

const ENTERPRISE = [
  { icon: KeyRound, title: "SSO / SAML & SCIM", body: "One-click sign-on and automated user provisioning for your whole org." },
  { icon: Fingerprint, title: "MFA & session policies", body: "Enforce two-factor, session limits, and device-level controls." },
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
          style={{
            background:
              "linear-gradient(180deg, #0a3a38 0%, #0e524b 16%, #147066 34%, #2c8579 50%, #6aa89f 66%, color-mix(in srgb, var(--m-bg) 50%, #c4e2db) 82%, var(--m-bg) 100%)",
          }}
        />
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <span className="absolute rounded-full" style={{ width: "60vw", height: "60vw", left: "-12%", top: "-22%", background: "radial-gradient(circle, rgba(150,206,198,0.55), transparent 62%)", mixBlendMode: "screen", animation: "m-drift-a 28s ease-in-out infinite" }} />
          <span className="absolute rounded-full" style={{ width: "52vw", height: "52vw", right: "-14%", top: "-6%", background: "radial-gradient(circle, rgba(244,176,150,0.42), transparent 62%)", mixBlendMode: "screen", animation: "m-drift-c 34s ease-in-out infinite" }} />
          <span className="absolute rounded-full" style={{ width: "46vw", height: "46vw", left: "32%", top: "4%", background: "radial-gradient(circle, rgba(120,190,180,0.5), transparent 62%)", mixBlendMode: "screen", animation: "m-drift-b 30s ease-in-out infinite" }} />
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
            style={{ background: "rgb(255 255 255 / 0.4)", border: "1px solid rgb(255 255 255 / 0.6)", backdropFilter: "blur(6px)", boxShadow: "0 50px 120px -40px rgb(8 30 28 / 0.6)" }}
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
                      <Link
                        href={productHref(f.slug)}
                        className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium"
                        style={{ color: "var(--m-accent-ink)" }}
                      >
                        Explore {f.eyebrow} <ArrowRight className="size-4" />
                      </Link>
                    </div>
                    <FeatureMock kind={f.mock} />
                  </div>
                </Reveal>
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

      {/* ---------------- Integrations ---------------- */}
      <section id="integrations" className="px-5 py-20 sm:py-28" style={{ background: "var(--m-surface)" }}>
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="text-center text-sm font-medium tracking-wide uppercase" style={{ color: "var(--m-accent-ink)" }}>
              Integrations
            </p>
            <h2 className="m-display mx-auto mt-3 max-w-xl text-center text-3xl font-semibold sm:text-4xl">
              Works with the tools your teams already use.
            </h2>
          </Reveal>
          <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {INTEGRATIONS.map((name, i) => (
              <Reveal key={name} delay={i * 40}>
                <div className="m-card flex items-center gap-3 p-4 transition-transform duration-300 hover:-translate-y-0.5">
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl text-xs font-semibold"
                    style={{ background: "color-mix(in srgb, var(--m-accent) 14%, transparent)", color: "var(--m-accent-ink)" }}
                  >
                    {name.split(" ").map((w) => w[0]).join("").slice(0, 2)}
                  </span>
                  <span className="truncate text-sm font-medium">{name}</span>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <p className="mt-8 text-center text-sm" style={{ color: "var(--m-muted)" }}>
              Plus a REST API and webhooks — bring your own workflow.
            </p>
          </Reveal>
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

const glassCard = {
  background: "rgb(255 255 255 / 0.55)",
  border: "1px solid rgb(255 255 255 / 0.6)",
  backdropFilter: "blur(8px)",
} as const;

function DashboardMock() {
  return (
    <div
      className="grid grid-cols-1 overflow-hidden rounded-2xl text-[11px] sm:grid-cols-[150px_1fr]"
      style={{
        background: "linear-gradient(180deg, rgb(255 255 255 / 0.66), rgb(255 255 255 / 0.5))",
        border: "1px solid rgb(255 255 255 / 0.6)",
        backdropFilter: "blur(16px)",
        color: "var(--m-text)",
      }}
    >
      {/* Sidebar */}
      <aside className="hidden flex-col gap-3 p-3 sm:flex" style={{ background: "rgb(255 255 255 / 0.26)", borderRight: "1px solid rgb(255 255 255 / 0.5)" }}>
        <div className="flex items-center gap-2 px-1">
          <span className="flex size-6 items-center justify-center rounded-lg" style={{ background: "var(--m-accent)" }}>
            <Activity className="size-3.5 text-white" />
          </span>
          <span className="m-display text-[13px] font-semibold">WorkPulse</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg px-2 py-1.5" style={{ background: "rgb(255 255 255 / 0.5)", color: "var(--m-muted)" }}>
          <Search className="size-3" /> <span className="text-[10px]">Search…</span>
          <span className="ml-auto rounded px-1 text-[8px]" style={{ background: "rgb(255 255 255 / 0.7)" }}>⌘K</span>
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
          {MOCK_KPIS.map((k) => {
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
                  <svg viewBox="0 0 55 24" className="h-5 w-14" fill="none" aria-hidden>
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
            <svg viewBox="0 0 320 130" className="mt-2 w-full" fill="none">
              <defs>
                <linearGradient id="mk-active" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--m-accent)" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="var(--m-accent)" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="mk-prod" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5b8def" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#5b8def" stopOpacity="0.05" />
                </linearGradient>
              </defs>
              <path d="M6 42 C 60 34, 110 32, 160 36 S 260 42, 314 32 L314 120 L6 120 Z" fill="url(#mk-active)" />
              <path d="M6 42 C 60 34, 110 32, 160 36 S 260 42, 314 32" stroke="var(--m-accent)" strokeWidth="2" />
              <path d="M6 66 C 60 72, 110 74, 160 66 S 260 56, 314 56 L314 120 L6 120 Z" fill="url(#mk-prod)" />
              <path d="M6 66 C 60 72, 110 74, 160 66 S 260 56, 314 56" stroke="#5b8def" strokeWidth="2" />
              <line x1="150" y1="20" x2="150" y2="120" stroke="var(--m-border-strong)" strokeWidth="1" strokeDasharray="3 3" />
            </svg>
            <div className="mt-1 flex justify-between px-1 text-[8px]" style={{ color: "var(--m-faint)" }}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}
            </div>
          </div>

          {/* Attendance */}
          <div className="rounded-xl p-3.5" style={glassCard}>
            <p className="text-[11px] font-semibold">Attendance</p>
            <div className="mt-1 flex items-center gap-3">
              <div className="relative size-[88px] shrink-0">
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
                  <span className="m-display text-base font-semibold leading-none">83%</span>
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
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {kind === "kanban" ? (
        <div className="grid grid-cols-3 gap-2.5 py-2">
          {(
            [
              { col: "To do", n: 4, tasks: ["Onboard new hires", "Q3 capacity plan"] },
              { col: "In progress", n: 3, tasks: ["Checkout redesign", "Payroll export"] },
              { col: "Done", n: 6, tasks: ["Sprint review", "Client report"] },
            ] as const
          ).map(({ col, n, tasks }) => (
            <div key={col} className="rounded-lg p-2.5" style={{ background: "var(--m-surface-2)" }}>
              <div className="mb-2.5 flex items-center justify-between">
                <p className="text-xs font-medium" style={{ color: "var(--m-text)" }}>{col}</p>
                <span className="rounded-sm px-1.5 text-[0.7rem] font-medium" style={{ background: "var(--m-surface)", color: "var(--m-muted)" }}>{n}</span>
              </div>
              {tasks.map((task) => (
                <div key={task} className="mb-2 rounded-md border p-2.5" style={{ borderColor: "var(--m-border)", background: "var(--m-surface)" }}>
                  <p className="text-xs leading-snug">{task}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="h-1.5 w-10 rounded-full" style={{ background: "color-mix(in srgb, var(--m-accent) 45%, transparent)" }} />
                    <span className="size-4 rounded-full" style={{ background: "var(--m-accent-tint)" }} />
                  </div>
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
    </div>
  );
}

