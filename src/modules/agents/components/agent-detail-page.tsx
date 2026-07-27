"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AppWindow,
  ArrowLeft,
  Ban,
  Camera,
  Check,
  ChevronRight,
  Cpu,
  Info as InfoIcon,
  Keyboard,
  Laptop,
  MapPin,
  MonitorSmartphone,
  MoreVertical,
  Power,
  RefreshCw,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Timer,
  Trash2,
  Trash as TrashIcon,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { Sparkline } from "@/components/shared/sparkline";
import { usePermissions } from "@/hooks/use-permissions";
import { initials, monogramGradient } from "@/lib/format";
import {
  durationLabel,
  getAgentDetail,
  LATEST_AGENT_VERSION,
  type AgentCapability,
  type AgentDetail,
  type AgentStatus,
  type CapabilityState,
} from "@/lib/mock-agents";
import { cn } from "@/lib/utils";

/**
 * One device, one page — `/settings/agents/[agentId]`. Replaces the old right-hand sheet.
 *
 * Deliberately three cards, in the order an admin actually asks the questions:
 * is it reporting (header) → is the person tracking (activity) → is capture working
 * (capability & policy) → what is this machine (device). Utilization, version and history
 * ride along inside those instead of owning cards of their own.
 *
 * **Mock-backed.** Every value comes from `lib/mock-agents::getAgentDetail`, deterministic per
 * agent id. The wiring pass swaps that one call for `GET /v1/fleet/{agent_id}` (LLD §18) plus
 * the owner lookup; this layout does not change.
 */

const STATUS_META: Record<
  AgentStatus,
  { label: string; badge: string; dot: string; rail: string }
> = {
  online: {
    label: "Online",
    badge: "bg-success/15 text-success",
    dot: "bg-success",
    rail: "bg-success",
  },
  idle: {
    label: "Idle",
    badge: "bg-warning/15 text-warning",
    dot: "bg-warning",
    rail: "bg-warning",
  },
  offline: {
    label: "Offline",
    badge: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/40",
    rail: "bg-muted-foreground/30",
  },
};

const CAPABILITY_ICON = {
  screenshots: Camera,
  input: Keyboard,
  windows: AppWindow,
  location: MapPin,
} as const;

const CAPABILITY_STATE: Record<
  CapabilityState,
  { label: string; className: string; icon: typeof Check }
> = {
  granted: { label: "Granted", className: "bg-success/15 text-success", icon: Check },
  denied: { label: "Denied", className: "bg-destructive/12 text-destructive", icon: Ban },
  unsupported: {
    label: "Unsupported",
    className: "bg-muted text-muted-foreground",
    icon: InfoIcon,
  },
};

