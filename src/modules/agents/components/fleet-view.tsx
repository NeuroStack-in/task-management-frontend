"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Cpu,
  Download,
  KeyRound,
  MonitorSmartphone,
  Search,
  Wifi,
  WifiOff,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { RefreshButton } from "@/components/shared/refresh-button";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { useDirectory } from "@/hooks/use-directory";
import { useTrackingMode } from "@/hooks/use-features";
import { useAgentRelease, useManagedAgentRelease } from "@/hooks/use-agent-release";
import { usePermissions } from "@/hooks/use-permissions";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { TrackingMode } from "@/lib/tracking-mode";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useFleet } from "../use-fleet";
import type { ApiDevice } from "../services/fleet.service";
import { effectiveUserId, presenceOf } from "../lib/presence";
import { deviceStateLabel, isLiveDevice } from "../lib/device-state";
import { isBehind, latestVersions, targetFor, type LatestVersions } from "../lib/agent-version";

/**
 * Status colours in two flavours, because the same badge appears on two very different surfaces.
 *
 * `badge`/`dot` are tuned for a **card** — tinted background, coloured text. Reused on the device
 * page's saturated `bg-feature` banner they fail: `text-success` green on teal is barely legible,
 * which is the one word on that banner someone actually needs to read.
 *
 * `onBadge`/`onDot` are the banner versions: the glass language the rest of the feature surfaces use
 * (`white/15` + a white inset ring), with the label in `feature-foreground` so contrast comes from
 * the text and the **colour survives in the dot**. Offline's dot goes white/60 — `muted-foreground/40`
 * is invisible on teal.
 */
const CONN_META: Record<
  string,
  { label: string; badge: string; dot: string; onBadge: string; onDot: string }
> = {
  online: {
    label: "Online",
    badge: "bg-success/12 text-success",
    dot: "bg-success",
    onBadge: "bg-white/15 text-feature-foreground ring-1 ring-inset ring-white/25",
    onDot: "bg-success",
  },
  idle: {
    label: "Idle",
    badge: "bg-warning/15 text-warning",
    dot: "bg-warning",
    onBadge: "bg-white/15 text-feature-foreground ring-1 ring-inset ring-white/25",
    onDot: "bg-warning",
  },
  offline: {
    label: "Offline",
    badge: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/40",
    onBadge: "bg-white/10 text-feature-foreground/80 ring-1 ring-inset ring-white/20",
    onDot: "bg-white/60",
  },
};
/** Shared with the device detail page — one source for status colors and time formatting. */
export const connMeta = (c: string) => CONN_META[c] ?? CONN_META.offline;

/** Status filter options — the map is both the option list and the trigger's value→label lookup. */
const STATUS_FILTER_LABELS: Record<string, string> = {
  all: "All statuses",
  online: "Online",
  idle: "Idle",
  offline: "Offline",
};

export function lastSeen(ms: number): string {
  if (!ms) return "never";
  const diff = Date.now() - ms;
  if (diff < 0) return "just now";
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

/** Display label for the device variant. `service` → "Managed service", else "Interactive app". */
function variantLabel(variant?: string): string {
  return variant === "service" ? "Managed service" : "Interactive app";
}

/** A labelled utilization bar (CPU/Memory from the last heartbeat). Shared with the detail page. */
export function Meter({ label, value }: { label: string; value: number }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{v}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", v >= 90 ? "bg-destructive" : "bg-primary")}
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}

export function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    // `min-w-0` so a grid column can actually shrink; `break-all` on mono values so an unbroken
    // UUID (agent id, Cognito sub) wraps inside its cell instead of blowing out the two-column
    // layout — ids should stay fully readable/copyable, so wrap beats truncate here.
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={cn("mt-0.5 text-sm font-medium", mono && "break-all font-mono text-xs")}>
        {value}
      </p>
    </div>
  );
}

/** The device page — `/settings/agents/[agentId]`. */
const deviceHref = (d: ApiDevice) => `/settings/agents/${encodeURIComponent(d.agent_id)}`;

