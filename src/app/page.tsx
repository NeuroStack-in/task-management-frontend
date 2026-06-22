import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Bot,
  Camera,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  { icon: Clock, title: "Time Tracking", desc: "Global timer, timesheets, and auto-submission." },
  { icon: Activity, title: "Activity Monitoring", desc: "Active vs. inactive analysis and heatmaps." },
  { icon: Camera, title: "Screenshots", desc: "Timeline gallery with productivity scoring." },
  { icon: BarChart3, title: "Productivity Analytics", desc: "Trends, comparisons, and exportable reports." },
  { icon: Bot, title: "AI Insights", desc: "Summaries, recommendations, and anomaly detection." },
  { icon: ShieldCheck, title: "Security & RBAC", desc: "Granular roles, MFA, and audit trails." },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center justify-between px-6 lg:px-10">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Activity className="size-5" />
          </div>
          <span className="text-base font-semibold tracking-tight">WorkPulse</span>
        </div>
        <Button render={<Link href="/login" />} nativeButton={false}>
          Sign in
        </Button>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-6 py-20 text-center lg:py-28">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            Workforce productivity, reimagined
          </div>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Track time, manage work, and unlock productivity with AI
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            One platform for time tracking, task management, activity monitoring,
            and AI-powered insights — built for modern teams.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button
              render={<Link href="/login" />}
              nativeButton={false}
              size="lg"
            >
              Get started <ArrowRight className="size-4" />
            </Button>
            <Button
              render={<Link href="/login" />}
              nativeButton={false}
              size="lg"
              variant="outline"
            >
              View demo
            </Button>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-xl border bg-card p-6 transition-shadow hover:shadow-sm"
              >
                <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="size-5" />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t px-6 py-6 text-center text-sm text-muted-foreground">
        WorkPulse — Frontend demo · mock data.
      </footer>
    </div>
  );
}
