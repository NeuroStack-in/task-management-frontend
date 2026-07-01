"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
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
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useCurrentRole } from "@/hooks/use-permissions";
import { initials } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { Sparkline } from "@/components/shared/sparkline";
import { Gauge } from "@/components/shared/gauge";
import { Loader } from "@/components/shared/loader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PhotoEditor } from "@/modules/profile/components/photo-editor";
import type { User } from "@/types/user";
import { cn } from "@/lib/utils";

const LOCATIONS = [
  "San Francisco, CA",
  "New York, NY",
  "Austin, TX",
  "Seattle, WA",
  "Remote",
];
const WORK_MODES = ["On-site", "Hybrid", "Remote"];

interface DetailRow {
  icon: LucideIcon;
  label: string;
  value: string;
}

/** Deterministic personal facts seeded from the user id (no randomness). */
function personalFacts(user: User) {
  const seed = [...user.id].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    seed,
    avgHours: (7 + (seed % 20) / 10).toFixed(1),
    tasksDone: 40 + (seed % 60),
    attendance: 88 + (seed % 12),
    location: LOCATIONS[seed % LOCATIONS.length],
    workMode: WORK_MODES[seed % WORK_MODES.length],
    employeeId: `EMP-${String(1000 + (seed % 9000))}`,
    phone: `+1 (${200 + (seed % 700)}) 555-${String(1000 + (seed % 9000))}`,
    dobISO: `${1985 + (seed % 15)}-${pad((seed % 12) + 1)}-${pad((seed % 27) + 1)}`,
  };
}

export function ProfileView() {
  const user = useAuthStore((s) => s.user);
  const role = useCurrentRole();

  if (!user) return <Loader label="Loading profile…" />;

  // One unified profile pattern for every role — identity hero, productivity,
  // and attendance.
  return <RichProfile user={user} roleName={role?.name ?? "—"} />;
}

/* ──────────────────────────── Profile ──────────────────────────── */

/** The full profile — identity band + productivity + attendance, shown to
 *  every role. */
