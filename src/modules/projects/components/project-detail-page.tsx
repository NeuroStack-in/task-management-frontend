"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Building2, CalendarRange, ChevronRight, Crown, FileDown, FolderKanban, Hourglass, Info, ListChecks, Lock, MoreHorizontal, Pencil, Plus, Star, Timer, Trash2, Undo2, Users } from "lucide-react";
import { toast } from "sonner";
import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCorners, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type Announcements, type CollisionDetection, type DragEndEvent, type DragStartEvent, type KeyboardCoordinateGetter } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ApiError } from "@/lib/api";
import { friendlyError } from "@/lib/errors";
import { Gauge } from "@/components/shared/gauge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Loader } from "@/components/shared/loader";
import { cn } from "@/lib/utils";
import { formatDate as formatDay, formatDateRange, formatDuration, personName } from "@/lib/format";
import type { ProjectFormValues } from "@/modules/projects/forms";
import type { TaskFormValues } from "@/modules/projects/forms";
import { useProjectDetail } from "../use-project-detail";
import { useQueryState } from "../use-query-state";
import { PROJECT_STATUS_META, TASK_PRIORITY_META, TASK_STATUS_META, TASK_STATUS_ORDER, TASK_STATUS_SETTABLE, type SettableTaskStatus, type Task, type TaskStatus } from "../types";
import { OVERSIGHT_TARGETS, STATUS_WEIGHT, canDeleteTask, canMoveTask, canWorkOnTasks, canReviewTask, moveOptions, settableStatuses, taskCounts, taskLoadByPerson, taskTotals, daysUntil, dueLabel, isAtRisk, selectablePeople, toneDot, toneSoft, type MoveOption, type UserMini } from "../lib";
import { AssigneeStack } from "./assignees";
import { useAuthStore } from "@/stores/auth.store";
import { Segmented, StatusBadge } from "./parts";
import { ProjectFormDialog } from "./project-form-dialog";
import { TaskReviewDialog } from "./task-review-dialog";
import { TaskFormDialog } from "./task-form-dialog";
import { ViewTaskDialog } from "./view-task-dialog";
import { generateProjectReportPdf } from "../report";
import { ProjectTimeByMember } from "./project-time-by-member";
import { TaskFlowGuide } from "./task-flow-guide";
import { TaskActionsMenu, type TaskActionHandlers } from "./task-actions";
import { UserAvatar } from "@/components/shared/user-avatar";

interface ProjectDetailPageProps {
  id: string;
}

const TASK_VIEWS = ["board", "list"] as const;

/**
 * Where a drop lands. With a pointer, only a column **under** it: `closestCorners` always answers
 * with the nearest column, so releasing a card anywhere off the board still moved it, and Escape was
 * the only way to cancel (QA audit 2026-10-08, WP-499). A keyboard drag has no pointer, and keeps
 * the nearest-column rule its arrow keys are built around.
 */
const boardCollision: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : closestCorners(args);

const ARROWS = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp"];

/**
 * Arrow keys move a picked-up card **a column at a time** — the nearest column in that direction —
 * rather than dnd-kit's default 25 px nudge, which took a dozen presses to cross one column.
 */
const columnKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context, currentCoordinates }) => {
  if (!ARROWS.includes(event.code)) return undefined;
  event.preventDefault();
  const from = context.collisionRect;
  if (!from) return currentCoordinates;
  const cx = from.left + from.width / 2;
  const cy = from.top + from.height / 2;
  let best: { left: number; top: number } | null = null;
  let bestDistance = Infinity;
  for (const column of context.droppableContainers.getEnabled()) {
    const rect = context.droppableRects.get(column.id);
    if (!rect) continue;
    const dx = rect.left + rect.width / 2 - cx;
    const dy = rect.top + rect.height / 2 - cy;
    const ahead =
      event.code === "ArrowRight" ? dx > 1
        : event.code === "ArrowLeft" ? dx < -1
          : event.code === "ArrowDown" ? dy > 1
            : dy < -1;
    const distance = Math.hypot(dx, dy);
    if (ahead && distance < bestDistance) {
      best = rect;
      bestDistance = distance;
    }
  }
  // Inside the column's top-left, so the nearest-column rule lands it there.
  return best ? { x: best.left + 12, y: best.top + 40 } : currentCoordinates;
};

