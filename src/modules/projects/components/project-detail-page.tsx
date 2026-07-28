"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CalendarRange,
  ChevronRight,
  Crown,
  FileDown,
  FolderKanban,
  ListChecks,
  Pencil,
  Plus,
  Trash2,
  Users,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
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
import { PageHeader } from "@/components/shared/page-header";
import { Loader } from "@/components/shared/loader";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import type { ProjectFormValues } from "@/stores/projects.store";
import type { TaskFormValues } from "@/stores/tasks.store";
import { useProjectDetail } from "../use-project-detail";
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
import { MemberStack, Segmented, StatusBadge } from "./parts";
import { ProjectFormDialog } from "./project-form-dialog";
import { TaskFormDialog } from "./task-form-dialog";
import { generateProjectReportPdf } from "../report";

interface ProjectDetailPageProps {
  id: string;
}

export function ProjectDetailPage({ id }: ProjectDetailPageProps) {
  const { can } = usePermissions();
  const canManage = can("projects:manage");

  // Real backend. The server 404s a project the caller isn't a member of (no oversight bit), so the
  // "no access" case is `notFound` — there's no client-side scope check anymore.
  const {
    project,
    tasks,
    userMap,
    loading,
    error,
    notFound,
    reload,
    updateProject,
    createTask,
    updateTaskFull,
    moveTask,
  } = useProjectDetail(id);

  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [createStatus, setCreateStatus] = useState<TaskStatus>("todo");
  const [taskView, setTaskView] = useState<"board" | "list">("board");
  const [teamOpen, setTeamOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const members = useMemo(
    () => Object.values(userMap).sort((a, b) => a.name.localeCompare(b.name)),
    [userMap],
  );

  const counts = useMemo(() => taskCounts(tasks), [tasks]);

  if (loading && !project) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader label="Loading project…" />
      </div>
    );
  }

  if (notFound || (!loading && !project)) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Project not found"
        description="This project may have been deleted, or you're not a member of it."
        action={
          <Button render={<Link href="/projects" />} nativeButton={false}>
            Back to projects
          </Button>
        }
      />
    );
  }

  if (error || !project) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="Couldn't load the project"
        description={error ?? "Something went wrong."}
        action={
          <Button variant="outline" onClick={reload}>
            Retry
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

  const editInitial: Partial<ProjectFormValues> = {
    name: project.name,
    description: project.description ?? "",
    department: project.department,
    leadUserId: project.leadUserId,
    managerId: project.managerId ?? "",
    memberIds: project.memberIds,
    dueDate: project.dueDate.slice(0, 10),
    // Must be carried: omitting it would pre-fill the form as non-billable and silently
    // reclassify a billable project on save.
    billable: project.billable,
  };

  const handleEdit = async (values: ProjectFormValues) => {
    try {
      await updateProject(values);
      toast.success("Project updated", { description: `“${values.name}” saved.` });
    } catch (e) {
      // A partial save has its own message (the details went through, the team didn't). Showing the
      // generic "try again" there would be a second lie on top of the one this fixes.
      toast.error(
        e instanceof Error && e.message
          ? e.message
          : "Couldn't save the project. Try again.",
      );
    }
  };

  const handleDelete = () => {
    // No delete-project endpoint exists yet (LLD lists delete_project; it isn't built). Rather than
    // fake a client-only delete that reappears on reload, say so plainly.
    setConfirmOpen(false);
    toast.info("Project deletion isn't available yet.");
  };

  const openCreateTask = (s: TaskStatus) => {
    setEditingTask(null);
    setCreateStatus(s);
    setTaskOpen(true);
  };
  const openEditTask = (t: Task) => {
    setEditingTask(t);
    setTaskOpen(true);
  };
  const handleTaskSubmit = async (values: TaskFormValues) => {
    try {
      if (editingTask) {
        await updateTaskFull(editingTask.id, values);
        toast.success("Task updated", { description: values.title });
      } else {
        await createTask(values);
        toast.success("Task added", { description: values.title });
      }
      setTaskOpen(false);
    } catch (e) {
      const msg =
        e instanceof Error && e.message ? e.message : "Couldn't save the task. Try again.";
      toast.error(msg);
    }
  };

  const taskInitial = editingTask
    ? {
        title: editingTask.title,
        status: editingTask.status,
        assigneeId: editingTask.assigneeId ?? "",
        priority: editingTask.priority,
        dueDate: editingTask.dueDate?.slice(0, 10) ?? "",
        estimateHours: editingTask.estimateHours,
      }
    : { status: createStatus };

  const downloadReport = () => {
    void generateProjectReportPdf(project, tasks, userMap).then(() =>
      toast.success("Report generated", {
        description: `${project.key}-project-report.pdf`,
      }),
    );
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const target = over.id as TaskStatus;
    const moved = tasks.find((t) => t.id === active.id);
    if (
      moved &&
      moved.status !== target &&
      TASK_STATUS_ORDER.includes(target)
    ) {
      moveTask(moved.id, target);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Title + actions live in the top navbar; the back link stays in-page. */}
      <PageHeader
        title={project.name}
        actions={
          <>
            <Button
              variant="outline"
              className="gap-1.5"
              onClick={downloadReport}
            >
              <FileDown className="size-4" />
              Report (PDF)
            </Button>
            {canManage ? (
              <>
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
              </>
            ) : null}
          </>
        }
      />

      <Link
        href="/projects"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        All projects
      </Link>

      {/* Hero — filled with the active palette's feature colour */}
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
              <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[0.7rem] text-white/70 ring-1 ring-white/10">
                ID: {project.id}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/90 ring-1 ring-white/10">
                <span className="size-1.5 rounded-full bg-white/75" />
                {status.label}
              </span>
              {atRisk ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-amber-400/20">
                  <AlertTriangle className="size-3" />
                  Overdue
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
              {/* Conditional: an unset department must leave no empty span, which is what put a
                  phantom gap before the date range on every project that had none. */}
              {project.department ? (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 className="size-4" />
                  {project.department}
                </span>
              ) : null}
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

      {/* KPI row */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col items-center justify-center rounded-2xl border bg-card p-5">
          <p className="self-start text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Progress
          </p>
          <Gauge value={project.progress} label="of work done" size={172} />
          <p className="mt-1 text-xs text-muted-foreground">
            {completed} of {tasks.length} tasks done
          </p>
        </div>

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
            <TaskStat label="Done" value={completed} dot="bg-primary" />
            <TaskStat
              label="Open"
              value={pending}
              dot="bg-muted-foreground/40"
            />
          </div>
        </div>

        <div className="flex flex-col rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Team details
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
          <div className="mt-auto flex items-center justify-between gap-2 pt-5">
            <MemberStack members={teamOf(project.memberIds, userMap)} max={6} />
            <button
              type="button"
              onClick={() => setTeamOpen(true)}
              className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary transition-colors hover:text-primary/80"
            >
              View more
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tasks — full width */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-sm font-semibold tracking-wide uppercase">
            Tasks
          </h2>
          <div className="flex items-center gap-2">
            <Segmented
              options={[
                { value: "board", label: "Board" },
                { value: "list", label: "List" },
              ]}
              value={taskView}
              onChange={setTaskView}
            />
            <Button
              className="h-auto gap-1.5 rounded-xl px-4 py-2.5 text-sm"
              onClick={() => openCreateTask("todo")}
            >
              <Plus className="size-4" />
              Add task
            </Button>
          </div>
        </div>

        {taskView === "board" ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragEnd={handleDragEnd}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {TASK_STATUS_ORDER.map((col) => (
                <KanbanColumn
                  key={col}
                  col={col}
                  tasks={tasks.filter((t) => t.status === col)}
                  userMap={userMap}
                  onAdd={() => openCreateTask(col)}
                  onEdit={openEditTask}
                />
              ))}
            </div>
          </DndContext>
        ) : (
          <TaskListView
            tasks={tasks}
            userMap={userMap}
            onEdit={openEditTask}
            onAdd={() => openCreateTask("todo")}
          />
        )}
      </section>

      {/* Project edit dialog */}
      <ProjectFormDialog
        mode="edit"
        open={editOpen}
        onOpenChange={setEditOpen}
        leads={members}
        initial={editInitial}
        onSubmit={handleEdit}
      />

      {/* Task add/edit dialog */}
      <TaskFormDialog
        mode={editingTask ? "edit" : "create"}
        open={taskOpen}
        onOpenChange={setTaskOpen}
        members={members}
        initial={taskInitial}
        onSubmit={handleTaskSubmit}
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

      {/* Full team & details */}
      <Dialog open={teamOpen} onOpenChange={setTeamOpen}>
        <DialogContent className="flex max-h-[88vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          {/* Header band */}
          <DialogHeader className="gap-0 border-b px-6 py-5 pr-12 text-left">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-feature-tint text-primary">
                <FolderKanban className="size-5" />
              </span>
              <div className="min-w-0">
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  {project.name}
                  <StatusBadge tone={status.tone} label={status.label} />
                </DialogTitle>
                <DialogDescription className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Mono>{project.key}</Mono>
                  <Mono>{project.id}</Mono>
                  {project.department ? <span>· {project.department}</span> : null}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Scrollable body */}
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {project.description ? (
              <section>
                <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  About
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {project.description}
                </p>
              </section>
            ) : null}

            {/* Details */}
            <section>
              <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Details
              </p>
              <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                <DetailRow label="Lead" value={lead?.name ?? "—"} />
                <DetailRow label="Manager" value={manager?.name ?? "—"} />
                <DetailRow label="Department" value={project.department || "—"} />
                <DetailRow
                  label="Billing"
                  value={project.billable ? "Billable" : "Non-billable"}
                />
                <DetailRow
                  label="Timeline"
                  value={`${formatDate(project.startDate)} – ${formatDate(project.dueDate)}`}
                />
                <DetailRow
                  label="Status"
                  value={<StatusBadge tone={status.tone} label={status.label} />}
                />
                <DetailRow
                  label="Health"
                  value={
                    atRisk ? (
                      <span className="font-medium text-warning">Overdue</span>
                    ) : (
                      <span className="font-medium text-success">On track</span>
                    )
                  }
                />
                <DetailRow label="Key" value={<Mono>{project.key}</Mono>} />
                <DetailRow label="Project ID" value={<Mono>{project.id}</Mono>} />
              </dl>
            </section>

            {/* Members */}
            <section>
              <p className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Members · {project.memberIds.length}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {project.memberIds.map((mid) => {
                  const u = userMap[mid];
                  if (!u) return null;
                  const isLead = mid === project.leadUserId;
                  const isManager = mid === project.managerId;
                  return (
                    <div
                      key={mid}
                      className="flex items-center gap-3 rounded-xl border p-3"
                    >
                      <Avatar size="sm">
                        {u.avatarUrl ? (
                          <AvatarImage src={u.avatarUrl} alt={u.name} />
                        ) : null}
                        <AvatarFallback>{initials(u.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 leading-tight">
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
                          {u.jobTitle}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-medium",
                          isLead
                            ? "bg-warning/15 text-warning"
                            : isManager
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground",
                        )}
                      >
                        {isLead ? "Lead" : isManager ? "Manager" : "Member"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
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

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
      {children}
    </span>
  );
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

function KanbanColumn({
  col,
  tasks,
  userMap,
  onAdd,
  onEdit,
}: {
  col: TaskStatus;
  tasks: Task[];
  userMap: Record<string, UserMini>;
  onAdd: () => void;
  onEdit: (t: Task) => void;
}) {
  const meta = TASK_STATUS_META[col];
  const { setNodeRef, isOver } = useDroppable({ id: col });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[140px] flex-col rounded-2xl border bg-muted/40 p-3 transition-colors",
        isOver && "bg-primary/5 ring-2 ring-primary/40",
      )}
    >
      <div className="mb-3 flex items-center px-1">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
          <span className={cn("size-2 rounded-full", toneDot[meta.tone])} />
          {meta.label}
          <span className="text-muted-foreground tabular-nums">
            {tasks.length}
          </span>
        </span>
      </div>

      {tasks.length === 0 ? (
        <button
          type="button"
          onClick={onAdd}
          className="rounded-xl border border-dashed py-6 text-center text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
        >
          Add a task
        </button>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} userMap={userMap} onEdit={onEdit} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskCard({
  task,
  userMap,
  onEdit,
}: {
  task: Task;
  userMap: Record<string, UserMini>;
  onEdit: (t: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });
  const style = transform
    ? {
        transform: `${CSS.Translate.toString(transform)} rotate(2deg)`,
        zIndex: 50,
      }
    : undefined;

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group/task relative cursor-grab touch-none rounded-xl border bg-card p-3 active:cursor-grabbing",
        isDragging && "shadow-xl ring-2 ring-primary/30",
      )}
    >
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onEdit(task)}
        aria-label="Edit task"
        className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover/task:opacity-100"
      >
        <Pencil className="size-3.5" />
      </button>
      <TaskCardContent task={task} userMap={userMap} />
    </li>
  );
}

function TaskListView({
  tasks,
  userMap,
  onEdit,
  onAdd,
}: {
  tasks: Task[];
  userMap: Record<string, UserMini>;
  onEdit: (t: Task) => void;
  onAdd: () => void;
}) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-10 text-center">
        <p className="text-sm text-muted-foreground">No tasks yet.</p>
        <Button
          size="sm"
          variant="outline"
          className="mt-3 gap-1.5"
          onClick={onAdd}
        >
          <Plus className="size-4" /> Add task
        </Button>
      </div>
    );
  }

  const order: Record<TaskStatus, number> = {
    todo: 0,
    in_progress: 1,
    in_review: 2,
    done: 3,
    blocked: 4,
  };
  const sorted = [...tasks].sort((a, b) => {
    if (order[a.status] !== order[b.status])
      return order[a.status] - order[b.status];
    const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return ad - bd;
  });

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      {/* Column header — aligns with the fixed-width cells below */}
      <div className="hidden items-center gap-4 border-b bg-muted/40 px-4 py-2.5 text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase sm:flex">
        <span className="flex-1 pl-5">Task</span>
        <span className="w-24 shrink-0">Due</span>
        <span className="hidden w-24 shrink-0 md:block">Priority</span>
        <span className="w-24 shrink-0">Status</span>
        <span className="w-44 shrink-0">Assignee</span>
      </div>

      <ul className="divide-y">
        {sorted.map((t) => {
          const prio = TASK_PRIORITY_META[t.priority];
          const status = TASK_STATUS_META[t.status];
          const assignee = t.assigneeId ? userMap[t.assigneeId] : null;
          const due = dueLabel(t.dueDate);
          return (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onEdit(t)}
                className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                {/* Task */}
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      toneDot[prio.tone],
                    )}
                    title={`${prio.label} priority`}
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm font-medium",
                      t.status === "done" &&
                        "text-muted-foreground line-through",
                    )}
                  >
                    {t.title}
                  </span>
                </span>

                {/* Due */}
                <span
                  className={cn(
                    "hidden w-24 shrink-0 text-xs tabular-nums sm:block",
                    t.dueDate
                      ? due.overdue
                        ? "text-destructive"
                        : "text-muted-foreground"
                      : "text-muted-foreground/40",
                  )}
                >
                  {t.dueDate ? due.text : "—"}
                </span>

                {/* Priority */}
                <span className="hidden w-24 shrink-0 md:block">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                      toneSoft[prio.tone],
                    )}
                  >
                    {prio.label}
                  </span>
                </span>

                {/* Status */}
                <span className="w-24 shrink-0">
                  <StatusBadge tone={status.tone} label={status.label} />
                </span>

                {/* Assignee — avatar from sm, name added at lg */}
                <span className="hidden w-44 shrink-0 items-center gap-2 sm:flex">
                  {assignee ? (
                    <>
                      <Avatar size="sm" className="size-6 shrink-0">
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
                      <span className="hidden truncate text-xs text-muted-foreground lg:inline">
                        {assignee.name}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground/50">
                      Unassigned
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TaskCardContent({
  task,
  userMap,
}: {
  task: Task;
  userMap: Record<string, UserMini>;
}) {
  const prio = TASK_PRIORITY_META[task.priority];
  const assignee = task.assigneeId ? userMap[task.assigneeId] : null;
  const due = dueLabel(task.dueDate);
  return (
    <>
      <p className="pr-6 text-sm leading-snug font-medium">{task.title}</p>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium",
            toneSoft[prio.tone],
          )}
        >
          {prio.label}
        </span>
        <div className="flex items-center gap-2">
          {task.dueDate ? (
            <span
              className={cn(
                "text-[0.7rem] tabular-nums",
                due.overdue ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {due.text}
            </span>
          ) : null}
          {assignee ? (
            <Avatar size="sm" className="size-6">
              {assignee.avatarUrl ? (
                <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
              ) : null}
              <AvatarFallback className="text-[0.55rem]">
                {initials(assignee.name)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <span className="text-[0.7rem] text-muted-foreground/60">
              Unassigned
            </span>
          )}
        </div>
      </div>
    </>
  );
}
