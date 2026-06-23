"use client";

import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Sparkline } from "@/components/shared/sparkline";
import { cn } from "@/lib/utils";
import {
  PROJECT_STATUS_META,
  type Project,
} from "../types";
import {
  budgetHealth,
  dueLabel,
  formatMoney,
  toneRail,
  toneText,
  type UserMini,
} from "../lib";
import { MemberStack, ProgressTrack, StatusBadge } from "./parts";

interface ProjectCardProps {
  project: Project;
  members: UserMini[];
  doneCount: number;
  totalCount: number;
  onOpen: () => void;
}

export function ProjectCard({
  project,
  members,
  doneCount,
  totalCount,
  onOpen,
}: ProjectCardProps) {
  const status = PROJECT_STATUS_META[project.status];
  const health = budgetHealth(project);
  const due = dueLabel(project.dueDate);

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "relative cursor-pointer gap-4 pl-6 outline-none transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgb(0_0_0/0.35)]",
        "focus-visible:ring-3 focus-visible:ring-ring/50",
      )}
    >
      {/* Status accent rail */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-3 left-2 w-1 rounded-full transition-all duration-200 group-hover/card:inset-y-2",
          toneRail[status.tone],
        )}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-accent px-1.5 py-0.5 font-mono text-[0.7rem] font-semibold tracking-wide text-accent-foreground">
              {project.key}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {project.department}
            </span>
          </div>
          <h3 className="mt-1.5 truncate font-heading text-base font-semibold tracking-tight transition-colors group-hover/card:text-primary">
            {project.name}
          </h3>
        </div>
        <StatusBadge tone={status.tone} label={status.label} />
      </div>

      {/* Progress */}
      <div className="space-y-1.5 px-5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium tabular-nums">{project.progress}%</span>
        </div>
        <ProgressTrack value={project.progress} />
      </div>

      {/* Budget + tasks meta */}
      <div className="grid grid-cols-2 gap-3 px-5 text-xs">
        <div>
          <p className="text-muted-foreground">Budget</p>
          <p className="mt-0.5 font-medium tabular-nums">
            {formatMoney(project.spent)}
            <span className="text-muted-foreground">
              {" "}
              / {formatMoney(project.budget)}
            </span>
          </p>
          <p className={cn("mt-0.5 font-medium", toneText[health.tone])}>
            {health.label}
          </p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground">Tasks</p>
          <p className="mt-0.5 font-medium tabular-nums">
            {doneCount}
            <span className="text-muted-foreground"> / {totalCount} done</span>
          </p>
          <p
            className={cn(
              "mt-0.5 font-medium",
              due.overdue ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {due.text}
          </p>
        </div>
      </div>

      {/* Footer: members + pulse */}
      <div className="flex items-center justify-between gap-3 px-5">
        <MemberStack members={members} />
        <div className="flex items-center gap-2">
          <Sparkline
            data={project.velocity}
            width={72}
            height={26}
            showDot={false}
            className="text-primary/80"
          />
          <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover/card:translate-x-0.5 group-hover/card:-translate-y-0.5 group-hover/card:text-primary" />
        </div>
      </div>
    </Card>
  );
}
