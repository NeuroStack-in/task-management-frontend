"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  MonitorSmartphone,
  User as UserIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader } from "@/components/shared/loader";
import { initials, monogramGradient } from "@/lib/format";
import { ApiError } from "@/lib/api";
import {
  getEmployeeProfile,
  type ApiEmployeeProfile,
} from "@/modules/employees/services/employees.service";
import { getDevice, type ApiDevice } from "../services/fleet.service";
import { CaptureNowButton } from "./capture-now-button";
import { connMeta, lastSeen, Info, Meter } from "./fleet-view";
import { cn } from "@/lib/utils";

/**
 * One device, one page — `/settings/agents/[agentId]`, the fleet analogue of the employee
 * profile. Two independent reads:
 *   - the device (`GET /v1/fleet/{id}`) — everything here is the device's own last heartbeat;
 *   - its **owner** (`GET /v1/employees/{user_id}`) — resolving the raw Cognito sub the heartbeat
 *     carries into the person's actual name/title. Best-effort: a viewer without `employees:view`
 *     keeps the id (never a guessed name), and the device page still renders.
 */
export function DeviceDetailView({ agentId }: { agentId: string }) {
  const [device, setDevice] = useState<ApiDevice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [owner, setOwner] = useState<ApiEmployeeProfile | null>(null);

  useEffect(() => {
    let alive = true;
    getDevice(agentId)
      .then((d) => {
        if (!alive) return;
        setDevice(d);
        if (d.user_id) {
          getEmployeeProfile(d.user_id)
            .then((p) => {
              if (alive) setOwner(p);
            })
            .catch(() => {
              /* no employees:view or no User item — the id stays, honestly */
            });
        }
      })
      .catch((e) => {
        if (!alive) return;
        setError(
          e instanceof ApiError && e.status === 404
            ? "This device isn't enrolled (or was removed)."
            : "Couldn't load this device. Try again shortly.",
        );
      });
    return () => {
      alive = false;
    };
  }, [agentId]);

  if (error) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader label="Loading device…" />
      </div>
    );
  }

  const meta = connMeta(device.connectivity);
  const offline = device.connectivity === "offline";

  return (
    <div className="space-y-5">
      <BackLink />

      {/* Hero — device identity, mirrored on the employee-profile pattern. */}
      <section className="flex flex-col gap-4 rounded-2xl bg-feature p-6 text-feature-foreground shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-inset ring-white/20">
            <MonitorSmartphone className="size-7" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-display text-2xl font-semibold leading-tight">
              {device.hostname || device.agent_id}
            </h2>
            <p className="text-sm text-feature-foreground/80">
              {device.os} {device.os_version} · agent {device.agent_version}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge className={cn("font-medium", meta.badge)}>
            <span className={cn("mr-1.5 size-1.5 rounded-full", meta.dot)} />
            {meta.label}
          </Badge>
          {device.state === "deactivated" && (
            <Badge className="bg-destructive/10 font-medium text-destructive">Deactivated</Badge>
          )}
          {device.state !== "deactivated" && <CaptureNowButton agentId={agentId} />}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          {/* Owner — the person whose sign-in this agent reports as. */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserIcon className="size-4" /> Owner
              </CardTitle>
            </CardHeader>
            <CardContent>
              {owner ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="size-11">
                      <AvatarFallback
                        className="text-sm font-semibold text-white"
                        style={{ background: monogramGradient(owner.name) }}
                      >
                        {initials(owner.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{owner.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[owner.emp_id, owner.title, owner.email].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link href={`/employees/${encodeURIComponent(owner.user_id)}`} />}
                    nativeButton={false}
                  >
                    View employee profile
                  </Button>
                </div>
              ) : (
                <p className="font-mono text-xs text-muted-foreground">
                  {device.user_id || "No signed-in user reported."}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Device details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                <Info label="Operating system" value={`${device.os} ${device.os_version}`} />
                <Info label="Agent version" value={device.agent_version || "—"} />
                <Info label="IP address" value={device.ip || "—"} mono />
                <Info label="Agent id" value={device.agent_id} mono />
                <Info
                  label="State"
                  value={device.state === "deactivated" ? "Deactivated" : "Active"}
                />
                <Info label="Last heartbeat" value={lastSeen(device.last_heartbeat)} />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="size-4" /> Telemetry
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                last heartbeat
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Meter label="CPU" value={offline ? 0 : device.cpu_pct} />
            <Meter label="Memory" value={offline ? 0 : device.mem_pct} />
            <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
              <span className="text-muted-foreground">Unsent outbox</span>
              <span className="font-medium tabular-nums">{device.outbox_mb.toFixed(1)} MB</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">User idle at last report</span>
              <span className="font-medium">{device.idle ? "Yes" : "No"}</span>
            </div>
            {offline && (
              <p className="text-xs text-muted-foreground">
                Utilization reads 0 while offline — the last heartbeat is {lastSeen(device.last_heartbeat)}.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/settings/agents"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft className="size-4" /> All devices
    </Link>
  );
}
