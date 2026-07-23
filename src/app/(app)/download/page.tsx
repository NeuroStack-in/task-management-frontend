"use client";

import {
  Activity,
  Clock,
  Download,
  MonitorSmartphone,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AGENT_PLATFORMS,
  LATEST_AGENT_VERSION,
  type AgentPlatform,
} from "@/lib/mock-agents";
import { cn } from "@/lib/utils";

const STEPS = [
  "Download the installer for your OS.",
  "Run it and open the WorkPulse agent.",
  "Sign in with your WorkPulse account.",
  "Grant the monitoring consent.",
  "Start your timer — tracking begins.",
];

const FEATURES = [
  {
    icon: Clock,
    title: "Automatic capture",
    desc: "Logs time against your projects while your timer runs — no manual entry.",
  },
  {
    icon: Activity,
    title: "Activity insights",
    desc: "Categorises apps and sites on-device to surface real productivity.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy-first",
    desc: "Consent-gated and timer-bound — nothing is recorded off the clock.",
  },
];

export default function DownloadPage() {
  function downloadFor(p: AgentPlatform) {
    // Real download once the installer URL is set (see WINDOWS_INSTALLER_URL in
    // lib/mock-agents). Until then, tell the user it's on the way rather than
    // navigating to a dead link.
    if (p.url) {
      const a = document.createElement("a");
      a.href = p.url;
      a.download = p.file;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success(`Downloading ${p.file}…`);
    } else {
      toast(`The ${p.os} installer will be available to download shortly.`);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col gap-4 pt-1">
      <PageHeader
        title="Download the WorkPulse agent"
        description="Install it on your device and sign in with your account to start time tracking."
      />

      {/* Hero */}
      <section className="flex items-center gap-4 rounded-2xl border bg-feature-tint/40 p-5">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-background/70 text-primary shadow-soft">
          <MonitorSmartphone className="size-7" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            Automatic, accurate time tracking
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            The agent tracks time against your projects and keeps your timesheet
            in sync — no manual entry.
          </p>
        </div>
        <Badge className="ml-auto hidden shrink-0 self-start bg-background/70 font-normal text-muted-foreground sm:inline-flex">
          v{LATEST_AGENT_VERSION}
        </Badge>
      </section>

      {/* Platforms */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Choose your platform</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {AGENT_PLATFORMS.map((p) => {
            const disabled = !p.available;
            return (
              <div
                key={p.os}
                className={cn(
                  "flex flex-col rounded-2xl border p-4 transition-colors",
                  disabled ? "bg-muted/20" : "hover:border-primary/40",
                )}
              >
                <div className="flex items-start justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-feature-tint text-primary">
                    <MonitorSmartphone className="size-5" />
                  </span>
                  {disabled && (
                    <Badge className="bg-muted font-normal text-muted-foreground">
                      Coming soon
                    </Badge>
                  )}
                </div>
                <div className="mt-3">
                  <p className="text-sm font-medium">{p.os}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.label}
                    {p.available ? ` · ${p.size}` : ""}
                  </p>
                </div>
                <div className="mt-4">
                  {p.available ? (
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => downloadFor(p)}
                    >
                      <Download className="size-4" /> Download
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled
                    >
                      Coming soon
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Bottom row fills the remaining height: features + setup steps */}
      <div className="grid flex-1 gap-4 lg:grid-cols-[1fr_360px] lg:grid-rows-1">
        {/* What the agent does */}
        <section className="flex min-h-0 flex-col justify-center rounded-2xl border bg-card/40 p-6">
          <h2 className="text-sm font-semibold">What the agent does</h2>
          <div className="mt-5 grid gap-6 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex flex-col gap-2.5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-feature-tint text-primary">
                  <f.icon className="size-5" />
                </span>
                <p className="text-sm font-semibold">{f.title}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How to get set up */}
        <aside className="flex min-h-0 flex-col justify-center rounded-2xl border p-6">
          <h2 className="text-sm font-semibold">How to get set up</h2>
          <ol className="mt-5 space-y-4">
            {STEPS.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-5 border-t pt-4 text-xs text-muted-foreground">
            Use the same email and password you use to sign in here — no separate
            setup needed.
          </p>
        </aside>
      </div>
    </div>
  );
}
