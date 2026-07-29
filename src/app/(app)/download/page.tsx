"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Clock,
  Download,
  Info,
  MonitorSmartphone,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AGENT_MANIFEST_URL,
  AGENT_PLATFORMS,
  AGENT_RELEASE_VERSION,
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

/**
 * The macOS first-run steps.
 *
 * They exist because the build is **not signed with an Apple Developer ID**, so Gatekeeper blocks
 * the first launch with a message that reads like a virus warning. Behind an info icon rather than
 * on the card: it is a one-time ritual, and printing eight steps under one of three platforms would
 * unbalance the page for the Windows and Linux majority who don't need any of it.
 */
const MAC_STEPS = [
  "Open the downloaded WorkPulse.dmg and drag WorkPulse into your Applications folder.",
  "Open WorkPulse from Applications. macOS will say it can't verify the app — that's expected, our app isn't registered with Apple yet. Click Done.",
  "Open System Settings → Privacy & Security and scroll to the Security section.",
  "You'll see a line saying WorkPulse was blocked. Click Open Anyway and confirm with your password or Touch ID.",
  "Sign in with the same email and password you use here.",
  "Still in Privacy & Security, turn WorkPulse ON under Screen & System Audio Recording, and under Accessibility.",
  "Quit WorkPulse completely and open it again — macOS only applies those permissions after a restart.",
  "Pick a project and press Start.",
];

export default function DownloadPage() {
  const [macHelpOpen, setMacHelpOpen] = useState(false);

  /**
   * The version actually being served, read from the release manifest rather than a constant.
   *
   * `agent/latest/*` is overwritten by every release, so the files move whether or not anyone
   * remembers to edit the constant — which had already gone stale twice in a day, telling people
   * they were downloading 0.1.3 while the button handed them 0.1.4. The constant remains as the
   * fallback: if the fetch fails, a slightly old number beats an empty space.
   */
  const [version, setVersion] = useState(AGENT_RELEASE_VERSION);

  useEffect(() => {
    let live = true;
    fetch(AGENT_MANIFEST_URL, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((m: { version?: string } | null) => {
        if (live && m?.version) setVersion(m.version);
      })
      .catch(() => {
        // Offline, or the bucket is unreachable — the fallback constant is already displayed.
      });
    return () => {
      live = false;
    };
  }, []);

  function triggerDownload(url: string, file: string) {
    const a = document.createElement("a");
    a.href = url;
    a.download = file;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success(`Downloading ${file}…`);
  }

  function downloadFor(p: AgentPlatform) {
    // Real download once the installer URL is set (see the S3 URLs in lib/mock-agents). Until then,
    // tell the user it's on the way rather than navigating to a dead link.
    if (p.url) triggerDownload(p.url, p.file);
    else toast(`The ${p.os} installer will be available to download shortly.`);
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
          v{version}
        </Badge>
      </section>

      {/* Re-install notice. The sign-in fix is compiled into the binary and the old builds' updater
          pointed at a private repo that 404s, so neither could deliver itself — everyone on an
          earlier build has to download once, and this page is the only place they'd find that out.
          The second paragraph is the point: from this version on, it is self-updating, so this
          notice can be deleted once the old builds have aged out of the fleet. */}
      <section className="flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/5 p-4">
        <RefreshCw className="mt-0.5 size-4 shrink-0 text-warning" />
        <div className="min-w-0 text-sm">
          <p className="font-medium">
            Already have WorkPulse installed? Please download it once more.
          </p>
          <p className="mt-1 leading-relaxed text-muted-foreground">
            Version {version} fixes the{" "}
            <span className="font-medium text-foreground">
              &ldquo;This agent isn&apos;t configured for your organization
              yet&rdquo;
            </span>{" "}
            error at sign-in. Run the new installer over your existing copy —
            there&apos;s no need to uninstall first, nothing is lost, and your
            device keeps its history.
          </p>
          <p className="mt-1.5 leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">
              This is the last time you&apos;ll download it by hand.
            </span>{" "}
            From this version on the agent updates itself in the background — new
            releases arrive automatically, with nothing for you to do.
          </p>
        </div>
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
                    <>
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => downloadFor(p)}
                      >
                        <Download className="size-4" /> Download
                      </Button>
                      {p.altUrl && p.altFile ? (
                        <button
                          type="button"
                          onClick={() => triggerDownload(p.altUrl!, p.altFile!)}
                          className="mt-2 w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
                        >
                          or download {p.altLabel ?? "alternative"}
                          {p.altSize ? ` · ${p.altSize}` : ""}
                        </button>
                      ) : null}
                      {p.os === "macOS" ? (
                        <button
                          type="button"
                          onClick={() => setMacHelpOpen(true)}
                          className="mt-2 flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <Info className="size-3.5" />
                          First-time setup steps
                        </button>
                      ) : null}
                    </>
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

      {/* macOS first-run walkthrough */}
      <Dialog open={macHelpOpen} onOpenChange={setMacHelpOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Installing on macOS</DialogTitle>
            <DialogDescription>
              A one-time setup. macOS blocks the first launch because the app
              isn&apos;t registered with Apple yet — it is safe to open.
            </DialogDescription>
          </DialogHeader>

          <ol className="space-y-3">
            {MAC_STEPS.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-feature-tint text-[0.7rem] font-medium text-primary">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>

          <div className="rounded-xl border bg-muted/30 p-3">
            <p className="text-xs font-medium">
              If &ldquo;Open Anyway&rdquo; doesn&apos;t appear
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Open the Terminal app, paste this line, press Enter, then open
              WorkPulse again:
            </p>
            <code className="mt-2 block overflow-x-auto rounded-lg bg-background px-3 py-2 font-mono text-[0.7rem] break-all">
              xattr -dr com.apple.quarantine /Applications/WorkPulse.app
            </code>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
