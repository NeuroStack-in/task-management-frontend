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
import { UserAvatar } from "@/components/shared/user-avatar";
import { Loader } from "@/components/shared/loader";
import { ApiError } from "@/lib/api";
import {
  getEmployeeProfile,
  type ApiEmployeeProfile,
} from "@/modules/employees/services/employees.service";
import { usePermissions } from "@/hooks/use-permissions";
import { getDevice, type ApiDevice } from "../services/fleet.service";
import { ReleaseDeviceButton } from "./release-device-button";
import { deviceStateLabel, isLiveDevice } from "../lib/device-state";
import { effectiveUserId } from "../lib/presence";
import { connMeta, lastSeen, Info, Meter } from "./fleet-view";
import { REMOVED_PERSON } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * One device, one page — `/settings/agents/[agentId]`, the fleet analogue of the employee
 * profile. Two independent reads:
 *   - the device (`GET /v1/fleet/{id}`) — everything here is the device's own last heartbeat;
 *   - its **owner** (`GET /v1/employees/{id}`) — resolving the raw Cognito sub the heartbeat
 *     carries into the person's actual name/title. Best-effort: a viewer without `employees:view`
 *     never sees a guessed name, and the device page — Release included — still renders.
 */
export function DeviceDetailView({ agentId }: { agentId: string }) {
  const [device, setDevice] = useState<ApiDevice | null>(null);
  /** `retry` is false only for a device that doesn't exist — retrying can't change that. */
  const [error, setError] = useState<{ text: string; retry: boolean } | null>(null);
  const [owner, setOwner] = useState<ApiEmployeeProfile | null>(null);
  /**
   * Why there is no owner to show. Release used to render only inside the owner-resolved branch, so
   * a role without View employees, a removed employee, or one failed lookup left the device with no
   * way to be released (QA audit 2026-10-08, WP-240). Release stands on its own now; this only picks
   * the words beside it.
   */
  const [ownerMiss, setOwnerMiss] = useState<"hidden" | "gone" | "failed" | null>(null);
  const [nonce, setNonce] = useState(0);
  const { can } = usePermissions();

  useEffect(() => {
    let alive = true;
    getDevice(agentId)
      .then((d) => {
        if (!alive) return;
        setDevice(d);
        // A managed device attributes to its assigned employee (MANAGED-AGENT.md §8 Ph2).
        const ownerId = effectiveUserId(d);
        if (ownerId) {
          getEmployeeProfile(ownerId)
            .then((p) => {
              if (!alive) return;
              setOwner(p);
              setOwnerMiss(null);
            })
            .catch((e) => {
              if (!alive) return;
              setOwner(null);
              // 403: no `employees:view` (the route allows only self-reads without it); 404: the
              // employee's record is gone. Anything else is a failed read worth retrying.
              setOwnerMiss(
                e instanceof ApiError && e.status === 403
                  ? "hidden"
                  : e instanceof ApiError && e.status === 404
                    ? "gone"
                    : "failed",
              );
            });
        }
      })
      .catch((e) => {
        if (!alive) return;
        setError(
          e instanceof ApiError && e.status === 404
            ? { text: "This device isn't enrolled (or was removed).", retry: false }
            : e instanceof ApiError && e.status === 403
              ? { text: "You don't have access to device agents.", retry: false }
              : { text: "Couldn't load this device. Check your connection and try again.", retry: true },
        );
      });
    return () => {
      alive = false;
    };
  }, [agentId, nonce]);

  const reload = () => {
    setError(null);
    setNonce((n) => n + 1);
  };

  if (error) {
    return (
      <div className="space-y-4">
        <BackLink />
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">{error.text}</p>
          {error.retry ? (
            <Button variant="outline" size="sm" onClick={reload}>
              Retry
            </Button>
          ) : null}
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
          {/* Banner variant: the card colours are unreadable on `bg-feature` (see CONN_META). */}
          <Badge className={cn("font-medium", meta.onBadge)}>
            <span className={cn("mr-1.5 size-1.5 rounded-full", meta.onDot)} />
            {meta.label}
          </Badge>
          {!isLiveDevice(device.state) && (
            <Badge className="bg-destructive/10 font-medium text-destructive">
              {deviceStateLabel(device.state)}
            </Badge>
          )}
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
              <div className="flex flex-wrap items-center justify-between gap-3">
                {owner ? (
                  <div className="flex min-w-0 items-center gap-3">
                    {/* `UserAvatar`, so an uploaded photo shows here as it does elsewhere. The monogram
                        gradient was a nice fallback but it was the ONLY thing this could ever render —
                        `UserAvatar` keeps initials for anyone without a photo. */}
                    <UserAvatar
                      userId={owner.user_id}
                      name={owner.name}
                      className="size-11"
                      fallbackClassName="text-sm font-semibold"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{owner.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[owner.emp_id, owner.title, owner.email].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {!effectiveUserId(device)
                      ? "No signed-in user reported."
                      : ownerMiss === "hidden"
                        ? "Outside your directory"
                        : ownerMiss === "gone"
                          ? REMOVED_PERSON
                          : ownerMiss === "failed"
                            ? "Couldn't load who this device belongs to."
                            : "Loading…"}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  {owner ? (
                    <Button
                      variant="outline"
                      size="sm"
                      render={<Link href={`/employees/${encodeURIComponent(owner.user_id)}`} />}
                      nativeButton={false}
                    >
                      View employee profile
                    </Button>
                  ) : ownerMiss === "failed" ? (
                    <Button variant="outline" size="sm" onClick={reload}>
                      Retry
                    </Button>
                  ) : null}
                  {/* Release — for any live device, whether or not its owner resolved for this viewer. */}
                  {can("agents:manage") && isLiveDevice(device.state) && (
                    <ReleaseDeviceButton
                      deviceId={device.agent_id}
                      employeeName={owner?.name}
                      managed={device.variant === "service"}
                      onReleased={() => setNonce((n) => n + 1)}
                    />
                  )}
                </div>
              </div>
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
                  value={deviceStateLabel(device.state)}
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