export function ProjectDetailPage({ id }: ProjectDetailPageProps) {
  // Real backend. The server 404s a project the caller isn't a member of (no oversight bit), so the
  // "no access" case is `notFound` — there's no client-side scope check anymore.
  const {
    project,
    tasks,
    userMap,
    departments,
    directoryAvailable,
    loading,
    error,
    refreshError,
    notFound,
    reload,
    updateProject,
    deleteProject,
    createTask,
    updateTask,
    moveTask,
    deleteTask,
    authority,
    reviewerIds,
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
  /**
   * Your **own** role here, from the member rows — not `authority`, which is `manager` for an org
   * admin on every project. Only the project's own lead or manager signs work off (owner rule,
   * 2026-10-16), and `review_task` checks exactly that.
   */
  const ownRole =
    currentUserId && reviewerIds.includes(currentUserId)
      ? currentUserId === project?.managerId
        ? "manager"
        : "lead"
      : "";
  /** Mirrors the server: the project's own lead or manager, only on an `in_review` task, never your own. */
  const canReview = (t: Task) => canReviewTask(t, ownRole, currentUserId);
  /**
   * Who an `in_review` task is waiting for, in words — the people who can sign it off (the project's
   * lead and manager, minus anyone assigned to it). Shown on the card to everyone who can't review it,
   * so nobody is left wondering what happens next.
   */
  const waitingFor = (t: Task): string => {
    const names = reviewerIds
      .filter((uid) => !t.assignees.some((a) => a.userId === uid))
      .map((uid) => (uid === currentUserId ? "you" : userMap[uid]?.name))
      .filter((n): n is string => Boolean(n));
    if (names.length === 0) {
      return reviewerIds.length
        ? "Nobody can review this: the lead and manager are both assigned to it"
        : "Waiting for the project lead or manager to review";
    }
    return `Waiting for ${names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`} to review`;
  };
  /** Any project member — the target column decides the rest (`canMoveTaskTo`, on drop). */
  const canMove = (t: Task) => canMoveTask(t, authority, currentUserId);
  /** `done` and `blocked` take a Manager or Lead — a new task can't start in either for anyone else. */
  const isReviewer = authority === "manager" || authority === "lead";
  /**
   * On the project at all. A `viewer` — org-wide project oversight without membership — reads the
   * board and changes nothing, so no Add, Edit, drag or Delete is offered (WP-302).
   */
  const canWork = canWorkOnTasks(authority);
  const [reviewTarget, setReviewTarget] = useState<Task | null>(null);
  /**
   * The open task's id. The task itself is read from the board on every render, so a move or an
   * edit made from the view shows in it at once rather than the snapshot taken when it opened — the
   * view now carries actions (UX audit PROJ-14).
   */
  const [viewingId, setViewingId] = useState<string | null>(null);
  const viewingTask = viewingId ? (tasks.find((t) => t.id === viewingId) ?? null) : null;
  /** The card being dragged, so the columns can say which take it — and why not (UX audit PROJ-07). */
  const [draggingId, setDraggingId] = useState<string | null>(null);
  /** The Progress card's "How is this counted?" (UX audit PROJ-13). */
  const [showWeights, setShowWeights] = useState(false);
  /**
   * The open task, in the URL (`?task=<id>`), so a task can be linked to — from the Tasks tab, the
   * dashboard's My tasks, a shared link — and Back or a refresh keeps it open. Those surfaces used to
   * open the project and leave the person to find the task on the board (UX audit PROJ-03).
   */
  const [taskParam, setTaskParam] = useQueryState<string>("task", "");
  const openTask = (t: Task) => {
    setViewingId(t.id);
    setTaskParam(t.id);
  };
  const closeTask = () => {
    setViewingId(null);
    setTaskParam("");
  };
  useEffect(() => {
    if (!taskParam || loading || !project || viewingId) return;
    const linked = tasks.find((t) => t.id === taskParam);
    if (linked) {
      setViewingId(linked.id);
    } else {
      // Deleted, or on another project: say so rather than opening the project as if nothing was asked.
      toast.error("That task isn't on this project any more", {
        description: "It may have been deleted or moved. Here is the project it was on.",
      });
      setTaskParam("");
    }
  }, [taskParam, loading, project, tasks, viewingId, setTaskParam]);
  // The open task is gone (deleted from its own view, or by someone else): close it rather than keep
  // a link to nothing in the URL.
  useEffect(() => {
    if (viewingId && !loading && !tasks.some((t) => t.id === viewingId)) {
      setViewingId(null);
      setTaskParam("");
    }
  }, [viewingId, loading, tasks, setTaskParam]);

  const [editOpen, setEditOpen] = useState(false);
  // A manager who has just handed their own project over is no longer its manager once the page
  // re-reads; the Edit dialog would only offer them saves the server now refuses.
  useEffect(() => {
    if (!canManageProject) setEditOpen(false);
  }, [canManageProject]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Separate from `deleting` above, which belongs to the task-delete dialog — one shared flag would
  // let an in-flight task delete disable the project dialog's buttons.
  const [deletingProject, setDeletingProject] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [createStatus, setCreateStatus] = useState<SettableTaskStatus>("todo");
  // In the URL, so Back from a task's project page and a shared link keep the view (WP-502).
  const [taskView, setTaskView] = useQueryState("view", "board", TASK_VIEWS);
  const [teamOpen, setTeamOpen] = useState(false);
  // The board announced itself as keyboard-draggable while only a pointer could drag, and on a phone
  // a swipe that began on a card dragged it — into the next column — instead of scrolling the page
  // (QA audit 2026-10-08, WP-500). Mouse: a short move picks a card up. Touch: press and hold, so a
  // swipe still scrolls. Keyboard: Space picks up, arrows move a column at a time, Space drops.
  // **Enter opens the task** instead (UX audit 2026-10-16, PROJ-01): it used to pick the card up too,
  // so no key — and no click — opened a task; only a 24 px eye icon that appeared on hover did.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: columnKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space", "Enter"] },
    }),
  );

  // Two different questions, and conflating them broke both in turn.
  //
  // `orgPeople` — **everyone selectable in the org.** What the Edit Project dialog needs: you add
  // members to a project by picking people who are not on it yet, and its manager/lead pickers span
  // the company too. Deleted employees are excluded; a purged identity must never be assignable.
  const orgPeople = useMemo(() => selectablePeople(userMap), [userMap]);

  // `projectTeam` — **only this project's members.** What a task assignee must be: the server
  // enforces assignee-must-be-a-member, so offering the whole directory here meant filling in the
  // form and then being rejected on save.
  const projectTeam = useMemo(() => {
    const ids = new Set(project?.memberIds ?? []);
    return orgPeople.filter((u) => ids.has(u.id));
  }, [orgPeople, project?.memberIds]);


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
  // The server makes `end_date` optional (another client, a seed, the API can omit it), and an empty
  // one read "NaN days left" over "undefined NaN" here (QA audit 2026-10-08, WP-305).
  const hasDeadline = Boolean(project.dueDate);
  const daysLeft = hasDeadline ? daysUntil(project.dueDate) : 0;
  // The one date notation (UX audit XC-06): the shared helpers, not this module's compact "Oct 12".
  const deadlineDate = hasDeadline ? formatDay(project.dueDate) : "No end date";
  const timeline = hasDeadline
    ? formatDateRange(project.startDate.slice(0, 10), project.dueDate.slice(0, 10))
    : `${formatDay(project.startDate)} – no end date`;
  const lead = userMap[project.leadUserId];
  const manager = project.managerId ? userMap[project.managerId] : null;
  // One source for every headline number on this page — see `taskTotals`. `pending` used to be
  // `tasks.length - done`, which counted closed and blocked tasks as outstanding work: a project
  // with everything signed off still read "5 open".
  const totals = taskTotals(tasks);
  const counts = taskCounts(tasks);
  /** The project's own role for a member, as the Team card and dialog label it. */
  const roleOf = (uid: string): string | null =>
    uid === project.managerId ? "Manager" : uid === project.leadUserId ? "Lead" : null;
  // Manager, then lead, then everyone else in the server's order (the sort is stable).
  const rank = (uid: string) =>
    uid === project.managerId ? 0 : uid === project.leadUserId ? 1 : 2;
  const team = teamOf(project.memberIds, userMap).sort((a, b) => rank(a.id) - rank(b.id));

  const dayWord = (n: number) => (n === 1 ? "day" : "days");
  // "Overdue" is a *task* word on this app — the Projects list's "Overdue tasks" filter counts
  // projects holding one. A project past its own end date is "past its deadline", here and on the
  // Projects page's "Past deadline" tile (UX audit PROJ-13).
  const deadlineText = !hasDeadline
    ? "No deadline"
    : daysLeft === 0
      ? "Due today"
      : daysLeft < 0
        ? `Passed ${-daysLeft} ${dayWord(-daysLeft)} ago`
        : `${daysLeft} ${dayWord(daysLeft)} left`;

  const editInitial: Partial<ProjectFormValues> = {
    name: project.name,
    description: project.description ?? "",
    department: project.department,
    // Empty for a project created before the lead was required — its next save asks for one.
    leadUserId: project.leadUserId,
    managerId: project.managerId ?? "",
    memberIds: project.memberIds,
    // Shown, not sent: the server's PATCH has no start date (UX audit PROJ-09).
    startDate: project.startDate.slice(0, 10),
    dueDate: project.dueDate.slice(0, 10),
    // Must be carried: omitting it would pre-fill the form as non-billable and silently
    // reclassify a billable project on save.
    billable: project.billable,
    status: project.status,
    key: project.key,
  };

  const handleEdit = async (values: ProjectFormValues) => {
    try {
      await updateProject(values);
      toast.success("Project updated", { description: `“${values.name}” saved.` });
      setEditOpen(false);
    } catch (e) {
      // The dialog stays open with what was typed. A partial save has its own message (the details
      // went through, the team didn't), and the page has re-read, so saving again retries only the
      // part that failed. Showing the generic "try again" there would be a second lie.
      toast.error(friendlyError(e, "Couldn't save the project. Try again."));
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
        await updateTask(editingTask, values);
        toast.success("Task updated", { description: values.title });
      } else {
        await createTask(values);
        toast.success("Task added", { description: values.title });
      }
      setTaskOpen(false);
    } catch (e) {
      // The dialog stays open with everything typed and uploaded, except when there is nothing left
      // to save it to.
      if (editingTask && e instanceof ApiError && e.status === 404) {
        toast.error("This task no longer exists — someone may have deleted it.");
        setTaskOpen(false);
      } else if (e instanceof ApiError && e.status === 409 && e.code === "task_changed") {
        toast.error("Someone else changed this task while you were editing it.", {
          description: "The board now shows their change. Check it, then save again.",
        });
      } else {
        toast.error(friendlyError(e, "Couldn't save the task. Try again."));
      }
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
        status: editingTask.status,
        assigneeIds: editingTask.assignees.map((a) => a.userId),
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
    : {
        status: createStatus,
        // A member adding a task is most often adding their own: start with them on it, rather than
        // an empty required field they must find themselves in (UX audit PROJ-11). Only when they
        // are on the team — nobody else can be assigned.
        assigneeIds:
          currentUserId && projectTeam.some((u) => u.id === currentUserId) ? [currentUserId] : [],
      };
  /** Who the assignee list holds, and what to do about someone missing from it (PROJ-11). */
  const assigneeHint = canManageProject
    ? "Only people on this project can be assigned. Add someone to the team from Edit project."
    : "Only people on this project can be assigned. To add someone, ask the project manager.";

  const downloadReport = () => {
    // A failed jsPDF chunk load used to be an unhandled rejection and a button that did nothing
    // (QA audit 2026-10-08, WP-507).
    generateProjectReportPdf(project, tasks, userMap).then(
      (filename) => toast.success("Report generated", { description: filename }),
      () => toast.error("Couldn't generate the report. Try again."),
    );
  };

  /**
   * Move a task — from a drop, the card's "Move to…" menu or the task view's (UX audit PROJ-06,
   * PROJ-14). One path, so the three can't disagree about what a person may do.
   *
   * **Done is reached only through a review** (owner rule, 2026-10-16): for someone who may sign the
   * task off, choosing Done opens the review; the server refuses a move to `done` outright. Anything
   * else this person may not do is refused here with the reason `moveOptions` gives — before the card
   * slides, so it doesn't slide in and spring back. While a card is held the board now greys those
   * columns out and says why (PROJ-07), so a drop rarely gets this far.
   */
  const requestMove = (moved: Task, target: TaskStatus, from: "drag" | "menu") => {
    if (moved.status === target || !TASK_STATUS_SETTABLE.includes(target)) return;
    const option = moveOptions(moved, authority, ownRole, currentUserId).find(
      (o) => o.status === target,
    );
    if (!option) return;
    if (option.via === "review") {
      if (viewingId) closeTask();
      setReviewTarget(moved);
      return;
    }
    if (option.via === "refused") {
      toast.error(`It can’t go to ${TASK_STATUS_META[target].label}`, {
        description:
          target === "done" && moved.status === "in_review"
            ? `${option.reason}. ${waitingFor(moved)}.`
            : option.reason,
      });
      return;
    }
    moveTask(moved.id, target).then(
      () => {
        // A drop shows itself; a menu move on a phone can take the card out of sight.
        if (from === "menu") {
          toast.success(`Moved to ${TASK_STATUS_META[target].label}`, { description: moved.title });
        }
      },
      (err: unknown) => {
        // The board has already re-read, so the card is back where the server says it is; this says
        // why (QA audit 2026-10-08, WP-303).
        if (err instanceof ApiError && err.status === 404) {
          toast.error("That task no longer exists — someone may have deleted it.");
        } else if (err instanceof ApiError && err.code === "review_required") {
          toast.error("Tasks reach Done only through a review.", {
            description: "Move it to In review — the project lead or manager signs it off from there.",
          });
        } else if (err instanceof ApiError && err.status === 409) {
          toast.error("Someone else changed that task just now.", {
            description: "The board shows their change — move it again if you still need to.",
          });
        } else {
          toast.error(friendlyError(err, "Couldn't move the task. Try again."));
        }
      },
    );
  };

  const handleDragStart = (e: DragStartEvent) => setDraggingId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
    setDraggingId(null);
    const { active, over } = e;
    if (!over) return;
    const moved = tasks.find((t) => t.id === active.id);
    if (moved) requestMove(moved, over.id as TaskStatus, "drag");
  };

  /** Where the held card may go, column by column — `null` while nothing is being dragged. */
  const dragging = draggingId ? tasks.find((t) => t.id === draggingId) : undefined;
  const dragOptions = dragging ? moveOptions(dragging, authority, ownRole, currentUserId) : null;
  const dropFor = (col: TaskStatus): ColumnDrop | null => {
    if (!dragging || !dragOptions) return null;
    if (col === dragging.status) return { via: "origin" };
    return dragOptions.find((o) => o.status === col) ?? null;
  };

  /**
   * What this person may do to one task. The card's "⋯" menu and the task view's footer read the
   * same answer (UX audit PROJ-06, PROJ-14). From the view, an action that opens another dialog
   * closes the view first rather than stacking two.
   */
  const actionsFor = (t: Task, inView = false): TaskActionHandlers => {
    const leaving = (fn: () => void) => () => {
      if (inView) closeTask();
      fn();
    };
    return {
      onOpen: inView ? undefined : () => openTask(t),
      onEdit: canWork ? leaving(() => openEditTask(t)) : undefined,
      onDelete: canDelete(t) ? leaving(() => setTaskToDelete(t)) : undefined,
      onReview: canReview(t) ? leaving(() => setReviewTarget(t)) : undefined,
      moves: canWork ? moveOptions(t, authority, ownRole, currentUserId) : undefined,
      onMove: canWork ? (target) => requestMove(t, target, "menu") : undefined,
    };
  };

  // What a screen reader hears during a drag — task titles and column names, not their ids.
  const titleOf = (taskId: string | number) =>
    tasks.find((t) => t.id === taskId)?.title ?? "The task";
  const columnOf = (col: string | number) =>
    TASK_STATUS_META[col as TaskStatus]?.label ?? String(col);
  const announcements: Announcements = {
    // Where it can go, said as it is picked up: the columns it can't enter are skipped by the arrow
    // keys, and a screen reader would otherwise never learn why (UX audit PROJ-07).
    onDragStart: ({ active }) => {
      const t = tasks.find((x) => x.id === active.id);
      const ok = t
        ? moveOptions(t, authority, ownRole, currentUserId)
            .filter((o) => o.via !== "refused")
            .map((o) => TASK_STATUS_META[o.status].label)
        : [];
      return `Picked up ${titleOf(active.id)}. ${
        ok.length ? `It can go to ${ok.join(", ")}.` : "It can’t go to another column."
      }`;
    },
    onDragOver: ({ active, over }) =>
      over
        ? `${titleOf(active.id)} is over ${columnOf(over.id)}.`
        : `${titleOf(active.id)} is not over a column it can go to.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${titleOf(active.id)} was dropped on ${columnOf(over.id)}.`
        : `${titleOf(active.id)} was put back.`,
    onDragCancel: ({ active }) => `Moving ${titleOf(active.id)} was cancelled.`,
  };
  return (
    <div className="flex flex-col gap-6">
      {/* Title + actions live in the top navbar; the back link stays in-page. */}
      {/* Labelled actions in the top bar from `sm` up. Below it they went into the never-wrapping
          bar too and squeezed the title to "Proj…" (UX audit PROJ-04); the phone gets a "⋯" menu
          beside "All projects" instead. */}
      <PageHeader
        title={project.name}
        actions={
          <div className="hidden items-center gap-2 sm:flex">
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
          </div>
        }
      />

      <div className="flex items-center justify-between gap-3">
        <Link
          href="/projects"
          className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="size-4" />
          All projects
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                className="size-8 sm:hidden"
                aria-label="Project actions"
              />
            }
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-44">
            <DropdownMenuItem onClick={downloadReport}>
              <FileDown className="size-4" /> Report (PDF)
            </DropdownMenuItem>
            {canManageProject ? (
              <>
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="size-4" /> Edit project
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setConfirmOpen(true)}>
                  <Trash2 className="size-4" /> Delete project
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
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
              {/* The short key is the project's human name-tag ("WP"). It is optional, so render
                  it only when there is one — an empty chip reads as a rendering fault.

                  The raw id (`p-01M1114XQHT0BK3ZCVV9DK09X4`) used to sit beside it. That is
                  storage plumbing: a ULID nobody types, quotes, or searches for, taking the most
                  prominent position on the page and pushing the actual name down. Nothing in the
                  product asks a person for it — the URL already carries it for anyone who needs to
                  share a link. */}
              {project.key ? (
                <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-xs font-semibold tracking-wide text-white/90 ring-1 ring-white/10">
                  {project.key}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2 py-0.5 text-xs font-medium text-white/90 ring-1 ring-white/10">
                <span className="size-1.5 rounded-full bg-white/75" />
                {status.label}
              </span>
              {atRisk ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-amber-400/20">
                  <AlertTriangle className="size-3" />
                  Past deadline
                </span>
              ) : null}
            </div>

            {/* Not an <h1>: `PageHeader` above already renders the page's one H1 with this name, and
                two read as two pages to a screen reader (UX audit PROJ-18). */}
            <p className="font-display mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              {project.name}
            </p>

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
                {timeline}
              </span>
              {lead ? (
                <span className="inline-flex items-center gap-1.5">
                  <UserAvatar
                    userId={project.leadUserId}
                    name={lead.name}
                    size="sm"
                    className="size-5 ring-1 ring-white/15"
                    fallbackClassName="bg-white/10 text-[0.55rem] text-white"
                  />
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
            {hasDeadline ? (
              <p className="mt-0.5 text-xs text-white/70">{deadlineDate}</p>
            ) : null}
          </div>
        </div>
      </header>

      {/* A re-read that failed after the page loaded: say so above what is still the last good read,
          rather than replacing it with an error screen (WP-303). */}
      {refreshError ? (
        <div
          role="status"
          className="border-warning/40 bg-warning/10 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm"
        >
          <span>
            Couldn&apos;t refresh this project — what you see may be out of date. {refreshError}
          </span>
          <Button size="sm" variant="outline" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : null}

      {/* KPI row */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-card flex flex-col items-center justify-center rounded-2xl border p-5">
          <p className="text-muted-foreground self-start text-xs font-medium tracking-wide uppercase">
            Progress
          </p>
          {/* Gauge and caption share ONE source — the live board — so the two can never disagree.
              The gauge is **weighted**: a task in review counts 90%, so it can read 90% with nothing
              signed off. It said "of work done" and nowhere how it was counted (UX audit PROJ-13);
              now it says "weighted" and one click away exactly how. */}
          <Gauge value={totals.progressPct} label="weighted" size={172} />
          <p className="text-muted-foreground mt-1 text-xs">
            {totals.completed} of {totals.deliverable} tasks signed off
          </p>
          <button
            type="button"
            onClick={() => setShowWeights((v) => !v)}
            aria-expanded={showWeights}
            aria-controls={`${project.id}-weights`}
            className="text-primary hover:text-primary/80 mt-2 inline-flex items-center gap-1 text-xs font-medium"
          >
            <Info className="size-3.5" aria-hidden="true" />
            How is this counted?
          </button>
          {showWeights ? (
            <p
              id={`${project.id}-weights`}
              className="text-muted-foreground mt-2 max-w-xs text-center text-xs leading-relaxed"
            >
              Each task counts for how far it has got: To do {STATUS_WEIGHT.todo}%, In progress{" "}
              {STATUS_WEIGHT.in_progress}%, In review {STATUS_WEIGHT.in_review}%, Done{" "}
              {STATUS_WEIGHT.done}%. Blocked tasks are left out until they move again.
            </p>
          ) : null}
        </div>

        {/* What is left, and how it splits. The headline is the open work — to do, in progress and
            in review — and the three figures under it add up to it. Done sat directly under "still
            to do" and read as part of it (UX audit PROJ-13); finished and blocked work now has its
            own labelled group, outside the count. */}
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
              {totals.open}
            </span>
            <span className="text-muted-foreground text-sm">still to do</span>
          </div>
          <div className="mt-auto pt-5">
            <div className="grid grid-cols-3 gap-2">
              {(["todo", "in_progress", "in_review"] as const).map((s) => (
                <TaskStat
                  key={s}
                  label={TASK_STATUS_META[s].label}
                  value={counts[s]}
                  dot={toneDot[TASK_STATUS_META[s].tone]}
                />
              ))}
            </div>
            <div className="my-3 flex items-center gap-2">
              <span className="bg-border h-px flex-1" />
              <span className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
                Not in the count above
              </span>
              <span className="bg-border h-px flex-1" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <TaskStat label="Done · signed off" value={totals.done} dot="bg-success" />
              <TaskStat label="Blocked" value={totals.blocked} dot="bg-warning" />
            </div>
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
          {/* The first few members, named — the manager and lead first and labelled as such. Only the
              lead was labelled, so the person who runs the project read as one more member (UX
              audit PROJ-15). */}
          <ul className="mt-4 space-y-2">
            {team.slice(0, 4).map((u) => (
              <li key={u.id} className="flex items-center gap-2">
                <UserAvatar userId={u.id} name={u.name} size="sm" className="size-6" />
                <span className="min-w-0 flex-1 truncate text-sm">{u.name}</span>
                {roleOf(u.id) ? (
                  <span className="text-muted-foreground shrink-0 text-[10px] font-medium tracking-wide uppercase">
                    {roleOf(u.id)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="mt-auto flex items-center justify-between gap-2 pt-4">
            <span className="text-muted-foreground text-xs">
              {project.memberIds.length > 4
                ? `+${project.memberIds.length - 4} more`
                : ""}
            </span>
            <button
              type="button"
              onClick={() => setTeamOpen(true)}
              className="text-primary hover:text-primary/80 inline-flex shrink-0 items-center gap-0.5 text-xs font-medium transition-colors"
            >
              {canManageProject ? "Team & details" : "View more"}
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
              label="Task view"
              options={[
                { value: "board", label: "Board" },
                { value: "list", label: "List" },
              ]}
              value={taskView}
              onChange={setTaskView}
            />
            {canWork ? (
              <Button
                className="h-auto gap-1.5 rounded-xl px-4 py-2.5 text-sm"
                onClick={() => openCreateTask("todo")}
              >
                <Plus className="size-4" />
                Add task
              </Button>
            ) : null}
          </div>
        </div>
        {authority === "viewer" ? (
          <p className="text-muted-foreground text-xs">
            You can see this project because you oversee projects across the organization. You
            aren&apos;t a member, so it is read-only here.
          </p>
        ) : null}

        <TaskFlowGuide />

        {taskView === "board" ? (
          <DndContext
            sensors={sensors}
            collisionDetection={boardCollision}
            accessibility={{ announcements }}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDraggingId(null)}
          >
            {/* Five columns: `lg:grid-cols-4` left Blocked alone on a second row at every width.
                On a phone the columns sit side by side and snap as you swipe, rather than stacking
                into one long page where moving a card from To do to Done was a long press-drag down
                the whole of it (UX audit PROJ-06). Each column is a little narrower than the screen,
                so the next one peeks in to say there is more. */}
            <div
              className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 xl:grid-cols-5"
              role="group"
              aria-label="Task board"
            >
              {TASK_STATUS_ORDER.map((col) => (
                <KanbanColumn
                  key={col}
                  col={col}
                  tasks={tasks.filter((t) => t.status === col)}
                  userMap={userMap}
                  // No "add" on Done: the column shows what has been signed off, not new work. Nor
                  // on Blocked for anyone who couldn't create a task there — the server refuses a
                  // Member a task that starts blocked.
                  onAdd={
                    !canWork || col === "done" || (OVERSIGHT_TARGETS.includes(col) && !isReviewer)
                      ? undefined
                      : () => openCreateTask(col)
                  }
                  onView={openTask}
                  actionsFor={actionsFor}
                  canReview={canReview}
                  canMove={canMove}
                  onReview={setReviewTarget}
                  waitingFor={waitingFor}
                  drop={dropFor(col)}
                />
              ))}
            </div>
          </DndContext>
        ) : (
          <TaskListView
            tasks={tasks}
            userMap={userMap}
            // Every row opens the task's view, like a board card — it opened the edit form, with no
            // way to just read a task (UX audit PROJ-14). Edit is one click from the view.
            onOpen={openTask}
            onAdd={canWork ? () => openCreateTask("todo") : undefined}
            onDelete={setTaskToDelete}
            canDelete={canDelete}
          />
        )}
      </section>

      {/* Who put how many hours into this project — the project × person cross-tab for someone who
          reads team time, and the viewer's own hours on it for a member who doesn't (PROJ-12). */}
      <ProjectTimeByMember
        projectId={project.id}
        memberIds={project.memberIds}
        userMap={userMap}
        currentUserId={currentUserId}
        isMember={canWork}
      />

      {/* Project edit dialog */}
      <ProjectFormDialog
        mode="edit"
        open={editOpen}
        onOpenChange={setEditOpen}
        leads={orgPeople}
        departments={departments}
        peopleNote={
          directoryAvailable
            ? undefined
            : "Only people already on this project are listed — you don't have access to the employee directory. An admin can add anyone else."
        }
        initial={editInitial}
        // What unticking each person does to their work, said before the save (PROJ-15).
        taskLoad={taskLoadByPerson(tasks)}
        onSubmit={handleEdit}
      />

      {/* Task add/edit dialog */}
      <TaskFormDialog
        mode={editingTask ? "edit" : "create"}
        open={taskOpen}
        onOpenChange={setTaskOpen}
        projectId={project.id}
        members={projectTeam}
        statuses={settableStatuses(authority, editingTask?.status)}
        assigneeHint={assigneeHint}
        initial={taskInitial}
        onSubmit={handleTaskSubmit}
      />

      {/* The task view — with the actions this person may take, the same as the card's menu
          (PROJ-14), and their own time on it when they are on the project (PROJ-12). */}
      <ViewTaskDialog
        task={viewingTask}
        projectId={project.id}
        open={!!viewingTask}
        onOpenChange={(o) => !o && closeTask()}
        userMap={userMap}
        actions={viewingTask ? actionsFor(viewingTask, true) : undefined}
        ownTimeSince={canWork ? project.startDate.slice(0, 10) : undefined}
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
                  {/* Key only — the raw id was here too, for the same non-reason as in the page
                      header above. `key` is optional, so an absent one renders nothing rather than
                      an empty chip. */}
                  {project.key ? <Mono>{project.key}</Mono> : null}
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
                  value={timeline}
                />
                <DetailRow
                  label="Status"
                  value={<StatusBadge tone={status.tone} label={status.label} />}
                />
                <DetailRow
                  label="Health"
                  value={
                    atRisk ? (
                      <span className="text-warning font-medium">Past deadline</span>
                    ) : (
                      <span className="text-success font-medium">On track</span>
                    )
                  }
                />
                <DetailRow label="Key" value={project.key ? <Mono>{project.key}</Mono> : "—"} />
                <DetailRow label="Project ID" value={<Mono>{project.id}</Mono>} />
              </dl>
            </section>

            {/* Members */}
            <section>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Members · {project.memberIds.length}
                </p>
                {/* The team was read-only here even for the person who runs it; the edit lives in
                    Edit project, so this goes straight there (UX audit PROJ-15). */}
                {canManageProject ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => {
                      setTeamOpen(false);
                      setEditOpen(true);
                    }}
                  >
                    <Pencil className="size-3.5" /> Manage team
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {team.map((u) => {
                  const mid = u.id;
                  const isLead = mid === project.leadUserId;
                  const isManager = mid === project.managerId;
                  return (
                    <div
                      key={mid}
                      className="flex items-center gap-3 rounded-xl border p-3"
                    >
                      <UserAvatar userId={mid} name={u.name} size="sm" />
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
    <div className="bg-muted/30 min-w-0 rounded-xl border px-2.5 py-2.5">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <span className={cn("size-1.5 shrink-0 rounded-full", dot)} />
        <span className="truncate">{label}</span>
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

/**
 * A column's answer while a card is held over the board: the column it came from, one it can go to
 * (`move`), Done for someone who signs it off (`review`), or one it can't — with the reason.
 */
type ColumnDrop = { via: "origin" } | MoveOption;

function KanbanColumn({
  col,
  tasks,
  userMap,
  onAdd,
  onView,
  actionsFor,
  canReview,
  canMove,
  onReview,
  waitingFor,
  drop,
}: {
  col: TaskStatus;
  tasks: Task[];
  userMap: Record<string, UserMini>;
  /** Absent on a column this person can't create a task in (Done; Blocked for a Member). */
  onAdd?: () => void;
  onView: (t: Task) => void;
  /** What this person may do to a card — its "⋯" menu (`actionsFor` on the page). */
  actionsFor: (t: Task) => TaskActionHandlers;
  canReview: (t: Task) => boolean;
  /** False ⇒ the card does not lift — only for a viewer with no project role resolved yet. */
  canMove: (t: Task) => boolean;
  onReview: (t: Task) => void;
  /** Who an `in_review` task is waiting for — shown to everyone who can't review it themselves. */
  waitingFor: (t: Task) => string;
  /** While a card is held: whether it may land here. `null` when nothing is being dragged. */
  drop: ColumnDrop | null;
}) {
  const meta = TASK_STATUS_META[col];
  const refused = drop?.via === "refused";
  // A column the held card can't enter takes no drop at all — the arrow keys skip it too — and says
  // why, in place of its usual hint (UX audit PROJ-07). It used to accept the hover and refuse in a
  // toast after the drop.
  const { setNodeRef, isOver } = useDroppable({ id: col, disabled: refused });
  const hint =
    drop?.via === "refused"
      ? drop.reason
      : drop?.via === "review"
        ? "Drop here to review and sign it off"
        : COLUMN_HINT[col];
  return (
    <div
      ref={setNodeRef}
      aria-disabled={refused || undefined}
      className={cn(
        "bg-muted/40 flex min-h-[140px] w-[85%] shrink-0 snap-start flex-col rounded-2xl border p-3 transition-[background-color,opacity,box-shadow] sm:w-auto",
        // While dragging: the columns that take the card are outlined, the ones that don't recede.
        drop && drop.via !== "origin" && !refused && "ring-primary/30 ring-1",
        refused && "opacity-55",
        isOver && "bg-primary/5 ring-primary/40 ring-2",
      )}
    >
      <div className="mb-3 px-1">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
          <span className={cn("size-2 rounded-full", toneDot[meta.tone])} />
          {meta.label}
          <span className="text-muted-foreground tabular-nums">{tasks.length}</span>
          {refused ? <Lock className="text-muted-foreground size-3" aria-hidden="true" /> : null}
        </span>
        {/* The two columns a first-time viewer can't read off the board: who acts on In review, and
            what it takes to reach Done — or, mid-drag, whether the held card can come here. */}
        {hint ? (
          <p
            className={cn(
              "mt-0.5 text-[0.7rem] leading-snug",
              refused ? "text-foreground font-medium" : "text-muted-foreground",
            )}
          >
            {hint}
          </p>
        ) : null}
      </div>

      {tasks.length === 0 && col === "done" ? (
        <p className="text-muted-foreground rounded-xl border border-dashed px-3 py-6 text-center text-xs">
          Nothing signed off yet. A task lands here when the project lead or manager approves it
          from In review.
        </p>
      ) : tasks.length === 0 ? (
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
              actions={actionsFor(t)}
              onReview={canReview(t) ? onReview : undefined}
              waitingFor={t.status === "in_review" && !canReview(t) ? waitingFor(t) : undefined}
              draggable={canMove(t)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

/** One line under a column's name, for the columns whose rule isn't obvious from the name. */
const COLUMN_HINT: Partial<Record<TaskStatus, string>> = {
  in_review: "Finished work, waiting for the project lead or manager",
  done: "Reviewed and signed off",
};

const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

/** On a card's own buttons: a press is a click, never the start of a drag — for every sensor. */
const KEEP_OFF_THE_CARD = {
  onPointerDown: stopPropagation,
  onMouseDown: stopPropagation,
  onTouchStart: stopPropagation,
};

function TaskCard({
  task,
  onReview,
  waitingFor,
  userMap,
  onView,
  actions,
  draggable = true,
}: {
  task: Task;
  userMap: Record<string, UserMini>;
  /** Open the task's view. */
  onView: (t: Task) => void;
  /** The "⋯" menu: what this person may do to this task (UX audit PROJ-06). */
  actions: TaskActionHandlers;
  /** Present only when this person may sign this task off — absent hides the action entirely. */
  onReview?: (t: Task) => void;
  /** On an `in_review` card this person can't review: who it is waiting for. */
  waitingFor?: string;
  /** False only before a project role is resolved: the card is inert rather than refused on drop. */
  draggable?: boolean;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
      disabled: !draggable,
      // Still a list item to assistive tech — dnd-kit's default `role="button"` hid the list and
      // nested the card's own buttons inside a button (WP-500).
      attributes: { role: "listitem", roleDescription: "draggable task" },
    });
  const style = transform
    ? {
        transform: `${CSS.Translate.toString(transform)} rotate(2deg)`,
        zIndex: 50,
      }
    : undefined;
  /**
   * Where the press began — a click that ends far from it was a drag, not a request to open the
   * task. A short move (under the mouse sensor's 6 px) is still a click.
   */
  const pressedAt = useRef<{ x: number; y: number } | null>(null);
  /**
   * Did this event happen on the card itself? The "⋯" menu renders in a portal, and React still
   * bubbles its events up to the card — so a click on "Edit" in the menu also "clicked the card"
   * and opened the task underneath, and a press in the menu reached the drag sensor.
   */
  const onCard = (e: React.SyntheticEvent) => e.currentTarget.contains(e.target as Node);
  const openFromCard = (e: React.MouseEvent) => {
    if (!onCard(e)) return;
    // The card's own buttons (the menu, review) do their own thing.
    if ((e.target as HTMLElement).closest("button, a")) return;
    const p = pressedAt.current;
    if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6) return;
    onView(task);
  };
  const hasMenu = Boolean(
    actions.onEdit || actions.onDelete || actions.onReview || actions.moves?.length,
  );

  return (
    <li
      ref={(el) => {
        setNodeRef(el);
        // The card itself is the keyboard handle, so Enter or Space on its own buttons still
        // presses that button instead of picking the card up.
        setActivatorNodeRef(el);
      }}
      style={style}
      {...attributes}
      {...listeners}
      // Click, or Enter, opens the task (PROJ-01); dragging still starts on a short move, a long
      // press, or Space. The drag sensors' own handlers run first, so dragging is unchanged.
      onMouseDown={(e) => {
        if (!onCard(e)) return;
        pressedAt.current = { x: e.clientX, y: e.clientY };
        listeners?.onMouseDown?.(e);
      }}
      onTouchStart={(e) => {
        if (!onCard(e)) return;
        const t = e.touches[0];
        pressedAt.current = t ? { x: t.clientX, y: t.clientY } : null;
        listeners?.onTouchStart?.(e);
      }}
      onKeyDown={(e) => {
        if (!onCard(e)) return;
        if (e.key === "Enter" && e.target === e.currentTarget) {
          e.preventDefault();
          onView(task);
          return;
        }
        listeners?.onKeyDown?.(e);
      }}
      onClick={openFromCard}
      aria-label={`${task.title} — press Enter to open, Space to move`}
      className={cn(
        // `touch-manipulation`, not `touch-none`: a swipe that starts on a card scrolls the page;
        // a press-and-hold picks it up (the touch sensor's delay).
        "group/task bg-card relative touch-manipulation rounded-xl border p-3",
        // A click opens the task, so every card is pointer-clickable; one that can move shows the
        // grab cursor once it is held (PROJ-01).
        draggable ? "cursor-pointer active:cursor-grabbing" : "cursor-pointer",
        isDragging && "ring-primary/30 shadow-xl ring-2",
      )}
    >
      {/* One "⋯" menu for everything else — edit, sign off, **move to another column**, delete —
          instead of a row of 24 px icons. It is the way to move a card on a phone, where columns
          used to stack and a move meant a long press-drag down the page (UX audit PROJ-06); and its
          refused columns say why (PROJ-07). Hidden for someone who can do nothing but read. */}
      {hasMenu ? (
        <div className="absolute top-1.5 right-1.5">
          <TaskActionsMenu title={task.title} stopDrag={KEEP_OFF_THE_CARD} {...actions} />
        </div>
      ) : null}
      <TaskCardContent task={task} userMap={userMap} />
      {/* Sent back with a note (UX audit PROJ-02): the assignee reads what to change on the card
          itself, not only in a notification. Open the task for the whole note. */}
      {task.changes ? (
        <p className="text-warning mt-2.5 flex items-start gap-1.5 border-t pt-2 text-[0.7rem] leading-snug">
          <Undo2 className="mt-px size-3 shrink-0" aria-hidden="true" />
          <span className="line-clamp-2">
            Changes requested{task.changes.byName ? ` by ${task.changes.byName}` : ""}:{" "}
            {task.changes.note}
          </span>
        </p>
      ) : null}
      {/* The next step for an `in_review` card, on the card and always visible: a hover-only star
          was the only way in, and a first-time viewer couldn't tell what would finish a task
          (owner feedback, 2026-10-16). The reviewer gets the button; everyone else is told who
          it is waiting for. */}
      {onReview ? (
        <button
          type="button"
          {...KEEP_OFF_THE_CARD}
          onClick={() => onReview(task)}
          className="bg-warning/12 text-warning hover:bg-warning/20 focus-visible:ring-ring mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <Star className="size-3.5" />
          Review &amp; sign off
        </button>
      ) : waitingFor ? (
        <p className="text-muted-foreground mt-2.5 flex items-start gap-1.5 border-t pt-2 text-[0.7rem] leading-snug">
          <Hourglass className="mt-px size-3 shrink-0" aria-hidden="true" />
          <span>{waitingFor}</span>
        </p>
      ) : null}
    </li>
  );
}

function TaskListView({
  tasks,
  userMap,
  onOpen,
  onAdd,
  onDelete,
  canDelete,
}: {
  tasks: Task[];
  userMap: Record<string, UserMini>;
  /** Open the task's view — the same as clicking a board card. */
  onOpen: (t: Task) => void;
  /** Absent for a read-only viewer. */
  onAdd?: () => void;
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
    blocked: 4,
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
        <span className="w-44 shrink-0">Assignees</span>
        {/* Spacer keeping the header aligned with the row's trailing action cell. */}
        <span className="w-8 shrink-0" aria-hidden />
      </div>

      <ul className="divide-y">
        {sorted.map((t) => {
          const prio = TASK_PRIORITY_META[t.priority];
          const status = TASK_STATUS_META[t.status];
          const due = dueLabel(t.dueDate, t.status === "done");
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
                onClick={() => onOpen(t)}
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
                  <SubtaskCount progress={t.subtaskProgress} />
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

                {/* Assignees — a stack from sm, the first name added at lg. Only one name is
                    spelled out even when several people are on it: the row has 11rem, and two
                    truncated half-names say less than one whole one plus a "+2" you can hover. */}
                <span className="hidden w-44 shrink-0 items-center gap-2 sm:flex">
                  {t.assignees.length === 0 ? (
                    <span className="text-muted-foreground text-xs">Unassigned</span>
                  ) : (
                    <>
                      <AssigneeStack
                        assignees={t.assignees}
                        userMap={userMap}
                        size="sm"
                        ringClass="ring-background"
                      />
                      <span className="text-muted-foreground hidden truncate text-xs lg:inline">
                        {personName(userMap[t.assignees[0].userId]?.name)}
                        {t.assignees.length > 1 ? ` +${t.assignees.length - 1}` : ""}
                      </span>
                    </>
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
                    className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex size-7 items-center justify-center rounded-md opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
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

/**
 * The breakdown counter (`3/5`) — on board cards and list rows, as the Tasks tab already showed it
 * (UX audit PROJ-12). Rendered only when the task has subtasks: "0/0" everywhere else would be noise.
 */
function SubtaskCount({ progress }: { progress: Task["subtaskProgress"] }) {
  if (progress.total === 0) return null;
  return (
    <span
      className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-[0.7rem] tabular-nums"
      title={`${progress.done} of ${progress.total} subtasks done`}
    >
      <ListChecks className="size-3" aria-hidden="true" />
      <span className="sr-only">Subtasks: </span>
      {progress.done}/{progress.total}
    </span>
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
  // Signed-off work past its date was finished, not late (WP-377).
  const due = dueLabel(task.dueDate, task.status === "done");
  return (
    <>
      <p className="pr-9 text-sm leading-snug font-medium">{task.title}</p>

      {/* Who signed this off, on the card itself — the question the review step exists to answer,
          so it should not need a click. `reviewer_name` was resolved server-side at review time, so
          it still reads correctly after the reviewer leaves the org. Only a Done task carries one
          (`boardTasks` drops a review left on a reopened task). */}
      {task.review ? (
        <p className="text-muted-foreground mt-1.5 flex items-center gap-1 text-[0.7rem]">
          <Star className="fill-warning text-warning size-3" />
          <span className="font-medium tabular-nums">{task.review.rating}/5</span>
          <span className="truncate">
            · reviewed by {task.review.reviewer_name || "a project lead"}
          </span>
        </p>
      ) : null}

      {/* The breakdown, the time logged and the estimate, which the card never showed (UX audit
          PROJ-12) — on their own line, so a narrow column doesn't wrap the due date. Logged time is
          everyone's completed sessions on this task, served by the board. */}
      {task.subtaskProgress.total > 0 || task.estimateHours !== null || task.loggedSecs ? (
        <p className="mt-1.5 flex items-center gap-2.5">
          <SubtaskCount progress={task.subtaskProgress} />
          {task.loggedSecs || task.estimateHours !== null ? (
            <span
              className="text-muted-foreground inline-flex shrink-0 items-center gap-1 text-[0.7rem] tabular-nums"
              title={[
                task.loggedSecs ? `Logged: ${formatDuration(task.loggedSecs)}` : null,
                task.estimateHours !== null
                  ? `Estimate: ${task.estimateHours} ${task.estimateHours === 1 ? "hr" : "hrs"}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            >
              <Timer className="size-3" aria-hidden="true" />
              {task.loggedSecs ? (
                <>
                  <span className="sr-only">Logged: </span>
                  {formatDuration(task.loggedSecs)}
                  {task.estimateHours !== null ? " / " : ""}
                </>
              ) : null}
              {task.estimateHours !== null ? (
                <>
                  <span className="sr-only">Estimate: </span>
                  {task.estimateHours}h est.
                </>
              ) : null}
            </span>
          ) : null}
        </p>
      ) : null}

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium",
            toneSoft[prio.tone],
          )}
        >
          {prio.label}
        </span>
        <div className="flex min-w-0 items-center gap-2">
          {task.dueDate ? (
            <span
              className={cn(
                "text-[0.7rem] whitespace-nowrap tabular-nums",
                due.overdue ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {due.text}
            </span>
          ) : null}
          {task.assignees.length === 0 ? (
            <span className="text-muted-foreground text-[0.7rem]">Unassigned</span>
          ) : (
            <AssigneeStack assignees={task.assignees} userMap={userMap} size="sm" />
          )}
        </div>
      </div>
    </>
  );
}
