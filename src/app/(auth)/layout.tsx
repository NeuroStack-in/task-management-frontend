/**
 * Passthrough — each auth page owns its own layout. The bespoke login/signup
 * fill the viewport; the secondary pages (forgot/mfa/reset) use <AuthShell>.
 */
import Link from "next/link";
import { Activity, Clock, ShieldCheck, Sparkles } from "lucide-react";
import { Sparkline } from "@/components/shared/sparkline";

const PULSE = [38, 52, 46, 63, 58, 72, 66, 81, 74, 88, 80, 94];

const POINTS = [
  {
    icon: Clock,
    title: "Time & activity in one place",
    desc: "Live timer, timesheets, and activity insight without the busywork.",
  },
  {
    icon: Sparkles,
    title: "AI that does the reading",
    desc: "Daily summaries, anomaly flags, and recommendations — surfaced for you.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy-first by design",
    desc: "Granular roles, consent-aware monitoring, and a full audit trail.",
  },
];

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel — the WorkPulse pulse motif on the indigo feature surface */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-feature p-10 text-feature-foreground lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-28 -top-28 size-80 rounded-full bg-white/10 blur-3xl"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 opacity-30">
          <Sparkline
            data={PULSE}
            area
            showDot={false}
            width={760}
            height={240}
            className="w-full text-white"
          />
        </div>

        <Link href="/" className="relative flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-xl bg-white/15">
            <Activity className="size-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">WorkPulse</span>
        </Link>

        <div className="relative space-y-8">
          <div className="space-y-3">
            <h2 className="font-heading text-3xl font-semibold leading-tight">
              The calm control surface for workforce productivity.
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-feature-foreground/80">
              Measure the rhythm of work — time, activity, and AI insight — in
              one quiet, privacy-first workspace.
            </p>
          </div>
          <ul className="space-y-4">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <p.icon className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium">{p.title}</p>
                  <p className="text-sm text-feature-foreground/75">{p.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-feature-foreground/60">
          Phase 1 demo · runs entirely on mock data.
        </p>
      </aside>

      {/* Form panel */}
      <main className="flex flex-col items-center justify-center bg-background p-6">
        <Link
          href="/"
          className="mb-8 flex items-center gap-2 lg:hidden"
          aria-label="WorkPulse home"
        >
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Activity className="size-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">WorkPulse</span>
        </Link>
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
