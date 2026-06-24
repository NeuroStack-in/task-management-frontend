"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarRange,
  Crown,
  Pencil,
  Trash2,
  Users,
  Wallet,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Gauge } from "@/components/shared/gauge";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import {
  useProjectsStore,
  type ProjectFormValues,
} from "@/stores/projects.store";
import {
  PROJECT_STATUS_META,
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "../types";
import {
  budgetHealth,
  daysUntil,
  formatDate,
  formatMoney,
  isAtRisk,
  taskCounts,
  type UserMini,
} from "../lib";
import { MemberStack, ProgressTrack, StatusBadge } from "./parts";
import { ProjectFormDialog } from "./project-form-dialog";

/* Fixed dark surfaces — these stay dark regardless of the app theme. */
const COLUMN_DOT: Record<TaskStatus, string> = {
  todo: "bg-zinc-400",
  in_progress: "bg-indigo-400",
  in_review: "bg-amber-400",
  done: "bg-emerald-400",
};

const PRIORITY_CHIP: Record<TaskPriority, string> = {
  low: "bg-white/12 text-indigo-100",
  medium: "bg-amber-400/20 text-amber-200",
  high: "bg-rose-500/20 text-rose-200",
};

interface ProjectDetailPageProps {
  id: string;
  tasks: Task[];
  userMap: Record<string, UserMini>;
}

export function ProjectDetailPage({
  id,
  tasks,
  userMap,
}: ProjectDetailPageProps) {
  const router = useRouter();
  const project = useProjectsStore((s) => s.projects.find((p) => p.id === id));
  const updateProject = useProjectsStore((s) => s.updateProject);
  const deleteProject = useProjectsStore((s) => s.deleteProject);

  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const leads = useMemo(
    () => Object.values(userMap).sort((a, b) => a.name.localeCompare(b.name)),
    [userMap],
  );

  if (!project) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Project not found"
        description="This project may have been deleted or created in another session."
        action={
          <Button render={<Link href="/projects" />} nativeButton={false}>
            Back to projects
          </Button>
        }
      />
    );
  }

  const status = PROJECT_STATUS_META[project.status];
  const health = budgetHealth(project);
  const counts = taskCounts(tasks);
  const atRisk = isAtRisk(project);
  const daysLeft = daysUntil(project.dueDate);
  const lead = userMap[project.leadUserId];

  const deadlineText =
    daysLeft === 0
      ? "Due today"
      : daysLeft < 0
        ? `${-daysLeft} days overdue`
        : `${daysLeft} days left`;

  const editInitial: Partial<ProjectFormValues> = {
    name: project.name,
    description: project.description ?? "",
    key: project.key,
    department: project.department,
    status: project.status,
    leadUserId: project.leadUserId,
    teamSize: project.memberIds.length,
    budget: project.budget,
    dueDate: project.dueDate.slice(0, 10),
  };

  const handleEdit = (values: ProjectFormValues) => {
    updateProject(project.id, values);
    toast.success("Project updated", {
      description: `“${values.name}” has been saved.`,
    });
  };

  const handleDelete = () => {
    deleteProject(project.id);
    setConfirmOpen(false);
    toast.success("Project deleted", {
      description: `“${project.name}” was removed.`,
    });
    router.push("/projects");
  };

  return (
    <div className="space-y-6">
      {/* Top bar: back + actions */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          All projects
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => setEditOpen(true)}
          >
            <Pencil className="size-4" />
            Edit project
          </Button>
          <Button
            variant="outline"
            className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Hero — filled with the active palette's feature colour (follows palette) */}
      <header
        className="relative overflow-hidden rounded-3xl border border-white/15 text-white shadow-[0_30px_80px_-40px_rgb(0_0_0/0.55)]"
        style={{
          backgroundImage:
            "linear-gradient(135deg, color-mix(in oklab, var(--feature) 86%, #ffffff 14%), var(--feature) 52%, color-mix(in oklab, var(--feature), #000000 26%))",
        }}
      >
        {/* Soft light glow for depth */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-white/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 left-1/3 size-72 rounded-full bg-white/10 blur-3xl"
        />

        <div className="relative flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-xs font-semibold tracking-wide text-indigo-200 ring-1 ring-white/10">
                {project.key}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/90 ring-1 ring-white/10">
                <span className="size-1.5 rounded-full bg-white/75" />
                {status.label}
              </span>
              {atRisk ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-amber-400/20">
                  <AlertTriangle className="size-3" />
                  At risk
                </span>
              ) : null}
            </div>

            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              {project.name}
            </h1>

            {project.description ? (
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/80">
                {project.description}
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/75">
              <span>{project.department}</span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarRange className="size-4" />
                {formatDate(project.startDate)} – {formatDate(project.dueDate)}
              </span>
              {lead ? (
                <span className="inline-flex items-center gap-1.5">
                  <Avatar size="sm" className="size-5 ring-1 ring-white/15">
                    {lead.avatarUrl ? (
                      <AvatarImage src={lead.avatarUrl} alt={lead.name} />
                    ) : null}
                    <AvatarFallback className="bg-white/10 text-[0.55rem] text-white">
                      {initials(lead.name)}
                    </AvatarFallback>
                  </Avatar>
                  Led by {lead.name}
                </span>
              ) : null}
            </div>
          </div>

          {/* Glassmorphic deadline card */}
          <div className="shrink-0 rounded-2xl border border-white/20 bg-white/10 px-5 py-4 shadow-lg backdrop-blur-md">
            <p className="text-xs font-medium tracking-wide text-white/80 uppercase">
              Deadline
            </p>
            <p
              className={cn(
                "mt-1 font-heading text-2xl font-semibold tabular-nums",
                daysLeft < 0 ? "text-rose-200" : "text-white",
              )}
            >
              {deadlineText}
            </p>
            <p className="mt-0.5 text-xs text-white/70">
              {formatDate(project.dueDate)}
            </p>
          </div>
        </div>
      </header>

      {/* KPI row: completion meter · budget · team size */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Completion meter */}
        <div className="flex flex-col items-center justify-center rounded-2xl border bg-card p-5">
          <p className="self-start text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Completion
          </p>
          <Gauge value={project.progress} label="of work done" size={172} />
          <p className="mt-1 text-xs text-muted-foreground">
            {counts.done} of {tasks.length} tasks done
          </p>
        </div>

        {/* Budget */}
        <div className="flex flex-col rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Budget
            </p>
            <span className="flex size-8 items-center justify-center rounded-full bg-feature-tint text-primary">
              <Wallet className="size-4" />
            </span>
          </div>
          <div className="mt-5 flex items-baseline gap-2">
            <span className="font-display text-3xl font-semibold tabular-nums">
              {Math.round(health.pct * 100)}%
            </span>
            <span className="text-sm text-muted-foreground">spent</span>
          </div>
          {/* Brand-themed meter (follows the active palette, not status colours) */}
          <ProgressTrack
            value={Math.min(100, health.pct * 100)}
            tone="primary"
            className="mt-3 h-2"
          />
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="tabular-nums text-muted-foreground">
              {formatMoney(project.spent)} / {formatMoney(project.budget)}
            </span>
            <span className="font-medium text-primary">{health.label}</span>
          </div>
        </div>

        {/* Team size */}
        <div className="flex flex-col rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Team size
            </p>
            <span className="flex size-8 items-center justify-center rounded-full bg-feature-tint text-primary">
              <Users className="size-4" />
            </span>
          </div>
          <div className="mt-5 flex items-baseline gap-2">
            <span className="font-display text-3xl font-semibold tabular-nums">
              {project.memberIds.length}
            </span>
            <span className="text-sm text-muted-foreground">members</span>
          </div>
          <div className="mt-auto pt-5">
            <MemberStack members={teamOf(project.memberIds, userMap)} max={6} />
          </div>
        </div>
      </div>

      {/* Tasks + team rail */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Tasks board */}
        <section className="space-y-3 lg:col-span-8">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-sm font-semibold tracking-wide uppercase">
              Tasks
            </h2>
            <span className="text-xs text-muted-foreground">
              {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {TASK_STATUS_ORDER.map((col) => (
              <BoardColumn
                key={col}
                col={col}
                tasks={tasks.filter((t) => t.status === col)}
                userMap={userMap}
              />
            ))}
          </div>
        </section>

        {/* Right rail: team details + members */}
        <aside className="space-y-6 lg:col-span-4">
          <Panel title="Team details">
            <dl className="space-y-3 text-sm">
              <DetailRow label="Lead" value={lead?.name ?? "—"} />
              <DetailRow label="Department" value={project.department} />
              <DetailRow
                label="Team size"
                value={`${project.memberIds.length} members`}
              />
              <DetailRow
                label="Status"
                value={<StatusBadge tone={status.tone} label={status.label} />}
              />
              <DetailRow
                label="Timeline"
                value={`${formatDate(project.startDate)} – ${formatDate(project.dueDate)}`}
              />
            </dl>
          </Panel>

          <Panel title="Team members">
            <ul className="space-y-3">
              {project.memberIds.map((mid) => {
                const u = userMap[mid];
                if (!u) return null;
                const isLead = mid === project.leadUserId;
                return (
                  <li key={mid} className="flex items-center gap-3">
                    <Avatar size="sm">
                      {u.avatarUrl ? (
                        <AvatarImage src={u.avatarUrl} alt={u.name} />
                      ) : null}
                      <AvatarFallback>{initials(u.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 leading-tight">
                      <p className="flex items-center gap-1 truncate text-sm font-medium">
                        {u.name}
                        {isLead ? (
                          <Crown
                            className="size-3 text-warning"
                            aria-label="Lead"
                          />
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {isLead ? "Project lead" : u.jobTitle}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </aside>
      </div>

      {/* Edit dialog */}
      <ProjectFormDialog
        mode="edit"
        open={editOpen}
        onOpenChange={setEditOpen}
        leads={leads}
        initial={editInitial}
        onSubmit={handleEdit}
      />

      {/* Delete confirm */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
            <DialogDescription>
              “{project.name}” will be removed for this session. This can’t be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------------------- helpers ------------------------------- */

function teamOf(
  memberIds: string[],
  userMap: Record<string, UserMini>,
): UserMini[] {
  return memberIds.map((id) => userMap[id]).filter(Boolean) as UserMini[];
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <p className="mb-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

/* Dark task column. */
function BoardColumn({
  col,
  tasks,
  userMap,
}: {
  col: TaskStatus;
  tasks: Task[];
  userMap: Record<string, UserMini>;
}) {
  const meta = TASK_STATUS_META[col];
  return (
    <div
      className="flex flex-col rounded-2xl border border-white/15 p-3 text-white"
      style={{ backgroundColor: "var(--feature)" }}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-white">
          <span className={cn("size-2 rounded-full", COLUMN_DOT[col])} />
          {meta.label}
        </span>
        <span className="text-xs tabular-nums text-white/60">
          {tasks.length}
        </span>
      </div>

      {tasks.length === 0 ? (
        <p className="px-1 py-6 text-center text-xs text-white/50">
          Nothing here
        </p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => {
            const assignee = t.assigneeId ? userMap[t.assigneeId] : null;
            return (
              <li
                key={t.id}
                className="rounded-xl border border-white/15 bg-white/10 p-3 transition-colors hover:border-white/30 hover:bg-white/[0.16]"
              >
                <p className="text-sm leading-snug text-white">{t.title}</p>
                <div className="mt-2.5 flex items-center justify-between">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium",
                      PRIORITY_CHIP[t.priority],
                    )}
                  >
                    {t.priority[0].toUpperCase() + t.priority.slice(1)}
                  </span>
                  {assignee ? (
                    <Avatar size="sm" className="size-6 ring-1 ring-white/10">
                      {assignee.avatarUrl ? (
                        <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
                      ) : null}
                      <AvatarFallback className="bg-white/10 text-[0.55rem] text-white">
                        {initials(assignee.name)}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <span className="text-xs text-white/55">Unassigned</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
