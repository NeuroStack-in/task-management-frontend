"use client";

import { CalendarRange, Crown } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import {
  PROJECT_STATUS_META,
  TASK_PRIORITY_META,
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
  type Project,
  type Task,
} from "../types";
import {
  budgetHealth,
  formatDate,
  formatMoney,
  taskCounts,
  toneDot,
  toneText,
  type UserMini,
} from "../lib";
import { MetricTile, ProgressTrack, StatusBadge } from "./parts";

interface ProjectDetailSheetProps {
  project: Project | null;
  tasks: Task[];
  userMap: Record<string, UserMini>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectDetailSheet({
  project,
  tasks,
  userMap,
  open,
  onOpenChange,
}: ProjectDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-xl">
        {project ? (
          <ProjectDetailBody
            project={project}
            tasks={tasks}
            userMap={userMap}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ProjectDetailBody({
  project,
  tasks,
  userMap,
}: {
  project: Project;
  tasks: Task[];
  userMap: Record<string, UserMini>;
}) {
  const status = PROJECT_STATUS_META[project.status];
  const health = budgetHealth(project);
  const counts = taskCounts(tasks);
  const done = counts.done;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-5 pt-5 pb-4">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-accent px-1.5 py-0.5 font-mono text-[0.7rem] font-semibold tracking-wide text-accent-foreground">
            {project.key}
          </span>
          <StatusBadge tone={status.tone} label={status.label} />
        </div>
        <h2 className="mt-2 font-display text-xl font-semibold tracking-tight">
          {project.name}
        </h2>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{project.department}</span>
          <span className="inline-flex items-center gap-1">
            <CalendarRange className="size-3.5" />
            {formatDate(project.startDate)} – {formatDate(project.dueDate)}
          </span>
        </div>
      </div>

      {/* Scroll body */}
      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        {/* KPI tiles */}
        <div className="grid grid-cols-2 gap-3">
          <MetricTile
            label="Progress"
            value={`${project.progress}%`}
            sub={`${done} of ${tasks.length} tasks done`}
          />
          <MetricTile
            label="Budget"
            value={`${Math.round(health.pct * 100)}%`}
            sub={`${formatMoney(project.spent)} / ${formatMoney(project.budget)}`}
            subTone={health.tone}
          />
          <MetricTile label="Team" value={project.memberIds.length} sub="members" />
          <MetricTile
            label="Open work"
            value={counts.todo + counts.in_progress + counts.in_review}
            sub="tasks remaining"
          />
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Progress</p>
          <ProgressTrack value={project.progress} className="h-2" />
        </div>

        {/* Team */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Team</p>
          <div className="flex flex-wrap gap-3">
            {project.memberIds.map((id) => {
              const u = userMap[id];
              if (!u) return null;
              const isLead = id === project.leadUserId;
              return (
                <div key={id} className="flex items-center gap-2">
                  <Avatar size="sm">
                    {u.avatarUrl ? (
                      <AvatarImage src={u.avatarUrl} alt={u.name} />
                    ) : null}
                    <AvatarFallback>{initials(u.name)}</AvatarFallback>
                  </Avatar>
                  <div className="leading-tight">
                    <p className="flex items-center gap-1 text-xs font-medium">
                      {u.name}
                      {isLead ? (
                        <Crown className="size-3 text-warning" aria-label="Lead" />
                      ) : null}
                    </p>
                    <p className="text-[0.7rem] text-muted-foreground">
                      {isLead ? "Project lead" : u.jobTitle}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Mini board */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Board</p>
          <div className="space-y-3">
            {TASK_STATUS_ORDER.map((col) => {
              const colTasks = tasks.filter((t) => t.status === col);
              const meta = TASK_STATUS_META[col];
              return (
                <div
                  key={col}
                  className="rounded-xl border bg-muted/20 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                      <span
                        className={cn("size-2 rounded-full", toneDot[meta.tone])}
                      />
                      {meta.label}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {colTasks.length}
                    </span>
                  </div>
                  {colTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground/70">No tasks.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {colTasks.slice(0, 5).map((t) => {
                        const assignee = t.assigneeId
                          ? userMap[t.assigneeId]
                          : null;
                        const prio = TASK_PRIORITY_META[t.priority];
                        return (
                          <li
                            key={t.id}
                            className="flex items-center gap-2 rounded-lg bg-card px-2.5 py-1.5"
                          >
                            <span
                              className={cn(
                                "size-1.5 shrink-0 rounded-full",
                                toneDot[prio.tone],
                              )}
                              title={`${prio.label} priority`}
                            />
                            <span className="min-w-0 flex-1 truncate text-xs">
                              {t.title}
                            </span>
                            {assignee ? (
                              <Avatar size="sm" className="size-5">
                                {assignee.avatarUrl ? (
                                  <AvatarImage
                                    src={assignee.avatarUrl}
                                    alt={assignee.name}
                                  />
                                ) : null}
                                <AvatarFallback className="text-[0.55rem]">
                                  {initials(assignee.name)}
                                </AvatarFallback>
                              </Avatar>
                            ) : (
                              <span className="text-[0.7rem] text-muted-foreground/60">
                                —
                              </span>
                            )}
                          </li>
                        );
                      })}
                      {colTasks.length > 5 ? (
                        <li className={cn("px-2.5 pt-0.5 text-[0.7rem]", toneText.muted)}>
                          +{colTasks.length - 5} more
                        </li>
                      ) : null}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer note */}
      <div className="border-t bg-muted/40 px-5 py-3">
        <p className="text-xs text-muted-foreground">
          Full board, list, timeline and task detail arrive with the project
          workspace. This is a live preview from mock data.
        </p>
      </div>
    </div>
  );
}
