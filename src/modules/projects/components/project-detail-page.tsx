"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarRange,
  ChevronRight,
  Crown,
  Eye,
  FileDown,
  FolderKanban,
  ListChecks,
  Pencil,
  Plus,
  Star,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api";
import { Gauge } from "@/components/shared/gauge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Loader } from "@/components/shared/loader";
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
  TASK_STATUS_SETTABLE,
  type SettableTaskStatus,
  type Task,
  type TaskStatus,
} from "../types";
import {
  canDeleteTask,
  canReviewTask,
  daysUntil,
  dueLabel,
  formatDate,
  isAtRisk,
  selectablePeople,
  taskCounts,
  toneDot,
  toneSoft,
  type UserMini,
} from "../lib";
import { useAuthStore } from "@/stores/auth.store";
import { MemberStack, Segmented, StatusBadge } from "./parts";
import { ProjectFormDialog } from "./project-form-dialog";
import { TaskReviewDialog } from "./task-review-dialog";
import { TaskFormDialog } from "./task-form-dialog";
import { ViewTaskDialog } from "./view-task-dialog";
import { generateProjectReportPdf } from "../report";

interface ProjectDetailPageProps {
  id: string;
}

export function ProjectDetailPage({ id }: ProjectDetailPageProps) {
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
    deleteProject,
    createTask,
    updateTaskFull,
    moveTask,
    deleteTask,
    authority,
  } = useProjectDetail(id);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);

  /**
   * Project administration — **the server's resolved authority, not an org-wide bit.**
   *
   * This used to read `can("projects:manage")`, which was wrong in both directions. A project's own
   * Manager who didn't also hold the org bit could not see "Edit project" for a project they run;
   * and the org bit is what an admin would have to grant every employee to unblock task work, which
   * would make them Manager of every project instead.
   *
   * `authority` is what the API returns precisely so the UI renders the server's answer rather than
   * re-deriving the matrix (LLD §5). Task actions need no gate at all now — any member of a project
   * may add and assign tasks, which is why "Add task" is always offered.
   */
  const router = useRouter();
  const canManageProject = authority === "manager";

  /**
   * Who may delete which task — the same rule the server enforces (`projects::delete_task`):
   * Manager/Lead (and an admin with `projects:manage`, which resolves to `manager`) delete any task;
   * everyone else deletes only what they created. Rendered per-task rather than as one page-level
   * flag, because for a Member the answer genuinely differs card by card.
   */
  const canDelete = (t: Task) => canDeleteTask(t, authority, currentUserId);
  /** Mirrors the server: Manager|Lead, only on a `done` task, never your own. */
  const canReview = (t: Task) => canReviewTask(t, authority, currentUserId);
  const [reviewTarget, setReviewTarget] = useState<Task | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Separate from `deleting` above, which belongs to the task-delete dialog — one shared flag would
  // let an in-flight task delete disable the project dialog's buttons.
  const [deletingProject, setDeletingProject] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [createStatus, setCreateStatus] = useState<SettableTaskStatus>("todo");
  const [taskView, setTaskView] = useState<"board" | "list">("board");
  const [teamOpen, setTeamOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const members = useMemo(
    // Deleted employees are excluded: a purged identity must not be assignable as lead/manager.
    () => selectablePeople(userMap),
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

  const dayWord = (n: number) => (n === 1 ? "day" : "days");
  const deadlineText =
    daysLeft === 0
      ? "Due today"
      : daysLeft < 0
        ? `${-daysLeft} ${dayWord(-daysLeft)} overdue`
        : `${daysLeft} ${dayWord(daysLeft)} left`;

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

  const handleDelete = async () => {
    setDeletingProject(true);
    try {
      await deleteProject();
      setConfirmOpen(false);
      toast.success("Project deleted", { description: project?.name });
      // The project is gone, so this route would 404 on any re-render. Leave for the list, and
      // `refresh()` so the list re-fetches instead of serving a cached page that still shows it.
      router.push("/projects");
      router.refresh();
    } catch (e) {
      // Stay on the dialog: the project still exists, and the delete is safe to retry — the server
      // pass is idempotent and finishes whatever a partial run left behind.
      toast.error(
        e instanceof Error && e.message
          ? e.message
          : "Couldn't delete the project. Try again.",
      );
    } finally {
      setDeletingProject(false);
    }
  };

  const openCreateTask = (s: SettableTaskStatus) => {
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
        e instanceof Error && e.message
          ? e.message
          : "Couldn't save the task. Try again.";
      toast.error(msg);
    }
  };

  const handleTaskDelete = async () => {
    if (!taskToDelete) return;
    setDeleting(true);
    try {
      await deleteTask(taskToDelete.id);
      toast.success("Task deleted", { description: taskToDelete.title });
      setTaskToDelete(null);
    } catch (e) {
      // 403 is the one outcome worth naming: the gate above should have hidden the button, so
      // reaching it means the server disagreed — a stale board, or a role that changed underfoot.
      const denied = e instanceof ApiError && e.status === 403;
      toast.error(
        denied
          ? "You can only delete tasks you created. Ask a project lead to remove this one."
          : e instanceof Error && e.message
            ? e.message
            : "Couldn't delete the task. Try again.",
      );
      if (denied) reload();
    } finally {
      setDeleting(false);
    }
  };

  const taskInitial = editingTask
    ? {
        title: editingTask.title,
        description: editingTask.description,
        // A closed task has no editable "closed" option — the form only offers the settable
        // statuses. Showing `done` is the honest neighbour: it is the state the review moved it
        // out of, and reopening by saving is a deliberate act rather than an accident of the form.
        status: editingTask.status === "closed" ? ("done" as const) : editingTask.status,
        assigneeId: editingTask.assigneeId ?? "",
        priority: editingTask.priority,
        dueDate: editingTask.dueDate?.slice(0, 10) ?? "",
        estimateHours: editingTask.estimateHours,
        // Back to wire shape (`content_type`) — the dialog sends this straight into the request.
        attachments: editingTask.attachments.map((a) => ({
          id: a.id,
          filename: a.filename,
          content_type: a.contentType,
          size: a.size,
        })),
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
    if (moved && moved.status !== target && TASK_STATUS_SETTABLE.includes(target)) {
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
            <Button variant="outline" className="gap-1.5" onClick={downloadReport}>
              <FileDown className="size-4" />
              Report (PDF)
            </Button>
            {canManageProject ? (
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
                  className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
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
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm font-medium transition-colors"
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

            <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
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
                "font-heading mt-1 text-2xl font-semibold tabular-nums",
                daysLeft < 0 ? "text-rose-200" : "text-white",
              )}
            >
              {deadlineText}
            </p>
            <p className="mt-0.5 text-xs text-white/70">{formatDate(project.dueDate)}</p>
          </div>
        </div>
      </header>

      {/* KPI row */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-card flex flex-col items-center justify-center rounded-2xl border p-5">
          <p className="text-muted-foreground self-start text-xs font-medium tracking-wide uppercase">
            Progress
          </p>
          {/* Gauge and caption share ONE source — the live board (done / total tasks) — so the
              percentage and the "N of M" can never disagree. (The aggregator's cached
              `project.progress` can lag the board, which made the gauge look wrong.) */}
          <Gauge
            value={tasks.length ? Math.round((completed / tasks.length) * 100) : 0}
            label="of work done"
            size={172}
          />
          <p className="text-muted-foreground mt-1 text-xs">
            {completed} of {tasks.length} tasks done
          </p>
        </div>

        <div className="bg-card flex flex-col rounded-2xl border p-5">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Tasks
            </p>
            <span className="bg-feature-tint text-primary flex size-8 items-center justify-center rounded-full">
              <ListChecks className="size-4" />
            </span>
          </div>
          <div className="mt-5 flex items-baseline gap-2">
            <span className="font-display text-3xl font-semibold tabular-nums">
              {tasks.length}
            </span>
            <span className="text-muted-foreground text-sm">total</span>
          </div>
          <div className="mt-auto grid grid-cols-2 gap-3 pt-5">
            <TaskStat label="Done" value={completed} dot="bg-primary" />
            <TaskStat label="Open" value={pending} dot="bg-muted-foreground/40" />
          </div>
        </div>

        <div className="bg-card flex flex-col rounded-2xl border p-5">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Team details
            </p>
            <span className="bg-feature-tint text-primary flex size-8 items-center justify-center rounded-full">
              <Users className="size-4" />
            </span>
          </div>
          <div className="mt-5 flex items-baseline gap-2">
            <span className="font-display text-3xl font-semibold tabular-nums">
              {project.memberIds.length}
            </span>
            <span className="text-muted-foreground text-sm">members</span>
          </div>
          <div className="mt-auto flex items-center justify-between gap-2 pt-5">
            <MemberStack members={teamOf(project.memberIds, userMap)} max={6} />
            <button
              type="button"
              onClick={() => setTeamOpen(true)}
              className="text-primary hover:text-primary/80 inline-flex shrink-0 items-center gap-0.5 text-xs font-medium transition-colors"
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
                  // No "add" on Closed: a task cannot be created already signed off, and the
                  // column exists to show what has been reviewed, not to collect new work.
                  onAdd={
                    col === "closed" ? undefined : () => openCreateTask(col)
                  }
                  onView={setViewingTask}
                  onEdit={openEditTask}
                  onDelete={setTaskToDelete}
                  canDelete={canDelete}
                  canReview={canReview}
                  onReview={setReviewTarget}
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
            onDelete={setTaskToDelete}
            canDelete={canDelete}
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
        projectId={project.id}
        members={members}
        initial={taskInitial}
        onSubmit={handleTaskSubmit}
      />

      {/* Read-only task view */}
      <ViewTaskDialog
        task={viewingTask}
        projectId={project.id}
        open={!!viewingTask}
        onOpenChange={(o) => !o && setViewingTask(null)}
        userMap={userMap}
      />

      {reviewTarget ? (
        <TaskReviewDialog
          open
          onOpenChange={(o) => !o && setReviewTarget(null)}
          projectId={project.id}
          taskId={reviewTarget.id}
          taskTitle={reviewTarget.title}
          onReviewed={() => {
            setReviewTarget(null);
            void reload();
          }}
        />
      ) : null}

      {/* Delete confirm */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
            <DialogDescription>
              “{project.name}” and everything in it — every task, its team list and its
              progress — will be permanently deleted. Logged hours are kept, but they will no
              longer name this project. This can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deletingProject}
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-destructive hover:bg-destructive/90 text-white"
              disabled={deletingProject}
              onClick={handleDelete}
            >
              {deletingProject ? "Deleting…" : "Delete project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task delete confirm — deletion is irreversible and takes the context for any hours logged
          against the task with it, so it always asks, even for a Manager. */}
      <Dialog
        open={taskToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setTaskToDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete task?</DialogTitle>
            <DialogDescription>
              “{taskToDelete?.title}” will be permanently removed from this project. This
              can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={deleting}
              onClick={() => setTaskToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              className="bg-destructive hover:bg-destructive/90 text-white"
              disabled={deleting}
              onClick={handleTaskDelete}
            >
              {deleting ? "Deleting…" : "Delete task"}
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
              <span className="bg-feature-tint text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
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
                <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
                  About
                </p>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {project.description}
                </p>
              </section>
            ) : null}

            {/* Details */}
            <section>
              <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
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
                      <span className="text-warning font-medium">Overdue</span>
                    ) : (
                      <span className="text-success font-medium">On track</span>
                    )
                  }
                />
                <DetailRow label="Key" value={<Mono>{project.key}</Mono>} />
                <DetailRow label="Project ID" value={<Mono>{project.id}</Mono>} />
              </dl>
            </section>

            {/* Members */}
            <section>
              <p className="text-muted-foreground mb-3 text-xs font-medium tracking-wide uppercase">
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
                            <Crown className="text-warning size-3" aria-label="Lead" />
                          ) : null}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
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

