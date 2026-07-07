"use client";

import { LogIn, LogOut, MapPin, Navigation } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import type { EmployeeLocation, LocationEvent } from "@/lib/mock-locations";
import { cn } from "@/lib/utils";

const OFFLINE_COPY: Record<string, { title: string; description: string }> = {
  "on-leave": {
    title: "On leave",
    description: "No location is captured while an employee is on approved leave.",
  },
  absent: {
    title: "Absent",
    description: "The employee has not clocked in, so no location was recorded.",
  },
  "no-data": {
    title: "No location data",
    description: "No pings were received for this day.",
  },
  "no-gps": {
    title: "No GPS on device",
    description:
      "This employee's device has no built-in GPS, so their location can't be tracked.",
  },
};

function rowMeta(
  ev: LocationEvent,
  online: boolean,
): { title: string; icon: typeof LogIn; tone: string; live: boolean } {
  if (ev.kind === "login")
    return { title: "Logged in", icon: LogIn, tone: "text-success", live: false };
  if (ev.kind === "logout")
    return {
      title: "Logged out",
      icon: LogOut,
      tone: "text-muted-foreground",
      live: false,
    };
  // ping
  return {
    title: online ? "Current location" : "Last seen",
    icon: online ? Navigation : MapPin,
    tone: "text-primary",
    live: online,
  };
}

export function LocationTimeline({
  employee,
}: {
  employee: EmployeeLocation;
}) {
  if (employee.trail.length === 0) {
    const copy = OFFLINE_COPY[employee.offlineReason ?? "no-data"];
    return (
      <EmptyState icon={MapPin} title={copy.title} description={copy.description} />
    );
  }

  return (
    <ol className="relative space-y-5">
      {employee.trail.map((ev, i) => {
        const meta = rowMeta(ev, employee.status === "online");
        const Icon = meta.icon;
        const last = i === employee.trail.length - 1;
        return (
          <li key={ev.id} className="relative flex gap-3">
            {/* Connector */}
            {!last ? (
              <span className="absolute left-[15px] top-8 h-[calc(100%+4px)] w-px bg-border" />
            ) : null}
            <span
              className={cn(
                "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted",
                meta.tone,
              )}
            >
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">{meta.title}</p>
                {meta.live ? (
                  <Badge className="gap-1 border-transparent bg-primary/12 text-primary">
                    <span className="size-1.5 rounded-full bg-primary" /> Live
                  </Badge>
                ) : null}
                <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
                  {ev.time}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {ev.label}, {ev.city}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground/80">
                {ev.point.lat.toFixed(4)}, {ev.point.lng.toFixed(4)} · ±
                {ev.accuracyM} m
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
