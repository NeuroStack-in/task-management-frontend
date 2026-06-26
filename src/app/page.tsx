import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  Camera,
  CheckCircle2,
  Clock,
  ShieldCheck,
} from "lucide-react";
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
  return (
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
            ))}
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
