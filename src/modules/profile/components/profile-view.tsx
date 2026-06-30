"use client";

import { useState } from "react";
import {
  Camera,
  Mail,
  Building2,
  Users as UsersIcon,
  Clock,
  CheckSquare,
  CalendarCheck,
  ImagePlus,
  Hash,
  ShieldCheck,
  Briefcase,
  MapPin,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useCurrentRole, usePermissions } from "@/hooks/use-permissions";
import { initials } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Loader } from "@/components/shared/loader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PhotoEditor } from "@/modules/profile/components/photo-editor";

const STATUS_TONE: Record<string, string> = {
  active: "bg-success/12 text-success",
  inactive: "bg-muted text-muted-foreground",
  invited: "bg-warning/15 text-warning",
  suspended: "bg-destructive/12 text-destructive",
};

export function ProfileView() {
  const user = useAuthStore((s) => s.user);
  const role = useCurrentRole();
  const { can } = usePermissions();

  const [uploadOpen, setUploadOpen] = useState(false);

  if (!user) return <Loader label="Loading profile…" />;

  // Personal-activity metrics (productivity, hours, tasks, attendance) only
  // apply to people who log their own time. Oversight roles (Owner/Admin/
  // managers) manage others and don't generate these, so we hide them.
  const tracksOwnTime = can("time-tracking:edit");

  // Deterministic personal stats from the user id (no randomness in render)
  const seed = [...user.id].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const avgHours = (7 + (seed % 20) / 10).toFixed(1);
  const tasksDone = 40 + (seed % 60);
  const attendance = 88 + (seed % 12);

  const LOCATIONS = [
    "San Francisco, CA",
    "New York, NY",
    "Austin, TX",
    "Seattle, WA",
    "Remote",
  ];
  const WORK_MODES = ["On-site", "Hybrid", "Remote"];
  const location = LOCATIONS[seed % LOCATIONS.length];
  const workMode = WORK_MODES[seed % WORK_MODES.length];
  const employeeId = `EMP-${String(1000 + (seed % 9000))}`;

  // Attendance breakdown (last 30 days) derived from the rate.
  const presentDays = Math.round((attendance / 100) * 30);
  const lateDays = Math.round((30 - presentDays) * 0.6);
  const absentDays = Math.max(0, 30 - presentDays - lateDays);

  // Full-ring gauge geometry for the attendance meter.
  const RING_SIZE = 148;
  const RING_STROKE = 12;
  const ringR = (RING_SIZE - RING_STROKE) / 2;
  const ringCirc = 2 * Math.PI * ringR;
  const ringOffset = ringCirc * (1 - attendance / 100);

  const details = [
    { icon: Mail, label: "Email", value: user.email },
    { icon: Hash, label: "Employee ID", value: employeeId },
    { icon: Building2, label: "Department", value: user.department },
    { icon: UsersIcon, label: "Team", value: user.team },
    { icon: ShieldCheck, label: "Role", value: role?.name ?? "—" },
    { icon: Briefcase, label: "Work mode", value: workMode },
    { icon: MapPin, label: "Location", value: location },
    { icon: CalendarCheck, label: "Member since", value: "Jan 2024" },
  ];

  return (
    <div className="flex flex-col gap-4 lg:max-h-[calc(100vh-6.75rem)] lg:overflow-hidden">
      <PageHeader
        title="Profile"
        description={
          tracksOwnTime
            ? "Your account, role, and personal productivity."
            : "Your account, role, and organization access."
        }
      />

      {/* Identity card */}
      <Card className="shrink-0">
        <CardContent className="flex flex-col items-start gap-5 px-6 sm:flex-row sm:items-center">

          {/* Avatar with upload overlay */}
          <div className="group relative shrink-0">
            <Avatar className="size-20 ring-2 ring-border ring-offset-2 ring-offset-background">
              <AvatarImage src={user.avatarUrl} alt={user.name} />
              <AvatarFallback className="text-xl font-semibold">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>

            <DropdownMenu>
              <DropdownMenuTrigger
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
                aria-label="Edit profile photo"
              >
                <Camera className="size-5 text-white drop-shadow" />
              </DropdownMenuTrigger>

              <DropdownMenuContent side="bottom" align="start" sideOffset={8} className="min-w-44">
                <DropdownMenuItem onClick={() => setUploadOpen(true)}>
                  <ImagePlus className="size-4" />
                  {user.avatarUrl ? "Replace photo" : "Upload photo"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Name / title / badges */}
          <div className="min-w-0 space-y-1.5">
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              {user.name}
            </h2>
            <p className="text-sm text-muted-foreground">{user.jobTitle}</p>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <Badge className="bg-feature-tint text-primary">
                {role?.name ?? "No role"}
              </Badge>
              <Badge className={STATUS_TONE[user.status] ?? "bg-muted"}>
                {user.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {user.department} · {user.team}
              </span>
            </div>
            {!user.avatarUrl && (
              <button
                onClick={() => setUploadOpen(true)}
                className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                <Camera className="size-3" />
                Add profile photo
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Personal stats — only for people who log their own time */}
      {tracksOwnTime ? (
        <div className="grid shrink-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            label="Productivity"
            value={`${user.productivityScore}%`}
            icon={CheckSquare}
            hint="this week"
            trend={[62, 65, 63, 70, 72, 69, user.productivityScore]}
            featured
          />
          <StatCard
            label="Avg. hours / day"
            value={avgHours}
            icon={Clock}
            hint="last 30 days"
          />
          <StatCard
            label="Tasks completed"
            value={tasksDone}
            icon={CheckSquare}
            hint="this quarter"
          />
        </div>
      ) : null}

      {/* Unified detail + attendance panel */}
      <Card className="p-0 lg:min-h-0">
        <div
          className={`grid${tracksOwnTime ? " lg:grid-cols-[1.7fr_1fr]" : ""}`}
        >
          {/* ── Account details ── */}
          <section className="flex min-w-0 flex-col gap-4 p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-base font-medium">
                Account details
              </h3>
              <span className="hidden text-xs text-muted-foreground sm:block">
                {employeeId}
              </span>
            </div>
            <dl className="grid content-start gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {details.map((d) => (
                <div
                  key={d.label}
                  className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-feature-tint text-primary">
                    <d.icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {d.label}
                    </dt>
                    <dd className="truncate text-sm font-medium text-foreground">
                      {d.value}
                    </dd>
                  </div>
                </div>
              ))}
            </dl>
          </section>

          {/* ── Attendance — personal metric, hidden for oversight roles ── */}
          {tracksOwnTime ? (
          <section className="flex flex-col gap-5 border-t bg-muted/30 p-5 sm:p-6 lg:border-l lg:border-t-0">
            <div className="flex items-baseline justify-between">
              <h3 className="font-heading text-base font-medium">Attendance</h3>
              <span className="text-xs text-muted-foreground">last 30 days</span>
            </div>

            {/* Full-ring meter */}
            <div className="flex flex-col items-center gap-5">
              <div
                className="relative shrink-0"
                style={{ width: RING_SIZE, height: RING_SIZE }}
              >
                <svg
                  width={RING_SIZE}
                  height={RING_SIZE}
                  viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
                  className="-rotate-90"
                  aria-hidden="true"
                >
                  <circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={ringR}
                    fill="none"
                    stroke="var(--muted)"
                    strokeWidth={RING_STROKE}
                  />
                  <circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={ringR}
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth={RING_STROKE}
                    strokeLinecap="round"
                    strokeDasharray={ringCirc}
                    strokeDashoffset={ringOffset}
                  />
                </svg>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-display text-3xl font-semibold leading-none tabular-nums">
                    {attendance}%
                  </span>
                  <span className="mt-1 text-xs text-muted-foreground">
                    present
                  </span>
                </div>
              </div>

              <div className="w-full space-y-3">
                {/* Segmented 30-day distribution */}
                <div className="flex h-2 w-full gap-px overflow-hidden rounded-full bg-muted">
                  <span
                    className="bg-success"
                    style={{ width: `${(presentDays / 30) * 100}%` }}
                  />
                  <span
                    className="bg-warning"
                    style={{ width: `${(lateDays / 30) * 100}%` }}
                  />
                  <span
                    className="bg-destructive"
                    style={{ width: `${(absentDays / 30) * 100}%` }}
                  />
                </div>

                {/* Legend */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: "Present", value: presentDays, tone: "bg-success", text: "text-success" },
                    { label: "Late", value: lateDays, tone: "bg-warning", text: "text-warning" },
                    { label: "Absent", value: absentDays, tone: "bg-destructive", text: "text-destructive" },
                  ].map((s) => (
                    <div key={s.label}>
                      <p className={`text-lg font-semibold tabular-nums ${s.text}`}>
                        {s.value}
                      </p>
                      <span className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                        <span className={`size-1.5 rounded-full ${s.tone}`} />
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
          ) : null}
        </div>
      </Card>

      {/* Upload wireframe modal */}
      <PhotoEditor open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}
