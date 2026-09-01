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
import { ApiError } from "@/lib/api";
import {
  getProject,
  getBoard,
  updateProject as apiUpdateProject,
  deleteProject as apiDeleteProject,
  directoryUserMap,
  createTask as apiCreateTask,
  updateTask as apiUpdateTask,
  deleteTask as apiDeleteTask,
  addMember,
  removeMember,
} from "./services/projects.service";
import type { Project, Task, TaskPriority, TaskStatus } from "./types";
import { mapProjectStatus } from "./use-projects-data";
import { membersToUserMap, toAssignees, type UserMini } from "./lib";
import type { ProjectFormValues } from "@/modules/projects/forms";
import type { TaskFormValues } from "@/modules/projects/forms";

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
  /** Delete the project and every task, member and KPI under it. Irreversible. */
  deleteProject: () => Promise<void>;
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
          directoryUserMap().catch(() => ({}) as Record<string, UserMini>),
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
              description: t.description ?? "",
              status: col.status as TaskStatus,
              assignees: toAssignees(t),
              priority: (t.priority as TaskPriority) ?? "medium",
              dueDate: t.due ?? null,
              estimateHours: t.estimate_hours ?? 0,
              createdBy: t.created_by ?? null,
              review: t.review ?? null,
              // A server predating subtasks omits this; an absent breakdown and an empty one are
              // the same thing to a card, so both collapse to zero.
              subtaskProgress: t.subtasks ?? { total: 0, done: 0 },
              attachments: (t.attachments ?? []).map((a) => ({
                id: a.id,
                filename: a.filename,
                contentType: a.content_type,
                size: a.size,
              })),
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

  /**
   * `DELETE /v1/projects/{id}` — the project and all its children, server-side.
   *
   * No `reload()` afterwards: the project no longer exists, so re-fetching it would only 404 and
   * flip the page into its not-found state. The caller navigates away instead.
   */
  const deleteProject = useCallback(async () => {
    await apiDeleteProject(id);
  }, [id]);

  const updateProject = useCallback(
    async (v: ProjectFormValues) => {
      await apiUpdateProject(id, {
        name: v.name,
        description: v.description,
        billable: v.billable,
        // Always sent, empty string included: the server reads "" as "clear it", so deselecting a
        // department is a real edit rather than an unreachable state.
        department: v.department ?? "",
        ...(v.dueDate ? { end_date: v.dueDate } : {}),
      });
      // Membership is a separate resource, and the form edits it in the same dialog. Without this the
      // PATCH succeeded, the toast said "saved", and the member the admin just added was never
      // written — the edit silently lost half of itself.
      await syncMembers(id, project?.memberIds ?? [], v.memberIds, project?.managerId);
      // **Then the lead role** — after membership, because promoting somebody the same save just
      // added has to find them already a member. `addMember` is an upsert server-side
      // (`SET project_role`, `added_at = if_not_exists`), so this promotes without resetting when
      // they joined.
      //
      // The dialog collected this field and threw it away: `ProjectPatch` has no lead, and neither
      // does the server's `UpdateProjectRequest`, so the PATCH returned 200 and nothing moved. The
      // comment above `syncMembers` describes the same bug being fixed once already for members;
      // this is the half that was left.
      await syncLead(id, project?.leadUserId ?? "", v.leadUserId, project?.managerId);
      reload();
    },
    [id, project, reload],
  );

  const createTask = useCallback(
    async (v: TaskFormValues) => {
      await apiCreateTask(id, {
        title: v.title,
        description: v.description,
        status: v.status,
        assignee_ids: v.assigneeIds,
        due: v.dueDate || undefined,
        priority: v.priority,
        estimate_hours: v.estimateHours,
        attachments: v.attachments,
      });
      reload();
    },
    [id, reload],
  );

  const updateTaskFull = useCallback(
    async (taskId: string, v: TaskFormValues) => {
      await apiUpdateTask(id, taskId, {
        title: v.title,
        description: v.description,
        status: v.status,
        // A present array replaces the set; an empty one unassigns everyone. The form always sends
        // the full list, so this needs no null-vs-omitted dance.
        assignee_ids: v.assigneeIds,
        due: v.dueDate ? v.dueDate : null,
        priority: v.priority,
        estimate_hours: v.estimateHours,
        // A present array replaces the whole set — the form always sends the current list.
        attachments: v.attachments,
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
    deleteProject,
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
    // **The lead is the member holding `project_role === "lead"`, not the manager.**
    //
    // This was `d.manager_user_id`, so every surface that says "Lead" was showing the *manager* —
    // which is why the detail panel listed the same person as both, and why the member badge put
    // "Lead" on the manager while the actual lead read "Member". Setting the lead in the Edit
    // dialog then looked like it did nothing, because nothing about the lead was ever read from
    // the lead. `""` when the project has none, which is a real state — a project can run with
    // just a manager.
    leadUserId: d.members.find((m) => m.project_role === "lead")?.user_id ?? "",
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

/**
 * Make `next` the project's lead, and stand the previous one down.
 *
 * Two people can hold `lead` in the data model (LLD §5 allows N), but the dialog offers a single
 * "Project lead", so leaving the old one promoted would make the field lie the moment it was used:
 * the picker would show one name over a project with two leads.
 *
 * **The manager is never demoted.** Their `project_role` is `manager`, which outranks lead, and the
 * membership routes refuse to mint or move a manager anyway — attempting it would 400 and turn a
 * successful edit into a failed one. It is also how the manager keeps administering the project
 * when they happen to be the outgoing lead.
 */
async function syncLead(
  projectId: string,
  current: string,
  next: string,
  managerId?: string,
): Promise<void> {
  if (next === current) return;
  try {
    if (next) await addMember(projectId, next, "lead");
    // Demote only a real predecessor, and never the manager.
    if (current && current !== managerId && current !== next) {
      await addMember(projectId, current, "member");
    }
  } catch {
    throw new Error(
      "The project was saved, but the lead wasn't changed. You may not have permission to manage this project's team.",
    );
  }
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to this project.";
    return e.message;
  }
  return "Couldn't load the project. Check your connection and retry.";
}
