"use client";

import Link from "next/link";
import { Download, Laptop, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTrackingMode } from "@/hooks/use-features";
import { useAgentRelease } from "@/hooks/use-agent-release";
import { timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useMyDevices } from "../use-my-devices";
import {
  describeConnection,
  isOlderVersion,
  primaryDevice,
  type DeviceTone,
} from "../lib/device-status";

const DOT: Record<DeviceTone, string> = {
  ok: "bg-success",
  idle: "bg-warning",
  offline: "bg-muted-foreground/50",
  pending: "bg-muted-foreground/50",
};

/**
 * "Is my device connected?" — the employee's own answer, on their dashboard (UX audit 2026-10-16,
 * EMP-09). Nothing told an employee whether their computer was reporting, so days before they
 * installed anything simply turned red "Absent" with no explanation.
 *
 * Reads `GET /v1/me/devices` (self-scoped). When that is **unknown** — a server without the route,
 * or a failed read — the card renders nothing: it never guesses "not installed".
 */
export function DeviceStatusCard() {
  const { devices } = useMyDevices(60_000);
  const mode = useTrackingMode();
  const { version: latest } = useAgentRelease();
  if (!devices) return null;

  // The kind of device that does this org's tracking: IT's managed service in `machine` mode, the
  // desktop app otherwise (in `both`, the app is what runs the project timer).
  const managedOrg = mode === "machine";
  const device = primaryDevice(devices, managedOrg ? "managed" : "interactive");
  const others = devices.filter((d) => d !== device && (!d.state || d.state === "active")).length;

  if (!device) {
    return (
      <div className="bg-feature-tint/50 flex flex-col gap-3 rounded-[1.4rem] border px-5 py-4 sm:flex-row sm:items-center">
        <span className="bg-card text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
          <MonitorSmartphone className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {managedOrg
              ? "No work computer is linked to you yet"
              : "The desktop app isn't set up on your computer yet"}
          </p>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {managedOrg
              ? "Your time is recorded by the WorkPulse service your IT team installs on your work computer. Until one is linked to you, working days show as Absent — ask IT if you expected one."
              : "Your hours, attendance and activity count from what the app reports. Until it's running, working days show as Absent."}
          </p>
        </div>
        {managedOrg ? null : (
          <Button
            render={<Link href="/download" />}
            nativeButton={false}
            size="sm"
            className="shrink-0 gap-1.5 self-start sm:self-center"
          >
            <Download className="size-4" /> Get the desktop app
          </Button>
        )}
      </div>
    );
  }

  const conn = describeConnection(device, timeAgo);
  const behind = !managedOrg && isOlderVersion(device.agent_version, latest);
  const name = device.hostname || (managedOrg ? "Your work computer" : "Your computer");

  return (
    <div className="flex items-center gap-3 rounded-[1.4rem] border bg-card px-5 py-3">
      <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-xl">
        <Laptop className="size-4.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          <span className="truncate font-medium">{name}</span>
          <span className="text-muted-foreground inline-flex items-center gap-1.5">
            <span aria-hidden className={cn("size-2 rounded-full", DOT[conn.tone])} />
            {conn.label}
          </span>
        </p>
        <p className="text-muted-foreground mt-0.5 truncate text-xs">
          {managedOrg ? "WorkPulse service" : "WorkPulse desktop app"}
          {device.agent_version ? ` · v${device.agent_version}` : ""}
          {behind && latest ? ` · ${latest} available` : ""}
          {others > 0 ? ` · ${others} more ${others === 1 ? "device" : "devices"}` : ""}
          {conn.tone === "offline" && !managedOrg ? " · open the app to resume tracking" : ""}
        </p>
      </div>
    </div>
  );
}