function RichProfile({ user, roleName }: { user: User; roleName: string }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const facts = personalFacts(user);
  const productivity = user.productivityScore;

  const presentDays = Math.round((facts.attendance / 100) * 30);
  const lateDays = Math.round((30 - presentDays) * 0.6);
  const absentDays = Math.max(0, 30 - presentDays - lateDays);
  const prodTrend = [62, 65, 63, 70, 72, 69, productivity];

  const contact: DetailRow[] = [
    { icon: Mail, label: "Email", value: user.email },
    { icon: MapPin, label: "Location", value: facts.location },
    { icon: Briefcase, label: "Work mode", value: facts.workMode },
  ];
  const employment: DetailRow[] = [
    { icon: Hash, label: "Employee ID", value: facts.employeeId },
    { icon: Building2, label: "Department", value: user.department },
    { icon: UsersIcon, label: "Team", value: user.team },
    { icon: ShieldCheck, label: "Role", value: roleName },
    { icon: CalendarCheck, label: "Member since", value: "Jan 2024" },
  ];

  return (
    <div className="flex flex-col gap-5 pb-2">
      <PageHeader
        title="Profile"
        description="Your account, role, and personal productivity."
      />

      {/* Hero identity band */}
      <section
        className="relative overflow-hidden rounded-2xl bg-feature p-6 text-feature-foreground shadow-soft animate-in fade-in slide-in-from-bottom-3 duration-500 sm:p-7"
        style={{ animationFillMode: "backwards" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(130% 120% at 12% -10%, rgb(255 255 255 / 0.18), transparent 55%), radial-gradient(90% 120% at 100% 120%, rgb(0 0 0 / 0.22), transparent 60%)",
          }}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 opacity-[0.14]">
          <Sparkline
            data={[18, 42, 30, 58, 40, 72, 55, 84, 66, 92]}
            area
            height={120}
            strokeWidth={2}
            className="text-white"
          />
        </div>

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <div className="group relative shrink-0">
              <Avatar className="size-24 ring-4 ring-white/25">
                <AvatarImage src={user.avatarUrl} alt={user.name} />
                <AvatarFallback className="bg-white/15 text-2xl font-semibold text-white">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
              <DropdownMenu>
                <DropdownMenuTrigger
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
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

            <div className="min-w-0 space-y-2">
              <div>
                <h2 className="font-display text-[1.7rem] font-semibold leading-tight tracking-tight">
                  {user.name}
                </h2>
                <p className="text-sm text-feature-foreground/80">
                  {user.jobTitle} · {user.department} · {user.team}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border-white/20 bg-white/15 text-white">{roleName}</Badge>
                <Badge className="border-white/20 bg-white/15 capitalize text-white">
                  <span className="mr-1 inline-block size-1.5 rounded-full bg-white" />
                  {user.status}
                </Badge>
              </div>
            </div>
          </div>

          <div className="shrink-0 rounded-xl bg-white/10 p-4 ring-1 ring-inset ring-white/15 backdrop-blur-sm sm:min-w-60">
            <div className="flex items-center justify-between gap-6">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-feature-foreground/75">
                  <TrendingUp className="size-3.5" /> Productivity
                </p>
                <p className="mt-1 font-display text-4xl font-semibold leading-none tabular-nums">
                  {productivity}%
                </p>
                <p className="mt-1 text-xs text-feature-foreground/70">this week</p>
              </div>
              <Sparkline
                data={prodTrend}
                area
                showDot
                width={92}
                height={48}
                strokeWidth={2}
                className="text-white"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card
          className="animate-in fade-in slide-in-from-bottom-3 p-6 duration-500 sm:p-7"
          style={{ animationDelay: "80ms", animationFillMode: "backwards" } as CSSProperties}
        >
          <div className="mb-5 flex items-center justify-between">
            <h3 className="font-heading text-base font-medium">Account details</h3>
            <span className="font-mono text-xs text-muted-foreground">{facts.employeeId}</span>
          </div>
          <ManagerGroup label="Contact" rows={contact} />
          <div className="my-5 h-px bg-border" />
          <ManagerGroup label="Employment" rows={employment} />
        </Card>

        <Card
          className="animate-in fade-in slide-in-from-bottom-3 flex flex-col gap-5 p-6 duration-500 sm:p-7"
          style={{ animationDelay: "160ms", animationFillMode: "backwards" } as CSSProperties}
        >
          <div className="flex items-baseline justify-between">
            <h3 className="font-heading text-base font-medium">Attendance</h3>
            <span className="text-xs text-muted-foreground">last 30 days</span>
          </div>
          <div className="flex justify-center">
            <Gauge value={facts.attendance} label="present" size={168} />
          </div>
          <div className="space-y-3">
            <div className="flex h-2 w-full gap-px overflow-hidden rounded-full bg-muted">
              <span className="bg-success" style={{ width: `${(presentDays / 30) * 100}%` }} />
              <span className="bg-warning" style={{ width: `${(lateDays / 30) * 100}%` }} />
              <span className="bg-destructive" style={{ width: `${(absentDays / 30) * 100}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Present", value: presentDays, tone: "bg-success", text: "text-success" },
                { label: "Late", value: lateDays, tone: "bg-warning", text: "text-warning" },
                { label: "Absent", value: absentDays, tone: "bg-destructive", text: "text-destructive" },
              ].map((s) => (
                <div key={s.label}>
                  <p className={cn("text-lg font-semibold tabular-nums", s.text)}>{s.value}</p>
                  <span className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                    <span className={cn("size-1.5 rounded-full", s.tone)} />
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="h-px bg-border" />
          <div className="grid grid-cols-2 gap-3">
            <MiniStat icon={Clock} label="Avg. hours / day" value={facts.avgHours} hint="last 30 days" />
            <MiniStat icon={CheckSquare} label="Tasks done" value={String(facts.tasksDone)} hint="this quarter" />
          </div>
        </Card>
      </div>

      <PhotoEditor open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}

function ManagerGroup({ label, rows }: { label: string; rows: DetailRow[] }) {
  return (
    <div>
      <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {rows.map((d) => (
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
              <dd className="truncate text-sm font-medium text-foreground">{d.value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/30 p-3.5">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="truncate text-xs font-medium">{label}</span>
      </div>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums leading-none">{value}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