function teamOf(memberIds: string[], userMap: Record<string, UserMini>): UserMini[] {
  return memberIds.map((id) => userMap[id]).filter(Boolean) as UserMini[];
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">{children}</span>
  );
}

function TaskStat({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="bg-muted/30 rounded-xl border px-3 py-2.5">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <span className={cn("size-1.5 rounded-full", dot)} />
        {label}
      </p>
      <p className="font-heading mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
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
  onView,
  onEdit,
  onDelete,
  canDelete,
  canReview,
  onReview,
}: {
  col: TaskStatus;
  tasks: Task[];
  userMap: Record<string, UserMini>;
  /** Absent on a column that cannot accept new work (Closed). */
  onAdd?: () => void;
  onView: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  canDelete: (t: Task) => boolean;
  canReview: (t: Task) => boolean;
  onReview: (t: Task) => void;
}) {
  const meta = TASK_STATUS_META[col];
  const { setNodeRef, isOver } = useDroppable({ id: col });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "bg-muted/40 flex min-h-[140px] flex-col rounded-2xl border p-3 transition-colors",
        isOver && "bg-primary/5 ring-primary/40 ring-2",
      )}
    >
      <div className="mb-3 flex items-center px-1">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
          <span className={cn("size-2 rounded-full", toneDot[meta.tone])} />
          {meta.label}
          <span className="text-muted-foreground tabular-nums">{tasks.length}</span>
        </span>
      </div>

      {tasks.length === 0 ? (
        <button
          type="button"
          onClick={onAdd}
          hidden={!onAdd}
          className="text-muted-foreground hover:border-primary/40 hover:text-foreground rounded-xl border border-dashed py-6 text-center text-xs transition-colors"
        >
          Add a task
        </button>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              userMap={userMap}
              onView={onView}
              onEdit={onEdit}
              onDelete={canDelete(t) ? onDelete : undefined}
              onReview={canReview(t) ? onReview : undefined}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskCard({
  task,
  onReview,
  userMap,
  onView,
  onEdit,
  onDelete,
}: {
  task: Task;
  userMap: Record<string, UserMini>;
  /** Open the read-only view of this task. */
  onView: (t: Task) => void;
  onEdit: (t: Task) => void;
  /** Absent when the caller may not delete this task — see `canDeleteTask`. */
  onDelete?: (t: Task) => void;
  /** Present only when this person may sign this task off — absent hides the action entirely. */
  onReview?: (t: Task) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });
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
        "group/task bg-card relative cursor-grab touch-none rounded-xl border p-3 active:cursor-grabbing",
        isDragging && "ring-primary/30 shadow-xl ring-2",
      )}
    >
      {/* Both actions stop the pointer from reaching the drag sensor — otherwise a click on the
          icon starts a drag and the button never fires.

          A solid, bordered pill (not a bare icon row): a `done` task carries up to three actions
          (edit · review · delete), which is wider than the title's right padding, so a bare row
          overlapped the title text. The opaque pill floats over the top-right corner cleanly on
          hover instead, and the title stays full-width when the card isn't hovered. */}
      <div className="bg-card absolute top-1.5 right-1.5 flex items-center gap-0.5 rounded-lg border p-0.5 opacity-0 shadow-sm transition-opacity group-hover/task:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onView(task)}
          aria-label="View task"
          title="View task"
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-6 items-center justify-center rounded-md"
        >
          <Eye className="size-3.5" />
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onEdit(task)}
          aria-label="Edit task"
          className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-6 items-center justify-center rounded-md"
        >
          <Pencil className="size-3.5" />
        </button>
        {/* Sign-off, shown only on a `done` task this person may review — the assignee never sees
            it on their own work. Absent rather than disabled: a greyed-out approve button on your
            own task reads as "ask someone", which is not what it means. */}
        {onReview ? (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onReview(task)}
            aria-label="Review and close task"
            title="Review and close"
            className="text-muted-foreground hover:bg-warning/10 hover:text-warning flex size-6 items-center justify-center rounded-md"
          >
            <Star className="size-3.5" />
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onDelete(task)}
            aria-label="Delete task"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex size-6 items-center justify-center rounded-md"
          >
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
      </div>
      <TaskCardContent task={task} userMap={userMap} />
    </li>
  );
}