function DeviceRow({
  d,
  behind,
  ownerName,
  onOpen,
}: {
  d: ApiDevice;
  /** The version it should be on when it is behind it, else `null`. */
  behind: string | null;
  /** Resolved from the directory; `null` while it loads or when the id isn't in it. */
  ownerName: string | null;
  onOpen: () => void;
}) {
  const meta = connMeta(d.connectivity);
  return (
    <TableRow
      // The whole row opens the device for a mouse; the device name is the real link, so the row is
      // reachable by Tab and announced as a link (QA audit 2026-10-08, WP-472).
      className="cursor-pointer"
      onClick={onOpen}
      // `presence_live` distinguishes an observed socket state from an inferred one — the tooltip
      // is the only place that difference is worth surfacing; the badge itself stays uncluttered.
      title={
        d.presence_live
          ? "Live connection status (push rail)"
          : "Status inferred from the last check-in"
      }
    >
      <TableCell className="pl-6">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <MonitorSmartphone className="size-4" />
          </span>
          <div className="min-w-0">
            <Link
              href={deviceHref(d)}
              // The row's own click would navigate a second time.
              onClick={(e) => e.stopPropagation()}
              className="block truncate rounded-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {d.hostname || d.agent_id}
            </Link>
            <p className="truncate text-xs text-muted-foreground">
              {d.os} {d.os_version} · agent {d.agent_version}
              {behind && (
                <span className="ml-1.5 inline-flex items-center gap-1 text-warning">
                  <AlertTriangle className="size-3" /> behind v{behind.replace(/^v/i, "")}
                </span>
              )}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {/* Every agent runs under a signed-in account and the heartbeat stamps that user onto the
            device row, so this is the device's owner — not a guess. The two fallbacks are
            deliberately distinct, and both say what is actually true: "outside your directory"
            means the device HAS an owner whose record your scope cannot see (or who was
            deactivated), while "not reported yet" means the agent has never heartbeated, so no
            owner has been stamped at all. */}
        {ownerName ? (
          <div className="flex items-center gap-2">
            {/* `UserAvatar`, not a bare fallback: this rendered initials for everyone, including
                people who had uploaded a photo. The id is already resolved here — the branch below
                uses it — so there was nothing extra to look up. */}
            <UserAvatar
              userId={effectiveUserId(d) ?? ""}
              name={ownerName}
              className="size-7"
              fallbackClassName="text-[10px]"
            />
            <span className="truncate">{ownerName}</span>
          </div>
        ) : effectiveUserId(d) ? (
          // We know exactly who owns this device — the id is right there — so "Unknown user" was a
          // lie about the system rather than a fact about the reader's scope. Name the real reason,
          // and still never print the raw Cognito sub (a UUID tells nobody anything).
          <span className="text-xs text-muted-foreground">Outside your directory</span>
        ) : (
          <span className="text-xs text-muted-foreground">Not reported yet</span>
        )}
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <Badge variant="outline" className="text-[11px] font-normal">
          {variantLabel(d.variant)}
        </Badge>
      </TableCell>
      <TableCell>
        {isLiveDevice(d.state) ? (
          <Badge className={cn("font-medium", meta.badge)}>
            <span className={cn("mr-1.5 size-1.5 rounded-full", meta.dot)} />
            {/* A managed device that slept mid-shift reads "asleep" rather than a bare offline. */}
            {d.variant === "service" && presenceOf(d) === "asleep" ? "Asleep" : meta.label}
          </Badge>
        ) : (
          // Its real state, not "Offline" (UX audit SET-12): a released, revoked or deactivated
          // device will never come back online, and "Offline" read as one that might.
          <Badge
            variant="outline"
            className="font-medium text-muted-foreground"
            title={RETIRED_HINT[d.state] ?? "This device no longer reports."}
          >
            {deviceStateLabel(d.state)}
          </Badge>
        )}
      </TableCell>
      <TableCell className="hidden text-muted-foreground tabular-nums md:table-cell">
        <span className="inline-flex items-center gap-1.5">
          <Cpu className="size-3.5" />
          {Math.round(d.cpu_pct)}% · {Math.round(d.mem_pct)}%
        </span>
      </TableCell>
      <TableCell className="hidden font-mono text-xs text-muted-foreground lg:table-cell">
        {d.ip}
      </TableCell>
      <TableCell className="pr-6 text-right text-xs text-muted-foreground tabular-nums">
        {lastSeen(d.last_heartbeat)}
      </TableCell>
    </TableRow>
  );
}

/** What each retired state means, for the badge's tooltip. */
const RETIRED_HINT: Record<string, string> = {
  released: "IT released this device: its credential is revoked and its employee can get another.",
  revoked: "This device's credential was revoked. It can't report again.",
  deactivated: "Its employee was deactivated, so this device stopped tracking.",
};

