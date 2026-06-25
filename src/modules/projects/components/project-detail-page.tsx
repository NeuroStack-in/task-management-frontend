"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarRange,
  Crown,
  ListChecks,
  Pencil,
  Trash2,
  Users,
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
  TASK_PRIORITY_META,
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
  type Task,
  type TaskStatus,
} from "../types";
import {
  daysUntil,
  dueLabel,
  formatDate,
  isAtRisk,
  taskCounts,
  toneDot,
  toneSoft,
  type UserMini,
} from "../lib";
import {
  MemberStack,
  Segmented,
  StatusBadge,
  type SegmentedOption,
} from "./parts";
import { ProjectFormDialog } from "./project-form-dialog";

type TaskFilter = TaskStatus | "all";

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
  const [taskFilter, setTaskFilter] = useState<TaskFilter>("all");

  const leads = useMemo(
    () => Object.values(userMap).sort((a, b) => a.name.localeCompare(b.name)),
    [userMap],
  );

  const counts = useMemo(() => taskCounts(tasks), [tasks]);

  const visibleTasks = useMemo(() => {
    const list =
      taskFilter === "all"
        ? tasks
        : tasks.filter((t) => t.status === taskFilter);
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
  }, [tasks, taskFilter]);

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
  const atRisk = isAtRisk(project);
  const daysLeft = daysUntil(project.dueDate);
  const lead = userMap[project.leadUserId];
  const manager = project.managerId ? userMap[project.managerId] : null;

  const completed = counts.done;
  const pending = tasks.length - counts.done;

  const deadlineText =
    daysLeft === 0
      ? "Due today"
      : daysLeft < 0
        ? `${-daysLeft} days overdue`
        : `${daysLeft} days left`;

  const filterOptions: SegmentedOption<TaskFilter>[] = [
    { value: "all", label: "All", count: tasks.length },
    ...TASK_STATUS_ORDER.map((s) => ({
      value: s as TaskFilter,
      label: TASK_STATUS_META[s].label,
      count: counts[s],
    })),
  ];

  const editInitial: Partial<ProjectFormValues> = {
    name: project.name,
    description: project.description ?? "",
    department: project.department,
    leadUserId: project.leadUserId,
    managerId: project.managerId ?? "",
    memberIds: project.memberIds,
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
              <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-xs font-semibold tracking-wide text-white/90 ring-1 ring-white/10">
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

      {/* KPI row: completion meter · tasks · team size */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Completion meter */}
        <div className="flex flex-col items-center justify-center rounded-2xl border bg-card p-5">
          <p className="self-start text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Completion
          </p>
          <Gauge value={project.progress} label="of work done" size={172} />
          <p className="mt-1 text-xs text-muted-foreground">
            {completed} of {tasks.length} tasks done
          </p>
        </div>

        {/* Tasks: completed vs pending */}
        <div className="flex flex-col rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Tasks
            </p>
            <span className="flex size-8 items-center justify-center rounded-full bg-feature-tint text-primary">
              <ListChecks className="size-4" />
            </span>
          </div>
          <div className="mt-5 flex items-baseline gap-2">
            <span className="font-display text-3xl font-semibold tabular-nums">
              {tasks.length}
            </span>
            <span className="text-sm text-muted-foreground">total</span>
          </div>
          <div className="mt-auto grid grid-cols-2 gap-3 pt-5">
            <TaskStat label="Completed" value={completed} dot="bg-primary" />
            <TaskStat
              label="Pending"
              value={pending}
              dot="bg-muted-foreground/40"
            />
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

      {/* Tasks list + team rail */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Tasks list */}
        <section className="space-y-3 lg:col-span-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-heading text-sm font-semibold tracking-wide uppercase">
              Tasks
            </h2>
            <Segmented
              options={filterOptions}
              value={taskFilter}
              onChange={setTaskFilter}
              className="flex-wrap"
            />
          </div>

          {visibleTasks.length === 0 ? (
            <div className="rounded-2xl border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
              No tasks in this view.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border bg-card">
              <ul className="divide-y">
                {visibleTasks.map((t) => (
                  <TaskRow key={t.id} task={t} userMap={userMap} />
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Right rail: team details + members */}
        <aside className="space-y-6 lg:col-span-4">
          <Panel title="Team details">
            <dl className="space-y-3 text-sm">
              <DetailRow label="Lead" value={lead?.name ?? "—"} />
              {manager ? (
                <DetailRow label="Manager" value={manager.name} />
              ) : null}
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
                const isManager = mid === project.managerId;
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
                        {isLead
                          ? "Project lead"
                          : isManager
                            ? "Project manager"
                            : u.jobTitle}
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

function TaskStat({
  label,
  value,
  dot,
}: {
  label: string;
  value: number;
  dot: string;
}) {
  return (
    <div className="rounded-xl border bg-muted/30 px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={cn("size-1.5 rounded-full", dot)} />
        {label}
      </p>
      <p className="mt-1 font-heading text-xl font-semibold tabular-nums">
        {value}
      </p>
    </div>
  );
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

function TaskRow({
  task,
  userMap,
}: {
  task: Task;
  userMap: Record<string, UserMini>;
}) {
  const prio = TASK_PRIORITY_META[task.priority];
  const status = TASK_STATUS_META[task.status];
  const due = dueLabel(task.dueDate);
  const assignee = task.assigneeId ? userMap[task.assigneeId] : null;

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span
        className={cn("size-2 shrink-0 rounded-full", toneDot[prio.tone])}
        title={`${prio.label} priority`}
      />
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "truncate text-sm font-medium",
            task.status === "done" && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {assignee ? assignee.name : "Unassigned"}
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
      <StatusBadge tone={status.tone} label={status.label} className="shrink-0" />
      {assignee ? (
        <Avatar size="sm" className="size-7 shrink-0">
          {assignee.avatarUrl ? (
            <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
          ) : null}
          <AvatarFallback className="text-[0.6rem]">
            {initials(assignee.name)}
          </AvatarFallback>
        </Avatar>
      ) : null}
    </li>
  );
}