function TaskListView({
  tasks,
  userMap,
  onEdit,
  onAdd,
  onDelete,
  canDelete,
}: {
  tasks: Task[];
  userMap: Record<string, UserMini>;
  onEdit: (t: Task) => void;
  onAdd: () => void;
  onDelete: (t: Task) => void;
  canDelete: (t: Task) => boolean;
}) {
  if (tasks.length === 0) {
    return (
      <div className="bg-card rounded-2xl border p-10 text-center">
        <p className="text-muted-foreground text-sm">No tasks yet.</p>
        {onAdd ? (
          <Button size="sm" variant="outline" className="mt-3 gap-1.5" onClick={onAdd}>
            <Plus className="size-4" /> Add task
          </Button>
        ) : null}
      </div>
    );
  }

  const order: Record<TaskStatus, number> = {
    todo: 0,
    in_progress: 1,
    in_review: 2,
    done: 3,
    closed: 4,
    blocked: 5,
  };
  const sorted = [...tasks].sort((a, b) => {
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    const ad = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bd = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return ad - bd;
  });

  return (
    <div className="bg-card overflow-hidden rounded-2xl border">
      {/* Column header — aligns with the fixed-width cells below */}
      <div className="bg-muted/40 text-muted-foreground hidden items-center gap-4 border-b px-4 py-2.5 text-[0.7rem] font-medium tracking-wide uppercase sm:flex">
        <span className="flex-1 pl-5">Task</span>
        <span className="w-24 shrink-0">Due</span>
        <span className="hidden w-24 shrink-0 md:block">Priority</span>
        <span className="w-24 shrink-0">Status</span>
        <span className="w-44 shrink-0">Assignee</span>
        {/* Spacer keeping the header aligned with the row's trailing action cell. */}
        <span className="w-8 shrink-0" aria-hidden />
      </div>

      <ul className="divide-y">
        {sorted.map((t) => {
          const prio = TASK_PRIORITY_META[t.priority];
          const status = TASK_STATUS_META[t.status];
          const assignee = t.assigneeId ? userMap[t.assigneeId] : null;
          const due = dueLabel(t.dueDate);
          const deletable = canDelete(t);
          return (
            // The row is a flex container rather than one big button: a delete control nested
            // inside a button is invalid HTML and doesn't reliably receive the click.
            <li
              key={t.id}
              className="group/row hover:bg-muted/50 flex items-center pr-4 transition-colors"
            >
              <button
                type="button"
                onClick={() => onEdit(t)}
                className="flex min-w-0 flex-1 items-center gap-4 py-3 pl-4 text-left"
              >
                {/* Task */}
                <span className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className={cn("size-2 shrink-0 rounded-full", toneDot[prio.tone])}
                    title={`${prio.label} priority`}
                  />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-sm font-medium",
                      t.status === "done" && "text-muted-foreground line-through",
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
                          <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
                        ) : null}
                        <AvatarFallback className="text-[0.55rem]">
                          {initials(assignee.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-muted-foreground hidden truncate text-xs lg:inline">
                        {assignee.name}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground/50 text-xs">Unassigned</span>
                  )}
                </span>
              </button>

              {/* Always occupies its cell so rows stay aligned whether or not the action shows. */}
              <span className="ml-4 flex w-8 shrink-0 items-center justify-center">
                {deletable ? (
                  <button
                    type="button"
                    onClick={() => onDelete(t)}
                    aria-label={`Delete ${t.title}`}
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex size-7 items-center justify-center rounded-md opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                ) : null}
              </span>
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

      {/* Who signed this off, on the card itself — the question the review step exists to answer,
          so it should not need a click. `reviewer_name` was resolved server-side at review time, so
          it still reads correctly after the reviewer leaves the org. */}
      {task.review ? (
        <p className="text-muted-foreground mt-1.5 flex items-center gap-1 text-[0.7rem]">
          <Star className="fill-warning text-warning size-3" />
          <span className="font-medium tabular-nums">{task.review.rating}/5</span>
          <span className="truncate">
            · reviewed by {task.review.reviewer_name || "a project lead"}
          </span>
        </p>
      ) : null}

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
            <span className="text-muted-foreground/60 text-[0.7rem]">Unassigned</span>
          )}
        </div>
      </div>
    </>
  );
}
