"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Clock,
  Copy,
  Download,
  Info,
  MonitorSmartphone,
  RefreshCw,
  Share2,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { useTrackingMode } from "@/hooks/use-features";
import { usePermissions } from "@/hooks/use-permissions";
import { useAgentRelease } from "@/hooks/use-agent-release";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AGENT_PLATFORMS, type AgentPlatform } from "@/lib/agent-release";
import { MonitoringDisclosure } from "@/modules/agents/components/monitoring-disclosure";
import { cn } from "@/lib/utils";
import { detectDevice, type DetectedDevice } from "./detect-device";

/*
 * Plain words for a new employee (UX audit 2026-10-16, EMP-10): "the WorkPulse desktop app", not
 * "the agent", and sign-in advice that also fits people who sign in with Google — the desktop app
 * has offered "Continue with Google" since v0.1.19. "Use the same email and password" told a Google
 * user to type a password they don't have.
 */
const SIGN_IN = "Sign in the same way you sign in here — your work email and password, or Continue with Google.";

const STEPS = [
  "Download the installer for your computer.",
  "Run it and open WorkPulse.",
  SIGN_IN,
  "Read what your organization records (above).",
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
    desc: "Categorizes apps and sites on-device to surface real productivity.",
  },
  {
    icon: ShieldCheck,
    // Not "consent-gated": the app records the org's consent, not the employee's (UX audit EMP-01).
    title: "Timer-bound",
    desc: "Nothing is recorded while your timer is off. What's recorded while it runs is listed above.",
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
  SIGN_IN,
  "Still in Privacy & Security, turn WorkPulse ON under Screen & System Audio Recording, and under Accessibility.",
  "Quit WorkPulse completely and open it again — macOS only applies those permissions after a restart.",
  "Pick a project and press Start.",
];

/**
 * Shown instead of a silent list of desktop installers when the page is opened on a phone or tablet
 * (UX audit SET-22) — typically from a link in a chat or an email, read on the way in to work.
 *
 * There is deliberately no "email me the link" button: the server has no route that sends one, and a
 * button that only pretended would be worse than none. The phone's own share sheet (where the
 * browser has one) does the same job, and the address is printed so it can simply be typed.
 */
