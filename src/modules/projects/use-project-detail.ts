"use client";

/**
 * One project's detail surface, from the real backend — the read side plus the task/project
 * mutations the detail page performs.
 *
 * Loads `GET /v1/projects/{id}` (KPIs + members + the caller's authority) and the board
 * (`GET .../tasks`), maps them to the `Project`/`Task` shapes the page renders, and resolves member
 * names from the employee directory (best-effort). Every mutation calls the real endpoint and
 * re-reads, so the KPI block (which the Streams aggregator recomputes on task changes) stays fresh.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import {
  getProject,
  getBoard,
  createTask as apiCreateTask,
  updateTask as apiUpdateTask,
  deleteTask as apiDeleteTask,
  addMember,
  removeMember,
} from "./services/projects.service";
import type { Project, Task, TaskPriority, TaskStatus } from "./types";
import { mapProjectStatus } from "./use-projects-data";
import { membersToUserMap, type UserMini } from "./lib";
import type { ProjectFormValues } from "@/stores/projects.store";
import type { TaskFormValues } from "@/stores/tasks.store";

export interface ProjectDetailData {
  project: Project | null;
  tasks: Task[];
  userMap: Record<string, UserMini>;
  /** The caller's resolved project role (`manager` | `lead` | `member`). */
  authority: string;
  loading: boolean;
  error: string | null;
  /** Distinguishes a 404 (gone / not a member) from a transport error. */
  notFound: boolean;
  reload: () => void;
  updateProject: (values: ProjectFormValues) => Promise<void>;
  createTask: (values: TaskFormValues) => Promise<void>;
  updateTaskFull: (taskId: string, values: TaskFormValues) => Promise<void>;
  moveTask: (taskId: string, status: TaskStatus) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
}