export function AgentDetailPage({ agentId }: { agentId: string }) {
  const router = useRouter();
  const { can } = usePermissions();
  const canManage = can("agents:manage");

  // Deterministic per id, so this initializer is SSR-safe and stable across re-renders.
  const [device, setDevice] = useState<AgentDetail | null>(() => getAgentDetail(agentId));
  const [removeOpen, setRemoveOpen] = useState(false);

  if (!device) return <NotEnrolled />;

  const status = STATUS_META[device.status];
  const offline = device.status === "offline";
  const outdated = device.version !== LATEST_AGENT_VERSION;

  function restart() {
    toast.success("Restart signal queued", {
      description: `${device!.hostname} restarts its agent on the next check-in.`,
    });
  }

  function update() {
    setDevice((d) => (d ? { ...d, version: LATEST_AGENT_VERSION } : d));
    toast.success(`Updating to v${LATEST_AGENT_VERSION}`, {
      description: "The agent verifies the signature before installing.",
    });
  }

  function remove() {
    setRemoveOpen(false);
    toast.success(`Removed ${device!.hostname}`, {
      description: "History is kept — the device stops reporting.",
    });
    router.push("/settings/agents");
  }

  return (
    <div className="space-y-4 pt-1">
      {/* ── Top bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/settings/agents"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> All devices
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <nav
            aria-label="Breadcrumb"
            className="mr-1 hidden items-center gap-1.5 text-sm text-muted-foreground lg:flex"
          >
            <Link
              href="/settings/agents"
              className="transition-colors hover:text-foreground"
            >
              Device agents
            </Link>
            <ChevronRight className="size-3.5 opacity-50" />
            <span className="font-medium text-foreground">{device.hostname}</span>
          </nav>
          {canManage ? (
            <>
              {outdated ? (
                <Button variant="outline" size="sm" onClick={update}>
                  <RefreshCw className="size-4" /> Update to v{LATEST_AGENT_VERSION}
                </Button>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
                  <MoreVertical className="size-4" /> Manage
                </DropdownMenuTrigger>
                {/* The primitive sizes a menu to its trigger (`w-(--anchor-width)`), which is
                    too narrow for these labels — size to content instead, with a floor. */}
                <DropdownMenuContent align="end" className="w-auto min-w-44">
                  <DropdownMenuItem
                    className="whitespace-nowrap px-2 py-1.5"
                    onClick={restart}
                    disabled={offline}
                  >
                    <Power className="size-4" /> Restart agent
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="whitespace-nowrap px-2 py-1.5"
                    disabled={!outdated}
                    onClick={update}
                  >
                    <RefreshCw className="size-4" /> Update now
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    variant="destructive"
                    className="whitespace-nowrap px-2 py-1.5"
                    onClick={() => setRemoveOpen(true)}
                  >
                    <Trash2 className="size-4" /> Remove device
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null}
        </div>
      </div>

      {/* ── Header: a machine, not a person — neutral card surface with a status-coloured
             rail. The only numbers here are the ones you always want. ── */}
      <section className="relative overflow-hidden rounded-lg border bg-card">
        <span
          aria-hidden
          className={cn("absolute inset-y-0 left-0 w-[3px]", status.rail)}
        />

        <div className="relative space-y-5 p-5 pl-6 sm:p-6 sm:pl-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground ring-1 ring-inset ring-border">
                <Laptop className="size-6" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate font-display text-2xl font-semibold tracking-tight">
                    {device.hostname}
                  </h1>
                  <Badge className={cn("font-medium", status.badge)}>
                    <span className={cn("mr-1 size-1.5 rounded-full", status.dot)} />
                    {status.label}
                  </Badge>
                  {outdated ? (
                    <Badge className="bg-warning/15 font-normal text-warning">
                      v{device.version} · update available
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {device.deviceModel} · {device.os} {device.osVersion} · agent v
                  {device.version}
                </p>
              </div>
            </div>

            {/* Owner — whose sign-in this agent reports as. */}
            <div className="flex items-center gap-3">
              <Avatar className="size-9">
                <AvatarFallback
                  className="text-xs font-semibold text-white"
                  style={{ background: monogramGradient(device.user) }}
                >
                  {initials(device.user)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{device.user}</p>
                <p className="truncate text-xs text-muted-foreground">{device.email}</p>
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-4 sm:grid-cols-4">
            <Fact label="Last seen" value={device.lastSeen} sub={`uptime ${device.uptime}`} />
            <Fact
              label="Tracked today"
              value={durationLabel(device.trackedMins)}
              sub={`${durationLabel(device.idleMins)} idle`}
            />
            <Fact
              label="Utilization"
              value={`${offline ? 0 : device.cpu}% · ${offline ? 0 : device.memory}%`}
              sub="cpu · memory"
            >
              {offline ? null : (
                <Sparkline
                  data={device.cpuSeries}
                  area
                  width={72}
                  height={26}
                  className="text-primary"
                />
              )}
            </Fact>
            <Fact label="IP address" value={device.ip} sub={device.location} mono />
          </dl>
        </div>
      </section>

      {/* One strip, only when something is actually wrong. */}
      {!device.consent ? (
        <Strip
          icon={ShieldAlert}
          title="Monitoring consent not granted"
          body={`Nothing is captured on this device until ${device.user} acknowledges what the agent collects. Heartbeats still arrive, so it shows as online.`}
        />
      ) : offline ? (
        <Strip
          icon={WifiOff}
          tone="muted"
          title="Not reporting"
          body={`Last heartbeat ${device.lastSeen.toLowerCase()}. ${device.outboxMb} MB is queued locally and replays in order when the device reconnects.`}
        />
      ) : null}

      {/* Activity spans the width — its table needs the room, and a side-by-side column would
          only stretch to the taller neighbour and leave dead space inside the card. The two
          reference cards sit below at their natural height (`items-start`, never stretched). */}
      <ActivityCard device={device} />
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <CaptureCard device={device} />
        <DeviceCard device={device} />
      </div>

      {/* ── Remove confirmation ── */}
      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove {device.hostname}?</DialogTitle>
            <DialogDescription>
              The device stops reporting and leaves the fleet. Time entries, attendance and
              screenshots already collected are kept. Reinstalling enrols it as a new device.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={remove}
            >
              <TrashIcon className="size-4" /> Remove device
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ───────────────────────────── Cards ───────────────────────────── */

function ActivityCard({ device }: { device: AgentDetail }) {
  const live = device.sessions.find((s) => s.running);
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-feature-tint text-primary">
            <Timer className="size-4" />
          </span>
          Today&apos;s activity
        </CardTitle>
        <CardDescription>
          Capture only runs while a timer runs — a gap means the timer was off.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {live ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm">
            <span className="relative flex size-2.5 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-success" />
            </span>
            <p className="min-w-0 flex-1">
              <span className="font-medium">Timer running</span> — {live.task}
              <span className="text-muted-foreground"> · {live.project}</span>
            </p>
            <span className="font-mono text-xs text-muted-foreground">since {live.from}</span>
          </div>
        ) : (
          <p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            No timer running — nothing is being captured right now.
          </p>
        )}

        {device.sessions.length === 0 ? (
          <EmptyState
            icon={Timer}
            title="No sessions today"
            description="Time is agent-derived and never backfilled, so an untracked day stays empty."
            className="border-dashed"
          />
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full caption-bottom text-sm">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">Task</TableHead>
                  <TableHead className="hidden sm:table-cell">Window</TableHead>
                  <TableHead className="pr-4 text-right">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {device.sessions.map((s) => (
                  <TableRow key={s.id} className="hover:bg-transparent">
                    <TableCell className="py-3 pl-4">
                      <p className="font-medium">{s.task}</p>
                      <p className="text-xs text-muted-foreground">{s.project}</p>
                    </TableCell>
                    <TableCell className="hidden py-3 font-mono text-xs text-muted-foreground sm:table-cell">
                      {s.from} – {s.to}
                    </TableCell>
                    <TableCell className="py-3 pr-4 text-right tabular-nums">
                      {durationLabel(s.minutes)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </table>
          </div>
        )}

      </CardContent>

      {/* Day totals belong to the table above them — a footer strip keeps them anchored
          instead of three big numbers floating across the card's full width. */}
      <CardFooter className="flex-wrap gap-x-7 gap-y-1.5 text-sm">
        <Total label="Tracked" value={durationLabel(device.trackedMins)} />
        <Total label="Idle" value={durationLabel(device.idleMins)} />
        <Total
          label="Screenshots"
          value={String(device.screenshotsToday)}
          note={device.cadenceMins === 0 ? "capture off" : `every ${device.cadenceMins} min`}
        />
      </CardFooter>
    </Card>
  );
}

function Total({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
      {note ? <span className="text-xs text-muted-foreground">· {note}</span> : null}
    </span>
  );
}

/** Capture capability + the policy behind it — one card, because the answer spans both. */
function CaptureCard({ device }: { device: AgentDetail }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-feature-tint text-primary">
            <ShieldCheck className="size-4" />
          </span>
          Capture &amp; policy
        </CardTitle>
        <CardDescription>
          What this OS lets the agent collect, and the org policy it applied.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2.5">
          {device.capabilities.map((c) => (
            <CapabilityRow key={c.key} capability={c} />
          ))}
        </div>

        <div className="border-t pt-3">
          <Row
            label="Screenshot cadence"
            value={device.cadenceMins === 0 ? "Off" : `Every ${device.cadenceMins} min`}
          />
          <Row
            label="Blur · retention"
            value={`${device.blurLevel === 0 ? "None" : `Level ${device.blurLevel}`} · ${device.retentionDays}d`}
          />
          <Row
            label="Consent"
            value={device.consent ? "Granted" : "Not granted"}
            tone={device.consent ? "ok" : "warn"}
          />
          <Link
            href="/settings/monitoring"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary transition-opacity hover:opacity-80"
          >
            <Settings2 className="size-3.5" /> Policy is org-wide — change it in Monitoring
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function CapabilityRow({ capability }: { capability: AgentCapability }) {
  const Icon = CAPABILITY_ICON[capability.key];
  const state = CAPABILITY_STATE[capability.state];
  const StateIcon = state.icon;
  const blocked = capability.state !== "granted";
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{capability.label}</span>
        </span>
        <Badge className={cn("shrink-0 font-normal", state.className)}>
          <StateIcon className="size-3" />
          {state.label}
        </Badge>
      </div>
      {/* The reason only earns space when something is actually blocked. */}
      {blocked ? (
        <p className="mt-1 pl-6 text-xs text-muted-foreground">{capability.note}</p>
      ) : null}
    </div>
  );
}

function DeviceCard({ device }: { device: AgentDetail }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-feature-tint text-primary">
            <Cpu className="size-4" />
          </span>
          Device
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Info label="Processor" value={device.cpuModel} />
          <Info label="Memory" value={`${device.ramGb} GB`} />
          <Info label="Time zone" value={device.timezone} />
          <Info label="Enrolled" value={device.enrolledOn} />
          <Info
            label="Unsent outbox"
            value={`${device.outboxMb} MB`}
            sub={`batch #${device.batchSeq.toLocaleString()}`}
          />
          <Info
            label="Auto-update"
            value={device.autoUpdate ? "On" : "Off"}
            sub={`${device.updateChannel} channel`}
          />
          <div className="col-span-2">
            <Info label="Agent id" value={device.agentUuid} mono />
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

/* ───────────────────────────── Small pieces ───────────────────────────── */

function Fact({
  label,
  value,
  sub,
  mono,
  children,
}: {
  label: string;
  value: string;
  sub?: string;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 flex items-end justify-between gap-2">
        <span className="min-w-0">
          <span
            className={cn(
              "block truncate font-display text-base font-semibold tabular-nums",
              mono && "font-mono text-sm font-medium",
            )}
          >
            {value}
          </span>
          {sub ? (
            <span className="block truncate text-xs text-muted-foreground">{sub}</span>
          ) : null}
        </span>
        {children}
      </dd>
    </div>
  );
}

function Info({
  label,
  value,
  sub,
  mono,
}: {
  label: string;
  value: string;
  sub?: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={cn("mt-0.5 text-sm font-medium", mono && "break-all font-mono text-xs")}>
        {value}
      </dd>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "warn";
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-medium",
          tone === "warn" && "text-warning",
          tone === "ok" && "text-success",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function Strip({
  icon: Icon,
  title,
  body,
  tone = "warning",
}: {
  icon: typeof ShieldAlert;
  title: string;
  body: string;
  tone?: "warning" | "muted";
}) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border px-4 py-3 text-sm",
        tone === "warning" ? "border-warning/30 bg-warning/10" : "border-border bg-muted/40",
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          tone === "warning" ? "text-warning" : "text-muted-foreground",
        )}
      />
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function NotEnrolled() {
  return (
    <div className="space-y-4 pt-1">
      <Link
        href="/settings/agents"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All devices
      </Link>
      <EmptyState
        icon={MonitorSmartphone}
        title="Device not found"
        description="This device isn't enrolled, or it was removed from the fleet."
        action={
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/settings/agents" />}
            nativeButton={false}
          >
            Back to device agents
          </Button>
        }
      />
    </div>
  );
}
