"use client";

import { useMemo } from "react";
import { ListChecks } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import {
  TASK_PRIORITY_META,
  TASK_STATUS_META,
  type Project,
  type Task,
  type TaskStatus,
} from "../types";
import { dueLabel, toneDot, toneSoft } from "../lib";
import { StatusBadge } from "./parts";

type Filter = TaskStatus | "all";

interface TasksViewProps {
  /** Tasks already narrowed by the shared search in the parent toolbar. */
  tasks: Task[];
  /** Active status filter — lives in the toolbar alongside the Projects tabs. */
  filter: Filter;
  projectMap: Record<string, Project>;
  /** Shared search term — used only for the empty-state copy. */
  query: string;
  onOpenProject: (projectId: string) => void;
}

export function TasksView({
  tasks,
  filter,
  projectMap,
  query,
  onOpenProject,
}: TasksViewProps) {
  const visible = useMemo(() => {
    const list =
      filter === "all" ? tasks : tasks.filter((t) => t.status === filter);
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
        title={query ? "No tasks match your search" : "No tasks yet"}
        description={
          query
            ? "Try a different task or project name."
            : "Tasks across every project will collect here."
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
          const due = dueLabel(t.dueDate);
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onOpenProject(t.projectId)}
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
                    <span className="rounded bg-accent px-1 font-mono text-[0.65rem] font-semibold text-accent-foreground">
                      {project?.key ?? "—"}
                    </span>
                    <span className="truncate">
                      {project?.name ?? "Unknown"}
                    </span>
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