export function useProjectDetail(id: string): ProjectDetailData {
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userMap, setUserMap] = useState<Record<string, UserMini>>({});
  const [authority, setAuthority] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    setNotFound(false);

    (async () => {
      try {
        const [detail, board, names] = await Promise.all([
          getProject(id),
          getBoard(id).catch(() => []),
          resolveUserMap().catch(() => ({}) as Record<string, UserMini>),
        ]);
        if (!live) return;
        setProject(toProject(detail));
        setAuthority(detail.authority);
        setTasks(
          board.flatMap((col) =>
            col.tasks.map((t) => ({
              id: t.id,
              projectId: detail.id,
              title: t.title,
              status: col.status as TaskStatus,
              assigneeId: t.assignee_id ?? null,
              priority: (t.priority as TaskPriority) ?? "medium",
              dueDate: t.due ?? null,
              estimateHours: t.estimate_hours ?? 0,
              createdBy: t.created_by ?? null,
              review: t.review ?? null,
            })),
          ),
        );
        // Names come from the project itself first, the org directory second. `GET /v1/employees`
        // needs `EmployeesRead`, which an Employee doesn't have — it 403s, `names` is `{}`, and this
        // dialog used to show a member count with no rows and "—" for Lead/Manager. The detail
        // response carries each member's name/title, so the directory is now only an enhancement
        // (it covers people who aren't project members, e.g. an assignee picker for admins).
        setUserMap({ ...membersToUserMap(detail.members), ...names });
      } catch (e) {
        if (!live) return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError(messageOf(e));
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [id, nonce]);

  const updateProject = useCallback(
    async (v: ProjectFormValues) => {
      await apiFetch(`/v1/projects/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: v.name,
          description: v.description,
          billable: v.billable,
          // Always sent, empty string included: the server reads "" as "clear it", so deselecting a
          // department is a real edit rather than an unreachable state.
          department: v.department ?? "",
          ...(v.dueDate ? { end_date: v.dueDate } : {}),
        }),
      });
      // Membership is a separate resource, and the form edits it in the same dialog. Without this the
      // PATCH succeeded, the toast said "saved", and the member the admin just added was never
      // written — the edit silently lost half of itself.
      await syncMembers(id, project?.memberIds ?? [], v.memberIds, project?.managerId);
      reload();
    },
    [id, project, reload],
  );

  const createTask = useCallback(
    async (v: TaskFormValues) => {
      await apiCreateTask(id, {
        title: v.title,
        status: v.status,
        assignee_id: v.assigneeId || undefined,
        due: v.dueDate || undefined,
        priority: v.priority,
        estimate_hours: v.estimateHours,
      });
      reload();
    },
    [id, reload],
  );

  const updateTaskFull = useCallback(
    async (taskId: string, v: TaskFormValues) => {
      await apiUpdateTask(id, taskId, {
        title: v.title,
        status: v.status,
        // Empty string in the form = clear it (the double-null the PATCH understands).
        assignee_id: v.assigneeId ? v.assigneeId : null,
        due: v.dueDate ? v.dueDate : null,
        priority: v.priority,
        estimate_hours: v.estimateHours,
      });
      reload();
    },
    [id, reload],
  );

  const moveTask = useCallback(
    async (taskId: string, status: TaskStatus) => {
      // Optimistic: the card should snap columns instantly on drop; reconcile on the re-read.
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
      try {
        await apiUpdateTask(id, taskId, { status });
        reload();
      } catch {
        reload(); // failed move → re-read the truth
      }
    },
    [id, reload],
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      await apiDeleteTask(id, taskId);
      reload();
    },
    [id, reload],
  );

  return {
    project,
    tasks,
    userMap,
    authority,
    loading,
    error,
    notFound,
    reload,
    updateProject,
    createTask,
    updateTaskFull,
    moveTask,
    deleteTask,
  };
}

function toProject(d: Awaited<ReturnType<typeof getProject>>): Project {
  return {
    id: d.id,
    name: d.name,
    description: d.description?.trim() || undefined,
    key: d.key ?? "",
    status: mapProjectStatus(d.status),
    billable: d.billable,
    progress: d.kpi?.completion_pct ?? 0,
    velocity: d.kpi?.velocity?.length ? d.kpi.velocity : [],
    leadUserId: d.manager_user_id,
    managerId: d.manager_user_id || undefined,
    memberIds: d.members.map((m) => m.user_id),
    department: d.department ?? "",
    startDate: d.start_date,
    dueDate: d.end_date ?? "",
  };
}

/**
 * Reconcile the project's membership with what the form now says.
 *
 * Two rules keep this honest:
 * - **The manager is never removed here.** They are a member by construction (`create_project` writes
 *   the `MEMBER#` row alongside the project) and the server refuses to mint or move a manager through
 *   the membership routes — handing over a project is its own action. Dropping their chip in the form
 *   must not attempt a delete that would 400, or worse, orphan the project's administration.
 * - **Failures are reported, not swallowed.** The caller shows a success toast when this resolves, so
 *   a rejected add has to surface; otherwise we are back to the bug this fixes — a "saved" message
 *   over a change that never happened.
 */
async function syncMembers(
  projectId: string,
  current: string[],
  next: string[],
  managerId?: string,
): Promise<void> {
  const before = new Set(current);
  const after = new Set(next.filter(Boolean));
  const added = [...after].filter((uid) => !before.has(uid));
  const removed = [...before].filter((uid) => !after.has(uid) && uid !== managerId);
  if (!added.length && !removed.length) return;

  const results = await Promise.allSettled([
    ...added.map((uid) => addMember(projectId, uid, "member")),
    ...removed.map((uid) => removeMember(projectId, uid)),
  ]);
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed) {
    const total = added.length + removed.length;
    throw new Error(
      failed === total
        ? "The project was saved but its members weren't updated. You may not have permission to manage this project's team."
        : `The project was saved, but ${failed} of ${total} team changes failed. Reopen the dialog to check.`,
    );
  }
}

async function resolveUserMap(): Promise<Record<string, UserMini>> {
  const res = await apiFetch<{
    employees: { user_id: string; name: string; title?: string }[];
  }>("/v1/employees");
  const map: Record<string, UserMini> = {};
  for (const e of res.employees) {
    map[e.user_id] = { id: e.user_id, name: e.name, jobTitle: e.title ?? "" };
  }
  return map;
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to this project.";
    return e.message;
  }
  return "Couldn't load the project. Check your connection and retry.";
}