/**
 * What to do when nothing is enrolled yet — per tracking mode, because the two agents are installed
 * by different people in different ways. Every mode used to be told to install the desktop app and
 * sign in, which a machine-mode org doesn't use (WP-472).
 */
const EMPTY_FLEET_HINT: Record<TrackingMode, string> = {
  project:
    "Employees install the WorkPulse desktop app from Download agent and sign in — their devices appear here with status and telemetry.",
  machine:
    "Enrol a company computer under Enrol a device: mint a code for its employee and install the WorkPulse agent with it. Enrolled devices appear here with status and telemetry.",
  both:
    "Employees install the WorkPulse desktop app and sign in, or IT enrols a company computer under Enrol a device. Devices appear here with status and telemetry.",
};

export function FleetView() {
  const { fleet, loading, error, reload } = useFleet();
  const router = useRouter();
  const mode = useTrackingMode();
  const { can } = usePermissions();
  /** The published desktop-app release — what "behind" means for the app (SET-11). */
  const { version: release } = useAgentRelease();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [osFilter, setOsFilter] = useState("all");
  /**
   * Released, revoked and deactivated devices are hidden unless asked for (UX audit SET-12). They
   * read "Offline" among the live ones, and nothing can archive them yet — that needs a server
   * route — so a filter is the honest interim.
   */
  const [showRetired, setShowRetired] = useState(false);

  // user_id → display name. The directory is cached process-wide by the hook, so this costs at
  // most one shared fetch; a caller without `employees:view` gets an empty roster and the rows
  // fall back to the id rather than erroring.
  const { employees: directory } = useDirectory();
  const nameById = useMemo(
    () => new Map(directory.map((e) => [e.user_id, e.name])),
    [directory],
  );
  const ownerName = (userId: string) => (userId ? (nameById.get(userId) ?? null) : null);
  // A managed device attributes to its assigned employee, whose id may not be `user_id` at all —
  // so "Attributed to" is always populated (§8 Ph1/Ph3), never an unmapped state.
  const attributedName = (d: ApiDevice) => ownerName(effectiveUserId(d) ?? "");

  const devices = useMemo(() => fleet?.devices ?? [], [fleet]);
  const live = useMemo(() => devices.filter((d) => isLiveDevice(d.state)), [devices]);
  const retiredCount = devices.length - live.length;
  // Per-variant: the .exe and .msi are separate release streams (§8 Ph1), each compared with its own
  // published release — the service's manifest is asked for only when there are service devices.
  const { version: serviceRelease } = useManagedAgentRelease(
    devices.some((d) => d.variant === "service"),
  );
  const latest: LatestVersions = useMemo(
    () => latestVersions(devices, release, serviceRelease),
    [devices, release, serviceRelease],
  );
  const behindOf = (d: ApiDevice) => (isBehind(d, latest) ? targetFor(d, latest) : null);
  const outdated = live.filter((d) => isBehind(d, latest)).length;
  // Counted over live devices only — a retired device is neither online nor waiting to come back.
  const onlineCount = live.filter((d) => d.connectivity !== "offline").length;
  const hasService = live.some((d) => d.variant === "service");
  const hasApp = live.some((d) => d.variant !== "service");

  // Distinct OS names, for the filter — derived from the fleet, never a hardcoded list.
  const osOptions = useMemo(
    () => [...new Set(devices.map((d) => d.os).filter(Boolean))].sort(),
    [devices],
  );

  const visible = (showRetired ? devices : live).filter((d) => {
    if (statusFilter !== "all" && d.connectivity !== statusFilter) return false;
    if (osFilter !== "all" && d.os !== osFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    // The employee name is searchable because it is now a visible column — a field you can read
    // but not search for reads as broken.
    return [
      d.hostname,
      attributedName(d) ?? "",
      d.agent_id,
      d.os,
      d.os_version,
      d.ip,
      d.agent_version,
    ]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  if (loading && !fleet) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader label="Loading device fleet…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Device agents" description="Computers running a WorkPulse agent." />
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // The stat hint says what "behind" was measured against.
  const behindHint =
    live.length === 0
      ? "no versions reported"
      : [
          hasApp && latest.app
            ? latest.appSource === "release"
              ? `app: v${latest.app.replace(/^v/i, "")}, the current release`
              : "app: newest in your fleet"
            : "",
          hasService && latest.service
            ? latest.serviceSource === "release"
              ? `service: v${latest.service.replace(/^v/i, "")}, the current release`
              : "service: newest in your fleet"
            : "",
        ]
          .filter(Boolean)
          .join(" · ") || "no versions reported";

  /** The empty state's actions, per mode — it named them without offering them (SET-12). */
  const emptyActions = (
    <div className="flex flex-wrap justify-center gap-2">
      {mode !== "machine" ? (
        <Button variant="outline" size="sm" render={<Link href="/download" />} nativeButton={false}>
          <Download className="size-4" /> Download agent
        </Button>
      ) : null}
      {mode !== "project" && can("agents:manage") ? (
        <Button size="sm" render={<Link href="/settings/agents/enrollment" />} nativeButton={false}>
          <KeyRound className="size-4" /> Enrol a device
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Device agents"
        description="Computers running a WorkPulse agent, with their connectivity — refreshed every 30 seconds."
        actions={<RefreshButton onRefresh={reload} refreshing={loading} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Devices"
          value={live.length}
          icon={MonitorSmartphone}
          hint={retiredCount ? `active · ${retiredCount} retired not counted` : "enrolled"}
          featured
        />
        <StatCard label="Online" value={onlineCount} icon={Wifi} hint="heartbeat in the last 10 min" />
        <StatCard
          label="Offline"
          value={live.length - onlineCount}
          icon={WifiOff}
          hint="no recent heartbeat"
        />
        <StatCard label="Behind latest" value={outdated} icon={AlertTriangle} hint={behindHint} />
      </div>

      <Card>
        <CardContent className="p-0">
          {/* Filter bar — pure client-side over the real fleet list. */}
          <div className="flex flex-col gap-2 border-b border-border p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search device, employee, OS, IP…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as string)}>
              <SelectTrigger className="w-full sm:w-36" aria-label="Filter by status">
                {/* Base UI renders the raw *value* unless given a render function, so a bare
                    `<SelectValue />` would show "all"/"online" instead of the option's label. */}
                <SelectValue>
                  {(v) => STATUS_FILTER_LABELS[v as string] ?? "All statuses"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_FILTER_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={osFilter} onValueChange={(v) => setOsFilter(v as string)}>
              <SelectTrigger className="w-full sm:w-36" aria-label="Filter by operating system">
                <SelectValue>
                  {(v) => (v === "all" || !v ? "All OS" : String(v))}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All OS</SelectItem>
                {osOptions.map((os) => (
                  <SelectItem key={os} value={os}>
                    {os}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {retiredCount > 0 ? (
              <div className="flex items-center gap-2 sm:pl-2">
                <Switch
                  id="fleet-show-retired"
                  checked={showRetired}
                  onCheckedChange={(v) => setShowRetired(Boolean(v))}
                />
                <Label htmlFor="fleet-show-retired" className="text-sm font-normal whitespace-nowrap">
                  Show retired ({retiredCount})
                </Label>
              </div>
            ) : null}
          </div>

          {devices.length === 0 ? (
            <EmptyState
              icon={MonitorSmartphone}
              title="No agents enrolled yet"
              description={EMPTY_FLEET_HINT[mode]}
              action={emptyActions}
              className="m-4 border-0"
            />
          ) : live.length === 0 && !showRetired ? (
            <EmptyState
              icon={MonitorSmartphone}
              title="No active devices"
              description={`${retiredCount} retired ${retiredCount === 1 ? "device is" : "devices are"} hidden. ${EMPTY_FLEET_HINT[mode]}`}
              action={
                <div className="flex flex-col items-center gap-2">
                  {emptyActions}
                  <Button variant="link" size="sm" onClick={() => setShowRetired(true)}>
                    Show retired devices
                  </Button>
                </div>
              }
              className="m-4 border-0"
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No devices match"
              description="Try a different search or clear the filters."
              className="m-4 border-0"
            />
          ) : (
            // A named, focusable scroll region (axe `scrollable-region-focusable`).
            <div
              className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              role="region"
              aria-label="Devices"
              tabIndex={0}
            >
              <table className="w-full text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Device</TableHead>
                    <TableHead>Attributed to</TableHead>
                    <TableHead className="hidden sm:table-cell">Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">CPU · Mem</TableHead>
                    <TableHead className="hidden lg:table-cell">IP</TableHead>
                    <TableHead className="pr-6 text-right">Last seen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.map((d) => (
                    <DeviceRow
                      key={d.agent_id}
                      d={d}
                      behind={behindOf(d)}
                      ownerName={attributedName(d)}
                      onOpen={() => router.push(deviceHref(d))}
                    />
                  ))}
                </TableBody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
