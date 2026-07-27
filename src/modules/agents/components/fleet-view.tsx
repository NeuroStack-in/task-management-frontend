"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Cpu,
  MonitorSmartphone,
  Search,
  Wifi,
  WifiOff,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

const CONN_META: Record<string, { label: string; badge: string; dot: string }> = {
  online: { label: "Online", badge: "bg-success/12 text-success", dot: "bg-success" },
  idle: { label: "Idle", badge: "bg-warning/15 text-warning", dot: "bg-warning" },
  offline: { label: "Offline", badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/40" },
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

/** Numeric dotted-version compare ("0.1.0" < "1.0.0"). Non-numeric parts compare as 0. */
function cmpVersion(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * The newest agent version present in the fleet — the honest "latest": derived from what is
 * actually enrolled, not a hardcoded constant that would rot the moment a release ships. Devices
 * behind it are flagged; when every device matches, nothing is flagged.
 */
function latestVersion(devices: ApiDevice[]): string | null {
  let max: string | null = null;
  for (const d of devices) {
    if (d.agent_version && (max === null || cmpVersion(d.agent_version, max) > 0)) {
      max = d.agent_version;
    }
  }
  return max;
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

function DeviceRow({
  d,
  behind,
  onOpen,
}: {
  d: ApiDevice;
  behind: boolean;
  onOpen: () => void;
}) {
  const meta = connMeta(d.connectivity);
  return (
    <TableRow
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
            <p className="truncate font-medium">{d.hostname || d.agent_id}</p>
            <p className="truncate text-xs text-muted-foreground">
              {d.os} {d.os_version} · agent {d.agent_version}
              {behind && (
                <span className="ml-1.5 inline-flex items-center gap-1 text-warning">
                  <AlertTriangle className="size-3" /> behind latest
                </span>
              )}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge className={cn("font-medium", meta.badge)}>
          <span className={cn("mr-1.5 size-1.5 rounded-full", meta.dot)} />
          {meta.label}
        </Badge>
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

export function FleetView() {
  const { fleet, loading, error, reload } = useFleet();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [osFilter, setOsFilter] = useState("all");

  const devices = useMemo(() => fleet?.devices ?? [], [fleet]);
  const latest = useMemo(() => latestVersion(devices), [devices]);
  const isBehind = (d: ApiDevice) =>
    latest !== null && d.agent_version !== "" && cmpVersion(d.agent_version, latest) < 0;
  const outdated = devices.filter(isBehind).length;

  // Distinct OS names, for the filter — derived from the fleet, never a hardcoded list.
  const osOptions = useMemo(
    () => [...new Set(devices.map((d) => d.os).filter(Boolean))].sort(),
    [devices],
  );

  const visible = devices.filter((d) => {
    if (statusFilter !== "all" && d.connectivity !== statusFilter) return false;
    if (osFilter !== "all" && d.os !== osFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [d.hostname, d.agent_id, d.os, d.os_version, d.ip, d.agent_version]
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
        <PageHeader title="Device agents" description="Machines running the WorkPulse desktop agent." />
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const f = fleet!;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Device agents"
        description="Machines running the WorkPulse desktop agent, with live connectivity."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Devices" value={f.total} icon={MonitorSmartphone} hint="enrolled" featured />
        <StatCard label="Online" value={f.online} icon={Wifi} hint="heartbeat in the last 10 min" />
        <StatCard label="Offline" value={f.offline} icon={WifiOff} hint="no recent heartbeat" />
        <StatCard
          label="Behind latest"
          value={outdated}
          icon={AlertTriangle}
          hint={latest ? `newest enrolled is ${latest}` : "no versions reported"}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {/* Filter bar — pure client-side over the real fleet list. */}
          <div className="flex flex-col gap-2 border-b border-border p-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search device, OS, IP…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as string)}>
              <SelectTrigger className="w-full sm:w-36">
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
              <SelectTrigger className="w-full sm:w-36">
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
          </div>

          {devices.length === 0 ? (
            <EmptyState
              icon={MonitorSmartphone}
              title="No agents enrolled yet"
              description="Install the WorkPulse desktop agent and sign in — enrolled devices appear here with their status and telemetry."
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Device</TableHead>
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
                      behind={isBehind(d)}
                      onOpen={() =>
                        router.push(`/settings/agents/${encodeURIComponent(d.agent_id)}`)
                      }
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
