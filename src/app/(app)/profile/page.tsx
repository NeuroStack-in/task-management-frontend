"use client";

import {
  Mail,
  Building2,
  Users as UsersIcon,
  Clock,
  CheckSquare,
  CalendarCheck,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useCurrentRole } from "@/hooks/use-permissions";
import { initials } from "@/lib/format";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Gauge } from "@/components/shared/gauge";
import { Loader } from "@/components/shared/loader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const STATUS_TONE: Record<string, string> = {
  active: "bg-success/12 text-success",
  inactive: "bg-muted text-muted-foreground",
  invited: "bg-warning/15 text-warning",
  suspended: "bg-destructive/12 text-destructive",
};

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const role = useCurrentRole();

  if (!user) return <Loader label="Loading profile…" />;

  // Deterministic personal stats from the user id (no randomness in render).
  const seed = [...user.id].reduce((sum, c) => sum + c.charCodeAt(0), 0);
  const avgHours = (7 + (seed % 20) / 10).toFixed(1);
  const tasksDone = 40 + (seed % 60);
  const attendance = 88 + (seed % 12);

  const details = [
    { icon: Mail, label: "Email", value: user.email },
    { icon: Building2, label: "Department", value: user.department },
    { icon: UsersIcon, label: "Team", value: user.team },
    { icon: CalendarCheck, label: "Member since", value: "Jan 2024" },
  ];

  return (
    <div className="space-y-5 pt-1">
      <PageHeader
        title="Profile"
        description="Your account, role, and personal productivity."
      />

      {/* Identity */}
      <Card>
        <CardContent className="flex flex-col items-start gap-4 px-6 sm:flex-row sm:items-center">
          <Avatar className="size-20">
            <AvatarImage src={user.avatarUrl} alt={user.name} />
            <AvatarFallback className="text-xl">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1.5">
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              {user.name}
            </h2>
            <p className="text-sm text-muted-foreground">{user.jobTitle}</p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
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
          </div>
        </CardContent>
      </Card>

      {/* Personal stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

        {/* Attendance rate */}
        <Card className="items-center justify-center">
          <CardHeader className="w-full">
            <CardTitle>Attendance rate</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center pb-2">
            <Gauge value={attendance} label="present, last 30 days" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
