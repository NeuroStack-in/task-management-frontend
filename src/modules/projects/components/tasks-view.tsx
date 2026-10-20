"use client";

import { useMemo } from "react";
import { ListChecks } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  TASK_PRIORITY_META,
  TASK_STATUS_META,
  type Project,
  type Task,
  type TaskStatus,
} from "../types";
import { dueLabel, isTaskOverdue, toneDot, toneSoft, type UserMini } from "../lib";
import { AssigneeStack } from "./assignees";
import { StatusBadge } from "./parts";

type Filter = TaskStatus | "all" | "overdue";

/** Whose tasks the tab lists — the signed-in person's own, or everyone's on the projects they see. */
export type TaskScope = "mine" | "all";

interface TasksViewProps {
  /** Tasks already narrowed by the shared search in the parent toolbar. */
  tasks: Task[];
  /** Active status filter — lives in the toolbar alongside the Projects tabs. */
  filter: Filter;
  projectMap: Record<string, Project>;
  /** Shared search term — used only for the empty-state copy. */
  query: string;
  /** For the assignee avatars on each row. */
  userMap: Record<string, UserMini>;
  /** Whose tasks `tasks` already is — used only for the empty-state copy. */
  scope: TaskScope;
  /** Offered from the empty "Assigned to me" state. */
  onShowEveryone?: () => void;
  /**
   * Open this task. A row used to open its **project**, leaving the person to find the task on the
   * board (UX audit PROJ-03); the caller now links straight to it.
   */
  onOpenTask: (task: Task) => void;
}

export function TasksView({
  tasks,
  filter,
  projectMap,
  query,
  userMap,
  scope,
  onShowEveryone,
  onOpenTask,
}: TasksViewProps) {
  const visible = useMemo(() => {
    const list =
      filter === "all"
        ? tasks
        : filter === "overdue"
          ? tasks.filter(isTaskOverdue)
          : tasks.filter((t) => t.status === filter);
    // Open work first, then by due date (undated last), high priority breaks ties.
    const prioRank = { high: 0, medium: 1, low: 2 };
    return [...list].sort((a, b) => {
      const aDone = a.status === "done" ? 1 : 0;
      const bDone = b.status === "done" ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      const aDue = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bDue = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      if (aDue !== bDue) return aDue - bDue;
      return prioRank[a.priority] - prioRank[b.priority];
    });
  }, [tasks, filter]);

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title={
          query
            ? "No tasks match your search"
            : scope === "mine"
              ? "Nothing is assigned to you"
              : "No tasks yet"
        }
        description={
          query
            ? "Try a different task or project name."
            : scope === "mine"
              ? "Tasks assigned to you, across every project you're on, collect here."
              : "Tasks across every project will collect here."
        }
        action={
          scope === "mine" && onShowEveryone ? (
            <Button variant="outline" onClick={onShowEveryone}>
              Show everyone&apos;s tasks
            </Button>
          ) : undefined
        }
      />
    );
  }

  // Tasks exist, but none in this filter. It rendered an empty bordered box with no word at all
  // (QA audit 2026-10-08, WP-498).
  if (visible.length === 0) {
    const what =
      filter === "overdue" ? "overdue" : filter === "all" ? "" : TASK_STATUS_META[filter].label;
    return (
      <EmptyState
        icon={ListChecks}
        title={what ? `No ${what.toLowerCase()} tasks` : "No tasks"}
        description={
          query ? "None match your search with this filter." : "Try another filter."
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <ul className="divide-y">
        {visible.map((t) => {
          const project = projectMap[t.projectId];
          const prio = TASK_PRIORITY_META[t.priority];
          const status = TASK_STATUS_META[t.status];
          // Signed-off work past its date was finished, not late (WP-377).
          const due = dueLabel(t.dueDate, t.status === "done");
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onOpenTask(t)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    toneDot[prio.tone],
                  )}
                  title={`${prio.label} priority`}
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "truncate text-sm font-medium",
                      t.status === "done" &&
                        "text-muted-foreground line-through",
                    )}
                  >
                    {t.title}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                    {project?.key ? (
                      <span className="rounded bg-accent px-1 font-mono text-[0.65rem] font-semibold text-accent-foreground">
                        {project.key}
                      </span>
                    ) : null}
                    <span className="truncate">
                      {project?.name ?? "Unknown"}
                    </span>
                    {/* The breakdown counter. Rendered only when the task actually has subtasks —
                        "0/0" on every other row would be noise, and it is the normal case. */}
                    {t.subtaskProgress.total > 0 ? (
                      <span
                        className="flex shrink-0 items-center gap-1 tabular-nums"
                        title={`${t.subtaskProgress.done} of ${t.subtaskProgress.total} subtasks done`}
                      >
                        <ListChecks className="size-3" />
                        {t.subtaskProgress.done}/{t.subtaskProgress.total}
                      </span>
                    ) : null}
                  </p>
                </div>
                <span
                  className={cn(
                    "hidden shrink-0 text-xs font-medium tabular-nums sm:block",
                    due.overdue ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {due.text}
                </span>
                <span
                  className={cn(
                    "hidden shrink-0 rounded-full px-2 py-0.5 text-xs font-medium md:inline-flex",
                    toneSoft[prio.tone],
                  )}
                >
                  {prio.label}
                </span>
                {/* Who it's on — the tab had no assignee anywhere (PROJ-03). */}
                <AssigneeStack
                  assignees={t.assignees}
                  userMap={userMap}
                  size="xs"
                  ringClass="ring-card"
                  className="shrink-0"
                />
                <StatusBadge
                  tone={status.tone}
                  label={status.label}
                  className="shrink-0"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