function OpenOnComputerNotice() {
  const [url, setUrl] = useState("");
  const [canShare, setCanShare] = useState(false);

  // Client-only facts, read after mount so the server render and the first client render agree.
  useEffect(() => {
    setUrl(`${window.location.origin}/download`);
    setCanShare(typeof navigator.share === "function");
  }, []);

  async function share() {
    try {
      await navigator.share({
        title: "Download WorkPulse",
        text: "Open this on your computer to install the WorkPulse desktop app.",
        url,
      });
    } catch {
      // Dismissing the share sheet rejects too — nothing went wrong, so nothing to say.
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied", { description: "Open it on the computer you work on." });
    } catch {
      toast.error(`Couldn't copy the link. On your computer, go to ${url}`);
    }
  }

  return (
    <section
      aria-labelledby="open-on-computer"
      className="flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4"
    >
      <Smartphone className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0">
        <h2 id="open-on-computer" className="text-sm font-semibold">
          Open this page on your computer
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The WorkPulse desktop app runs on Windows, macOS and Linux — there&apos;s no version for
          phones or tablets. On the computer you work on, sign in to WorkPulse and open this page:
        </p>
        {url ? <p className="mt-2 font-mono text-xs break-all">{url}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {canShare ? (
            <Button size="sm" onClick={share} disabled={!url}>
              <Share2 className="size-4" /> Share link
            </Button>
          ) : null}
          <Button size="sm" variant={canShare ? "outline" : "default"} onClick={copy} disabled={!url}>
            <Copy className="size-4" /> Copy link
          </Button>
        </div>
      </div>
    </section>
  );
}

export default function DownloadPage() {
  const [macHelpOpen, setMacHelpOpen] = useState(false);
  const isMachine = useTrackingMode() === "machine";
  const { can } = usePermissions();

  /**
   * The computer (or phone) this browser runs on, so the right installer is highlighted and a phone
   * is told to come back on a computer (UX audit SET-22). Read after mount — `navigator` doesn't
   * exist on the server — and `unknown` until then, which renders the plain three-way choice.
   */
  const [device, setDevice] = useState<DetectedDevice>({ kind: "unknown" });
  useEffect(() => {
    setDevice(detectDevice(navigator));
  }, []);
  const detectedOs = device.kind === "computer" ? device.os : null;
  const onMobile = device.kind === "mobile";

  /**
   * The version actually being served, from the release manifest (`agent/latest/*` is overwritten by
   * every release). `null` until it answers — the badge waits rather than showing a hard-coded
   * number that had gone stale (WP-367).
   */
  const { version } = useAgentRelease();

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
    // Real download once the installer URL is set (see the S3 URLs in lib/agent-release). Until then,
    // tell the user it's on the way rather than navigating to a dead link.
    if (p.url) triggerDownload(p.url, p.file);
    else toast(`The ${p.os} installer will be available to download shortly.`);
  }

  // Machine-mode orgs don't self-install — IT deploys the login-less managed agent to company
  // laptops centrally (there is nothing for an employee to download or sign into). Point there.
  //
  // "Go to Devices" is for those who can open Devices (`agents:view`): it was offered to everyone,
  // so an employee landed on "Access denied" — and as a raw `<a>` to the `/agents` redirect it also
  // forced a full reload (QA audit 2026-10-08, WP-466).
  if (isMachine) {
    const canSeeDevices = can("agents:view");
    return (
      <div className="flex min-h-[calc(100dvh-7rem)] flex-col gap-4 pt-1">
        <PageHeader
          title="WorkPulse on company devices"
          description="In your organization, IT installs WorkPulse on company devices — there's nothing to install here."
        />
        <EmptyState
          icon={MonitorSmartphone}
          title="Managed by IT"
          description={
            canSeeDevices
              ? "Your organization tracks company-owned devices with a background service that IT installs. Enroll a device and it appears under Device agents."
              : "Your organization tracks company-owned devices with a background service that IT installs. If your computer needs it, ask your administrator."
          }
          action={
            canSeeDevices ? (
              <Button render={<Link href="/settings/agents" />} nativeButton={false}>
                Go to Device agents
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-7rem)] flex-col gap-4 pt-1">
      <PageHeader
        title="Download the WorkPulse desktop app"
        description="Install it on your computer and sign in to start tracking your time."
      />

      {onMobile ? <OpenOnComputerNotice /> : null}

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
            The desktop app tracks time against your projects and keeps your
            timesheet in sync — no manual entry.
          </p>
        </div>
        {version ? (
          <Badge className="ml-auto hidden shrink-0 self-start bg-background/70 font-normal text-muted-foreground sm:inline-flex">
            v{version}
          </Badge>
        ) : null}
      </section>

      {/* What is captured, from the org's own settings — before anyone installs (EMP-01). */}
      <MonitoringDisclosure />

      {/* Platforms */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-semibold">Choose your platform</h2>
          {detectedOs ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              This looks like a {detectedOs} computer, so that one is highlighted. Installing
              somewhere else? Pick that computer&apos;s platform instead.
            </p>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {AGENT_PLATFORMS.map((p) => {
            const disabled = !p.available;
            const isDetected = p.os === detectedOs;
            // One filled button where we know the platform; none on a phone, where every one of
            // these is for later, on a computer (SET-22).
            const quiet = onMobile || (detectedOs !== null && !isDetected);
            return (
              <div
                key={p.os}
                className={cn(
                  "flex flex-col rounded-2xl border p-4 transition-colors",
                  disabled ? "bg-muted/20" : "hover:border-primary/40",
                  isDetected && !disabled && "border-primary/60 bg-feature-tint/30 ring-1 ring-primary/30",
                )}
              >
                <div className="flex items-start justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-feature-tint text-primary">
                    <MonitorSmartphone className="size-5" />
                  </span>
                  {disabled ? (
                    <Badge className="bg-muted font-normal text-muted-foreground">
                      Coming soon
                    </Badge>
                  ) : isDetected ? (
                    <Badge className="bg-primary/10 font-medium text-primary">This computer</Badge>
                  ) : null}
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
                        variant={quiet ? "outline" : "default"}
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
          <h2 className="text-sm font-semibold">What the app does</h2>
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
            There&apos;s no separate account to create — the desktop app uses your
            WorkPulse sign-in.
          </p>
        </aside>
      </div>

      {/* Re-install notice, for the first builds only. The sign-in fix (desktop v0.1.1) is compiled
          into the binary, and builds before v0.1.2 had an updater pointed at a private repo that
          404s, so neither could deliver itself — anyone still on one of those has to download once,
          and this page is the only place they'd find that out. Everything from v0.1.2 updates itself.
          It used to say "Version {current} fixes the … error", which claimed every new release was
          that one fix (QA audit 2026-10-08, WP-367).

          It used to sit at the top of the page as a warning, read first by every new employee who
          had never installed anything (UX audit 2026-10-16, EMP-10). It is folded here, below the
          downloads and setup steps, for the few who need it. Delete it once those builds have aged
          out of the fleet. */}
      <details className="group rounded-2xl border p-4 text-sm">
        <summary className="flex cursor-pointer list-none items-center gap-2 font-medium">
          <RefreshCw className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          Installed WorkPulse before version 0.1.2?
          <span className="ml-auto text-xs font-normal text-muted-foreground group-open:hidden">
            Show
          </span>
          <span className="ml-auto hidden text-xs font-normal text-muted-foreground group-open:inline">
            Hide
          </span>
        </summary>
        <div className="mt-2 space-y-1.5 pl-6 leading-relaxed text-muted-foreground">
          <p>
            Please download it once more. Those early builds can show{" "}
            <span className="font-medium text-foreground">
              &ldquo;This agent isn&apos;t configured for your organization yet&rdquo;
            </span>{" "}
            at sign-in, and they can&apos;t update themselves. Run the new installer over your
            existing copy — there&apos;s no need to uninstall first, nothing is lost, and your device
            keeps its history.
          </p>
          <p>
            <span className="font-medium text-foreground">
              It&apos;s the last time you&apos;ll download it by hand.
            </span>{" "}
            From version 0.1.2 on, the app updates itself in the background — unless your
            organization has switched automatic updates off.
          </p>
        </div>
      </details>


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
