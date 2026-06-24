"use client";

import { useMemo, useState } from "react";
import { Clock, BadgeDollarSign, CheckCheck, Activity } from "lucide-react";
import { toast } from "sonner";
import { StatCard } from "@/components/shared/stat-card";
import { WeeklyHoursChart } from "./weekly-hours-chart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { initials } from "@/lib/format";
import type { DailyHours, TeamMemberTime, TimesheetStatus } from "@/lib/mock-time";
import { cn } from "@/lib/utils";

const STATUS_META: Record<TimesheetStatus, { label: string; className: string }> = {
  approved: { label: "Approved", className: "bg-success/12 text-success" },
  pending: { label: "Pending", className: "bg-warning/15 text-warning" },
  flagged: { label: "Flagged", className: "bg-destructive/12 text-destructive" },
};

const PAGE_SIZE = 8;
const order: Record<TimesheetStatus, number> = { pending: 0, flagged: 1, approved: 2 };

export function TeamTimeView({
  rows,
  weekly,
  canApprove,
}: {
  rows: TeamMemberTime[];
  weekly: DailyHours[];
  canApprove: boolean;
}) {
  const [overrides, setOverrides] = useState<Record<string, TimesheetStatus>>({});
  const [page, setPage] = useState(0);

  const statusOf = (r: TeamMemberTime) => overrides[r.id] ?? r.status;

  const teamHours = weekly.reduce((s, d) => s + d.hours, 0);
  const teamBillable = weekly.reduce((s, d) => s + d.billable, 0);
  const billablePct = Math.round((teamBillable / (teamHours || 1)) * 100);
  const avgActivity = Math.round(
    rows.reduce((s, r) => s + r.activity, 0) / (rows.length || 1),
  );
  const pending = rows.filter((r) => statusOf(r) === "pending").length;

  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) => order[statusOf(a)] - order[statusOf(b)] || a.name.localeCompare(b.name),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, overrides],
  );
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const view = sorted.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const decide = (r: TeamMemberTime, status: TimesheetStatus) => {
    setOverrides((o) => ({ ...o, [r.id]: status }));
    toast.success(
      status === "approved" ? "Timesheet approved" : "Timesheet sent back",
      { description: `${r.name} · ${r.trackedHrs}h this week` },
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Team hours"
          value={`${teamHours.toLocaleString()}h`}
          icon={Clock}
          hint="this week"
          trend={weekly.map((d) => d.hours)}
          featured
        />
        <StatCard label="Billable" value={`${billablePct}%`} icon={BadgeDollarSign} delta={2} />
        <StatCard label="Pending approvals" value={pending} icon={CheckCheck} hint="awaiting review" />
        <StatCard label="Avg activity" value={`${avgActivity}%`} icon={Activity} delta={3} />
      </div>

      <WeeklyHoursChart data={weekly} />

      <Card>
        <CardHeader>
          <CardTitle>Team timesheets</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Employee</TableHead>
                  <TableHead>Tracked</TableHead>
                  <TableHead>Idle</TableHead>
                  <TableHead>Billable</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead>Status</TableHead>
                  {canApprove ? <TableHead className="text-right pr-5">Actions</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {view.map((r) => {
                  const status = statusOf(r);
                  const meta = STATUS_META[status];
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="pl-5">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-8">
                            <AvatarImage src={r.avatarUrl} alt={r.name} />
                            <AvatarFallback className="text-xs">
                              {initials(r.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{r.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {r.department}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono tabular-nums">{r.trackedHrs}h</TableCell>
                      <TableCell className="font-mono tabular-nums text-muted-foreground">
                        {r.idleHrs}h
                      </TableCell>
                      <TableCell className="tabular-nums">{r.billablePct}%</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "font-mono text-sm tabular-nums",
                            r.activity >= 60
                              ? "text-success"
                              : r.activity >= 45
                                ? "text-warning"
                                : "text-destructive",
                          )}
                        >
                          {r.activity}%
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={meta.className}>{meta.label}</Badge>
                      </TableCell>
                      {canApprove ? (
                        <TableCell className="pr-5 text-right">
                          {status === "approved" ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <div className="flex justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs"
                                onClick={() => decide(r, "flagged")}
                              >
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => decide(r, "approved")}
                              >
                                Approve
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, sorted.length)} of{" "}
          {sorted.length}
        </span>
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            disabled={safePage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
