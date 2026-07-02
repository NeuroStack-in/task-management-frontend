"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import {
  PROJECT_STATUS_META,
  PROJECT_STATUS_ORDER,
  type Project,
  type ProjectStatus,
} from "../types";
import {
  dueLabel,
  toneDot,
  type UserMini,
} from "../lib";
import { MemberStack, ProgressTrack } from "./parts";

interface TaskSummary {
  done: number;
  total: number;
}

interface ProjectsListProps {
  projects: Project[];
  userMap: Record<string, UserMini>;
  taskSummary: Record<string, TaskSummary>;
  onOpen: (id: string) => void;
}

const ROW =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 md:grid-cols-[minmax(0,2.6fr)_minmax(0,1.5fr)_minmax(0,1.2fr)_112px]";

export function ProjectsList({
  projects,
  userMap,
  taskSummary,
  onOpen,
}: ProjectsListProps) {
  const [collapsed, setCollapsed] = useState<Set<ProjectStatus>>(new Set());

  const toggle = (s: ProjectStatus) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  const groups = PROJECT_STATUS_ORDER.map((status) => ({
    status,
    items: projects.filter((p) => p.status === status),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      {groups.map(({ status, items }) => {
        const meta = PROJECT_STATUS_META[status];
        const open = !collapsed.has(status);
        return (
          <div
            key={status}
            className="overflow-hidden rounded-2xl border bg-card"
          >
            {/* Group header */}
            <button
              type="button"
              onClick={() => toggle(status)}
              className="flex w-full items-center gap-2 px-4 py-3 transition-colors hover:bg-muted/40"
            >
              <ChevronDown
                className={cn(
                  "size-4 text-muted-foreground transition-transform",
                  !open && "-rotate-90",
                )}
              />
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                  status === "active" && "bg-accent text-accent-foreground",
                  status === "on_hold" && "bg-warning/15 text-warning",
                  status === "completed" && "bg-success/12 text-success",
                )}
              >
                <span className={cn("size-1.5 rounded-full", toneDot[meta.tone])} />
                {meta.label}
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {items.length}
              </span>
            </button>

            {open ? (
              <div className="border-t">
                {/* Column header (md+) */}
                <div
                  className={cn(
                    ROW,
                    "hidden border-b bg-muted/20 py-2 text-xs font-medium text-muted-foreground md:grid",
                  )}
                >
                  <span>Project</span>
                  <span>Progress</span>
                  <span>Tasks</span>
                  <span className="text-right">Due</span>
                </div>

                {items.map((p) => {
                  const lead = userMap[p.leadUserId];
                  const members = p.memberIds
                    .map((id) => userMap[id])
                    .filter(Boolean) as UserMini[];
                  const due = dueLabel(p.dueDate);
                  const summary = taskSummary[p.id] ?? { done: 0, total: 0 };

                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => onOpen(p.id)}
                      className={cn(
                        ROW,
                        "w-full border-b text-left transition-colors last:border-b-0 hover:bg-muted/40",
                      )}
                    >
                      {/* Project */}
                      <div className="flex min-w-0 items-center gap-3">
                        {lead ? (
                          <Avatar size="sm" className="shrink-0">
                            {lead.avatarUrl ? (
                              <AvatarImage src={lead.avatarUrl} alt={lead.name} />
                            ) : null}
                            <AvatarFallback>{initials(lead.name)}</AvatarFallback>
                          </Avatar>
                        ) : null}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-accent px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold text-accent-foreground">
                              {p.key}
                            </span>
                            <span className="truncate text-sm font-medium">
                              {p.name}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            <MemberStack members={members} max={3} />
                            <span className="truncate text-xs text-muted-foreground">
                              {p.department}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="col-start-1 flex items-center gap-2 md:col-start-auto">
                        <ProgressTrack value={p.progress} className="w-full" />
                        <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums">
                          {p.progress}%
                        </span>
                      </div>

                      {/* Tasks */}
                      <div className="hidden md:block">
                        <p className="text-sm tabular-nums">
                          {summary.done}
                          <span className="text-muted-foreground">
                            {" "}
                            / {summary.total} done
                          </span>
                        </p>
                      </div>

                      {/* Due */}
                      <div className="hidden text-right md:block">
                        <span
                          className={cn(
                            "text-xs font-medium tabular-nums",
                            due.overdue
                              ? "text-destructive"
                              : "text-muted-foreground",
                          )}
                        >
                          {due.text}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
