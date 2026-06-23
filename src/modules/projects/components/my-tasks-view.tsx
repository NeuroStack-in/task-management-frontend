"use client";

import { useMemo, useState } from "react";
import { ListChecks } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import {
  TASK_PRIORITY_META,
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
  type Project,
  type Task,
  type TaskStatus,
} from "../types";
import { dueLabel, toneDot, toneSoft } from "../lib";
import { Segmented, StatusBadge, type SegmentedOption } from "./parts";

type Filter = TaskStatus | "all";

interface MyTasksViewProps {
  tasks: Task[];
  projectMap: Record<string, Project>;
  onOpenProject: (projectId: string) => void;
}

export function MyTasksView({
  tasks,
  projectMap,
  onOpenProject,
}: MyTasksViewProps) {
  const [filter, setFilter] = useState<Filter>("all");

  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: tasks.length,
      todo: 0,
      in_progress: 0,
      in_review: 0,
      done: 0,
    };
    for (const t of tasks) c[t.status] += 1;
    return c;
  }, [tasks]);

  const visible = useMemo(() => {
    const list = filter === "all" ? tasks : tasks.filter((t) => t.status === filter);
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

  const filterOptions: SegmentedOption<Filter>[] = [
    { value: "all", label: "All", count: counts.all },
    ...TASK_STATUS_ORDER.map((s) => ({
      value: s as Filter,
      label: TASK_STATUS_META[s].label,
      count: counts[s],
    })),
  ];

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="No tasks assigned to you"
        description="Tasks assigned to you across every project will collect here."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Segmented
        options={filterOptions}
        value={filter}
        onChange={setFilter}
        className="flex-wrap"
      />

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
                      <span className="truncate">{project?.name ?? "Unknown"}</span>
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
    </div>
  );
}
