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
  TrendingUp,
  Info,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useCurrentRole } from "@/hooks/use-permissions";
import { initials } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Loader } from "@/components/shared/loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function formatMemberSince(issuedAt: number | undefined): string | null {
  if (!issuedAt) return null;
  return new Date(issuedAt).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

export function ProfileView() {
  const user = useAuthStore((s) => s.user);
  const session = useAuthStore((s) => s.session);
  const role = useCurrentRole();

  const [uploadOpen, setUploadOpen] = useState(false);

  if (!user) return <Loader label="Loading profile…" />;

  // Deterministic personal stats from the user id (no randomness in render)
  const seed = [...user.id].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const avgHours = (7 + (seed % 20) / 10).toFixed(1);
  const tasksDone = 40 + (seed % 60);
  const attendance = 88 + (seed % 12);

  const memberSince = formatMemberSince(session?.issuedAt);

  const details = [
    { icon: Mail, label: "Email", value: user.email },
    { icon: Building2, label: "Department", value: user.department },
    { icon: UsersIcon, label: "Team", value: user.team },
    ...(memberSince
      ? [{ icon: CalendarCheck, label: "Member since", value: memberSince }]
      : []),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Profile"
        description="Your account, role, and personal productivity."
      />

      {/* Identity card */}
      <Card>
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
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="size-3 shrink-0" />
              Name and job title are managed by your administrator.
            </p>
            {!user.avatarUrl && (
              <button
                onClick={() => setUploadOpen(true)}
                className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-sm"
              >
                <Camera className="size-3" />
                Add profile photo
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Personal stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Productivity score"
          value={`${user.productivityScore}%`}
          icon={TrendingUp}
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

      <div className="grid gap-4 xl:grid-cols-3">
        {/* Account details */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Account details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {details.map((d) => (
              <div key={d.label} className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-feature-tint text-primary">
                  <d.icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{d.label}</p>
                  <p className="truncate text-sm font-medium">{d.value}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Attendance + tasks pair — compact stats side by side */}
        <div className="flex flex-col gap-4">
          <StatCard
            label="Attendance rate"
            value={`${attendance}%`}
            icon={CalendarCheck}
            hint="present, last 30 days"
          />
          <StatCard
            label="On-time completion"
            value={`${Math.min(100, attendance - 2 + (seed % 8))}%`}
            icon={CheckSquare}
            hint="tasks this month"
          />
        </div>
      </div>

      {/* Upload wireframe modal */}
      <PhotoEditor open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </div>
  );
}
