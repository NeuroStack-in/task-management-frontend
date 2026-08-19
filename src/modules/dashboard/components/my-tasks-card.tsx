"use client";

/**
 * "My tasks" -- the signed-in user's own open tasks, as a card.
 *
 * Shared by **both** dashboards on purpose. It was inline in `personal-dashboard.tsx`, which meant
 * the surface existed only for self-scoped roles: an Admin/Owner/Manager (anyone holding
 * `employees:view` or `activity:view`) gets `OrgDashboard`, whose widget catalog has no my-tasks
 * entry, so a task assigned to them appeared nowhere on the dashboard. The dashboard is the one page
 * allowed to aggregate what other pages own (frontend `CLAUDE.md`), so the fix is to reuse this card
 * in the org view -- not to fork a second copy of it.
 *
 * "Open" means **not finished**, which is `done` *and* `closed` (mirroring `TaskStatus::is_open` in
 * `backend/crates/projects/src/shared/task.rs`). `closed` is the terminal post-review state; treating
 * it as open is what kept signed-off work in this list forever. The filtering itself lives in
 * `useMyWork`, so both callers inherit it.
 */
import Link from "next/link";
import { ArrowRight, CheckCircle2, ListChecks } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TASK_STATUS_META, type TaskStatus } from "@/modules/projects/types";
import { cn } from "@/lib/utils";
import { useMyWork, type MyTask } from "../use-my-work";

const TONE: Record<string, string> = {
  muted: "bg-muted text-muted-foreground",
  primary: "bg-primary/12 text-primary",
  warning: "bg-warning/15 text-warning",
  success: "bg-success/12 text-success",
  negative: "bg-destructive/12 text-destructive",
};

const SHORT_MONTH = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatDue(iso: string | null): string {
  if (!iso) return "No due date";
  const [, m, d] = iso.split("-").map(Number);
  return `${SHORT_MONTH[m - 1]} ${d}`;
}

/**
 * Deadline urgency for the task list, from calendar days between today and the due date:
 * `"overdue"` when it's already past, `"soon"` when it's within the next 3 days (below 3 days
 * remaining), else `null`. Local-midnight comparison so "today" reads as due, not overdue.
 */
function dueUrgency(iso: string | null): "overdue" | "soon" | null {
  if (!iso) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = iso.split("-").map(Number);
  const due = new Date(y, m - 1, d);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "overdue";
  if (days < 3) return "soon";
  return null;
}

/** Presentational. The caller owns the fetch, so the personal dashboard reuses the one it makes. */
export function MyTasksCard({
  tasks,
  className,
}: {
  tasks: MyTask[];
  className?: string;
}) {
  return (
    <Card
      data-tour="dash:tasks"
      className={cn("flex flex-col gap-0 p-0 [--card-spacing:0px]", className)}
    >
      <div className="border-border flex items-center justify-between border-b px-5 py-4">
        <h2 className="font-display text-base font-semibold tracking-tight">My tasks</h2>
        <Link
          href="/projects"
          className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400"
        >
          View all <ArrowRight className="size-3.5" />
        </Link>
      </div>
      {tasks.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-10 text-center">
          <CheckCircle2 className="text-success/70 size-6" />
          <p className="text-sm font-medium">You&apos;re all caught up</p>
          <p className="text-muted-foreground text-xs">
            No open tasks assigned to you right now.
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          {/* Table view: Task · Project · Deadline · Status. Deadline and Status collapse on
                  narrow screens so the two identifying columns (task + project) always stay. */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-border text-muted-foreground border-b text-left text-xs font-medium tracking-wide uppercase">
                  <th scope="col" className="px-5 py-2.5 font-medium">
                    Task
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Project
                  </th>
                  <th
                    scope="col"
                    className="hidden px-3 py-2.5 text-right font-medium sm:table-cell"
                  >
                    Deadline
                  </th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {tasks.slice(0, 6).map((t) => {
                  const meta = TASK_STATUS_META[t.status as TaskStatus];
                  const urgency = dueUrgency(t.due);
                  return (
                    <tr key={t.id} className="hover:bg-muted/40 transition-colors">
                      <td className="max-w-0 px-5 py-3">
                        <span className="block truncate font-medium">{t.title}</span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          {t.projectKey ? (
                            <span className="bg-muted shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[0.65rem]">
                              {t.projectKey}
                            </span>
                          ) : null}
                          <span className="truncate">{t.projectName ?? "—"}</span>
                        </span>
                      </td>
                      {/* Overdue → red, within 3 days → amber, otherwise the usual muted date. */}
                      <td
                        className={cn(
                          "hidden px-3 py-3 text-right text-xs whitespace-nowrap tabular-nums sm:table-cell",
                          urgency === "overdue"
                            ? "text-destructive font-semibold"
                            : urgency === "soon"
                              ? "text-warning font-medium"
                              : "text-muted-foreground",
                        )}
                      >
                        {formatDue(t.due)}
                      </td>
                      <td className="px-5 py-3 text-right whitespace-nowrap">
                        {meta ? (
                          <Badge className={cn("font-medium", TONE[meta.tone])}>
                            {meta.label}
                          </Badge>
                        ) : (
                          <Badge className="font-medium">{t.status}</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="text-muted-foreground flex flex-1 items-center justify-center gap-2 px-5 py-4 text-center text-sm">
            {tasks.length > 6 ? (
              <>
                <ListChecks className="size-4 shrink-0" />
                <span>
                  {tasks.length - 6} more open {tasks.length - 6 === 1 ? "task" : "tasks"}
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="text-success/70 size-4 shrink-0" />
                <span>That&apos;s all your open tasks right now.</span>
              </>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

/**
 * Self-fetching variant, for a caller that doesn't already hold the data -- i.e. the org dashboard.
 *
 * `useMyWork` is called here rather than in `OrgDashboard` so the org view pays for the fetch only
 * when this card actually renders, and the personal dashboard keeps sharing the single fetch it
 * already makes.
 */
export function MyTasksCardSelf({ className }: { className?: string }) {
  const { openTasks } = useMyWork();
  return <MyTasksCard tasks={openTasks} className={className} />;
}
