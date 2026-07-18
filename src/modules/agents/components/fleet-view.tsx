"use client";

import { MonitorSmartphone, Wifi, WifiOff, Cpu } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
const connMeta = (c: string) => CONN_META[c] ?? CONN_META.offline;

function lastSeen(ms: number): string {
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

function DeviceRow({ d }: { d: ApiDevice }) {
  const meta = connMeta(d.connectivity);
  return (
    <TableRow>
      <TableCell className="pl-6">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <MonitorSmartphone className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{d.hostname || d.agent_id}</p>
            <p className="truncate text-xs text-muted-foreground">
              {d.os} {d.os_version} · agent {d.agent_version}
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

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Devices" value={f.total} icon={MonitorSmartphone} hint="enrolled" featured />
        <StatCard label="Online" value={f.online} icon={Wifi} hint="heartbeat in the last 10 min" />
        <StatCard label="Offline" value={f.offline} icon={WifiOff} hint="no recent heartbeat" />
      </div>

      <Card>
        <CardContent className="p-0">
          {f.devices.length === 0 ? (
            <EmptyState
              icon={MonitorSmartphone}
              title="No agents enrolled yet"
              description="Install the WorkPulse desktop agent and sign in — enrolled devices appear here with their status and telemetry."
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
                  {f.devices.map((d) => (
                    <DeviceRow key={d.agent_id} d={d} />
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
