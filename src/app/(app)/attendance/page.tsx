import type { Metadata } from "next";
import { CalendarCheck, Clock, UserX, Plane } from "lucide-react";
import { users } from "@/lib/data";
import { initials } from "@/lib/format";
import { attendanceFor, type AttendanceStatus } from "@/lib/mock-metrics";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const metadata: Metadata = { title: "Attendance" };

const STATUS_META: Record<
  AttendanceStatus,
  { label: string; className: string }
> = {
  present: { label: "Present", className: "bg-success/12 text-success" },
  late: { label: "Late", className: "bg-warning/15 text-warning" },
  leave: { label: "On leave", className: "bg-accent text-accent-foreground" },
  absent: { label: "Absent", className: "bg-destructive/12 text-destructive" },
};

export default function AttendancePage() {
  const rows = users.map((u) => ({ user: u, ...attendanceFor(u.id) }));
  const count = (s: AttendanceStatus) => rows.filter((r) => r.status === s).length;
  const total = rows.length;
  const presentPct = Math.round(((count("present") + count("late")) / total) * 100);

  return (
    <div className="space-y-5 pt-1">
      <PageHeader
        title="Attendance"
        description={`Today · ${presentPct}% of the team clocked in`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Present" value={count("present")} icon={CalendarCheck} featured />
        <StatCard label="Late" value={count("late")} icon={Clock} hint="arrived after 9:00" />
        <StatCard label="On leave" value={count("leave")} icon={Plane} hint="approved time off" />
        <StatCard label="Absent" value={count("absent")} icon={UserX} hint="no clock-in" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s log</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Clock in</TableHead>
                <TableHead>Clock out</TableHead>
                <TableHead className="text-right">Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 20).map(({ user, status, clockIn, clockOut, hours }) => {
                const meta = STATUS_META[status];
                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarImage src={user.avatarUrl} alt={user.name} />
                          <AvatarFallback className="text-xs">
                            {initials(user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.department}
                    </TableCell>
                    <TableCell>
                      <Badge className={meta.className}>{meta.label}</Badge>
                    </TableCell>
                    <TableCell className="font-mono tabular-nums">{clockIn}</TableCell>
                    <TableCell className="font-mono tabular-nums">{clockOut}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {hours ? hours.toFixed(1) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <p className="pt-4 text-center text-xs text-muted-foreground">
            Showing 20 of {total} employees
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
