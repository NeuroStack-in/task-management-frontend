"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarRange,
  Crown,
  FileDown,
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
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
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
import { usePermissions } from "@/hooks/use-permissions";
import { useIsSelfScoped } from "@/hooks/use-self-scope";
import { useAuthStore } from "@/stores/auth.store";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/format";
import {
  useProjectsStore,
  type ProjectFormValues,
} from "@/stores/projects.store";
import { useTasksStore, type TaskFormValues } from "@/stores/tasks.store";
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
  userMap: Record<string, UserMini>;
}

export function ProjectDetailPage({ id, userMap }: ProjectDetailPageProps) {
  const router = useRouter();
  const { can } = usePermissions();
  const selfScoped = useIsSelfScoped();
  const userId = useAuthStore((s) => s.user?.id) ?? "";
  const canManage = can("projects:manage");
  const project = useProjectsStore((s) => s.projects.find((p) => p.id === id));
  const updateProject = useProjectsStore((s) => s.updateProject);
  const deleteProject = useProjectsStore((s) => s.deleteProject);

  const allTasks = useTasksStore((s) => s.tasks);
  const createTask = useTasksStore((s) => s.createTask);
  const updateTask = useTasksStore((s) => s.updateTask);
  const moveTask = useTasksStore((s) => s.moveTask);
  const tasks = useMemo(
    () => allTasks.filter((t) => t.projectId === id),
    [allTasks, id],
  );

  const [editOpen, setEditOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [createStatus, setCreateStatus] = useState<TaskStatus>("todo");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [taskView, setTaskView] = useState<"board" | "list">("list");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const members = useMemo(
    () => Object.values(userMap).sort((a, b) => a.name.localeCompare(b.name)),
    [userMap],
  );

  const counts = useMemo(() => taskCounts(tasks), [tasks]);

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

  // Self-scoped roles (Employee) can only open projects they're a member of.
  if (selfScoped && !project.memberIds.includes(userId)) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No access to this project"
        description="You can only view projects you're a member of."
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

  const openCreateTask = (s: TaskStatus) => {
    setEditingTask(null);
    setCreateStatus(s);
    setTaskOpen(true);
  };
  const openEditTask = (t: Task) => {
    setEditingTask(t);
    setTaskOpen(true);
  };
  const handleTaskSubmit = (values: TaskFormValues) => {
    if (editingTask) {
      updateTask(editingTask.id, values);
      toast.success("Task updated", { description: values.title });
    } else {
      createTask(project.id, values);
      toast.success("Task added", { description: values.title });
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

  const activeTask = activeTaskId
    ? (tasks.find((t) => t.id === activeTaskId) ?? null)
    : null;

  const handleDragStart = (e: DragStartEvent) =>
    setActiveTaskId(e.active.id as string);

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveTaskId(null);
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
    <div className="space-y-6">
      {/* Top bar: back + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          All projects
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="gap-1.5" onClick={downloadReport}>
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
        </div>
      </div>

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

      {/* KPI row */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex flex-col items-center justify-center rounded-2xl border bg-card p-5">
          <p className="self-start text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Completion
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
            <TaskStat label="Completed" value={completed} dot="bg-primary" />
            <TaskStat
              label="Pending"
              value={pending}
              dot="bg-muted-foreground/40"
            />
          </div>
        </div>

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

      {/* Kanban + team rail */}
      <div className="grid gap-6 lg:grid-cols-12">
        <section className="space-y-3 lg:col-span-8">
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
                size="sm"
                className="gap-1.5"
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
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveTaskId(null)}
            >
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
              <DragOverlay dropAnimation={null}>
                {activeTask ? (
                  <div className="w-64 rotate-2 rounded-xl border bg-card p-3 shadow-xl">
                    <TaskCardContent task={activeTask} userMap={userMap} />
                  </div>
                ) : null}
              </DragOverlay>
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

        {/* Right rail */}
        <aside className="space-y-6 lg:col-span-4">
          <Panel title="Team details">
            <dl className="space-y-3 text-sm">
              <DetailRow label="Project ID" value={<Mono>{project.id}</Mono>} />
              <DetailRow label="Key" value={<Mono>{project.key}</Mono>} />
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
        "flex flex-col rounded-2xl border bg-muted/40 p-3 transition-colors",
        isOver && "bg-primary/5 ring-2 ring-primary/40",
      )}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
          <span className={cn("size-2 rounded-full", toneDot[meta.tone])} />
          {meta.label}
          <span className="text-muted-foreground tabular-nums">
            {tasks.length}
          </span>
        </span>
        <button
          type="button"
          onClick={onAdd}
          aria-label={`Add task to ${meta.label}`}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <Plus className="size-4" />
        </button>
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
    ? { transform: CSS.Translate.toString(transform), zIndex: 50 }
    : undefined;

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group/task relative cursor-grab touch-none rounded-xl border bg-card p-3 active:cursor-grabbing",
        isDragging && "opacity-40",
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
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    toneDot[prio.tone],
                  )}
                  title={`${prio.label} priority`}
                />
                <p
                  className={cn(
                    "min-w-0 flex-1 truncate text-sm font-medium",
                    t.status === "done" &&
                      "text-muted-foreground line-through",
                  )}
                >
                  {t.title}
                </p>
                {t.dueDate ? (
                  <span
                    className={cn(
                      "hidden shrink-0 text-xs tabular-nums sm:block",
                      due.overdue ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    {due.text}
                  </span>
                ) : null}
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
                {assignee ? (
                  <Avatar size="sm" className="size-6 shrink-0">
                    {assignee.avatarUrl ? (
                      <AvatarImage src={assignee.avatarUrl} alt={assignee.name} />
                    ) : null}
                    <AvatarFallback className="text-[0.55rem]">
                      {initials(assignee.name)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <span className="hidden shrink-0 text-xs text-muted-foreground/60 lg:block">
                    Unassigned
                  </span>
                )}
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
