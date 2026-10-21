"use client";

/**
 * One project's detail surface, from the real backend — the read side plus the task/project
 * mutations the detail page performs.
 *
 * Loads `GET /v1/projects/{id}` (KPIs + members + the caller's authority) and the board
 * (`GET .../tasks`), maps them to the `Project`/`Task` shapes the page renders, and resolves member
 * names from the employee directory (best-effort). Every mutation calls the real endpoint and
 * re-reads, so the KPI block (which the Streams aggregator recomputes on task changes) stays fresh.
 *
 * **It also re-reads every 30 s** while the tab is visible, as the dashboards do — a teammate's move
 * was invisible until a reload (UX audit PROJ-20). Quietly: no spinner, and nothing re-renders when
 * the answer hasn't changed. Never under a dialog or a drag (`paused`), nor across a write in flight.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { usePermissions } from "@/hooks/use-permissions";
import { LIVE_REFRESH_MS, useLiveRefresh } from "@/hooks/use-live-refresh";
import { friendlyError } from "@/lib/errors";
import {
  getProject,
  getBoard,
  updateProject as apiUpdateProject,
  transferProjectManager,
  deleteProject as apiDeleteProject,
  readProjectDirectory,
  createTask as apiCreateTask,
  updateTask as apiUpdateTask,
  deleteTask as apiDeleteTask,
  addMember,
  addMembers,
  removeMember,
  type ApiProjectMember,
  type ProjectDirectory,
  type ProjectPatch,
} from "./services/projects.service";
import type { Project, Task, TaskStatus } from "./types";
import { mapProjectStatus, toServerStatus } from "./use-projects-data";
import { boardTasks, membersToUserMap, taskPatchFrom, type UserMini } from "./lib";
import type { ProjectFormValues } from "@/modules/projects/forms";
import type { TaskFormValues } from "@/modules/projects/forms";

export interface ProjectDetailData {
  project: Project | null;
  tasks: Task[];
  userMap: Record<string, UserMini>;
  /**
   * The org's departments, for the Edit dialog: `null` when they couldn't be read, `undefined` while
   * the directory is still loading.
   */
  departments: string[] | null | undefined;
  /**
   * `false` once the org directory has refused this caller (no `employees:view`): the Edit dialog's
   * people pickers then hold only the project's own members, and it says so.
   */
  directoryAvailable: boolean;
  /** The caller's resolved project role (`manager` | `lead` | `member`). */
  authority: string;
  /**
   * The people who sign this project's work off — its own Manager and Lead(s), by their member rows.
   * Not `authority`: an org admin resolves to `manager` on every project, but only the project's own
   * lead or manager reviews (owner rule, 2026-10-16).
   */
  reviewerIds: string[];
  loading: boolean;
  /** The page could not be loaded at all — there is nothing to show. */
  error: string | null;
  /** A re-read after the page loaded failed; what is on screen is the last good read. */
  refreshError: string | null;
  /** Distinguishes a 404 (gone / not a member) from a transport error. */
  notFound: boolean;
  /** A visible re-read — the Refresh button, Retry. `loading` is true while it runs. */
  reload: () => void;
  updateProject: (values: ProjectFormValues) => Promise<void>;
  /** Delete the project and every task, member and KPI under it. Irreversible. */
  deleteProject: () => Promise<void>;
  createTask: (values: TaskFormValues) => Promise<void>;
  /** Save an edit of `before` — only the fields that differ from it are sent (`taskPatchFrom`). */
  updateTask: (before: Task, values: TaskFormValues) => Promise<void>;
  /** Optimistic; rejects — after re-reading the board — when the server refuses the move. */
  moveTask: (taskId: string, status: TaskStatus) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
}

export interface ProjectDetailOptions {
  /**
   * True while the page holds something a re-read must not disturb — a dialog open, a card held
   * mid-drag. The 30 s poll skips its ticks meanwhile (UX audit PROJ-20), and re-reads as soon as
   * it is let go if it skipped one.
   */
  paused?: boolean;
}

export function useProjectDetail(
  id: string,
  { paused = false }: ProjectDetailOptions = {},
): ProjectDetailData {
  const { can } = usePermissions();
  const readsDirectory = can("employees:view");
  const managesAll = can("projects:manage");
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<ApiProjectMember[]>([]);
  /** `null` while loading; `"denied"` = no `employees:view`; `"failed"` = any other failure. */
  const [directory, setDirectory] = useState<
    ProjectDirectory | "denied" | "failed" | null
  >(null);
  const [authority, setAuthority] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  /** The project id the page last loaded successfully — a failure after that is a refresh failure. */
  const loadedFor = useRef<string | null>(null);

  // ── Freshness (UX audit PROJ-20) ──
  /** A read is in flight — a poll tick then has nothing to add. */
  const reading = useRef(false);
  /** Writes in flight: a poll waits for them, since each re-reads when it lands. */
  const writing = useRef(0);
  /**
   * Bumped by every optimistic move. A read that began before one is older than what the board now
   * shows, and painting it would spring the card back until the move's own re-read lands.
   */
  const optimisticGen = useRef(0);
  const pausedRef = useRef(paused);
  /** A tick was skipped for `paused` — re-read the moment it lifts. */
  const missedTick = useRef(false);
  /** The last read, serialised: a poll that finds nothing new leaves the page alone. */
  const lastRead = useRef<string | null>(null);

  // Polling stops on a 404: the project is gone, or this person was taken off it.
  const { nonce, reload, refresh, isBackground } = useLiveRefresh(
    notFound ? null : LIVE_REFRESH_MS,
    {
      isBusy: () => {
        if (pausedRef.current) {
          missedTick.current = true;
          return true;
        }
        return reading.current || writing.current > 0;
      },
    },
  );

  /** Run a write with the poll held off until it settles. */
  const whileWriting = useCallback(async <T,>(write: () => Promise<T>): Promise<T> => {
    writing.current += 1;
    try {
      return await write();
    } finally {
      writing.current -= 1;
    }
  }, []);

  // The org directory, read once per visit rather than on every re-read: each drag, save, delete or
  // review re-reads the project, and walking every department partition again to redraw a board was
  // most of what a re-read cost (QA audit 2026-10-08, WP-315).
  useEffect(() => {
    // Without the roster, only this project's Manager (or an org-wide manager) may use the picker —
    // and whether the caller manages it is known once the project has loaded. Wait for that rather
    // than asking and collecting a 403 (live crawl, 2026-10-14).
    if (!readsDirectory && !managesAll && !authority) return;
    let live = true;
    // The project id lets a Manager without `employees:view` use the project's own picker (WP-308).
    readProjectDirectory(id, {
      directory: readsDirectory,
      picker: managesAll || authority === "manager",
    }).then(
      (d) => live && setDirectory(d),
      (e: unknown) =>
        live &&
        setDirectory(e instanceof ApiError && e.status === 403 ? "denied" : "failed"),
    );
    return () => {
      live = false;
    };
  }, [id, readsDirectory, managesAll, authority]);

  useEffect(() => {
    let live = true;
    // A poll is quiet: no spinner, and the page's state stays as it is until the answer is in — an
    // error screen must not flash away and back while it asks again.
    const background = isBackground();
    const gen = optimisticGen.current;
    reading.current = true;
    missedTick.current = false;
    if (!background) {
      setLoading(true);
      setError(null);
      setNotFound(false);
    }

    (async () => {
      try {
        // The board is the page: a failed read of it is a failed load. It used to be caught into
        // `[]`, which drew five empty columns over "0 of 0 tasks signed off" — indistinguishable from
        // a project whose tasks had all been deleted (QA audit 2026-10-08, WP-302).
        const [detail, board] = await Promise.all([getProject(id), getBoard(id)]);
        if (!live) return;
        // A card moved while this was out: the move's own re-read follows, and this one would
        // spring it back in the meantime.
        if (optimisticGen.current !== gen) return;
        // The projects API serves no ETag, so a poll can't be answered 304; comparing the answer is
        // the next best thing — an unchanged board isn't re-rendered twice a minute.
        const read = JSON.stringify([detail, board]);
        if (!background || read !== lastRead.current) {
          setProject(toProject(detail));
          setAuthority(detail.authority);
          setMembers(detail.members);
          setTasks(boardTasks(board, detail.id));
        }
        lastRead.current = read;
        setRefreshError(null);
        setError(null);
        setNotFound(false);
        loadedFor.current = id;
      } catch (e) {
        if (!live) return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        // A re-read that fails once the page has loaded keeps what is on screen. Replacing the board
        // with "Couldn't load the project" right after a "Task updated" toast read as the save having
        // broken the project (QA audit 2026-10-08, WP-303).
        else if (loadedFor.current === id) setRefreshError(messageOf(e));
        else setError(messageOf(e));
      } finally {
        if (live) {
          setLoading(false);
          reading.current = false;
        }
      }
    })();

    return () => {
      live = false;
    };
  }, [id, nonce, isBackground]);

  // After the effect above, so a re-read that a save has just started has cleared `missedTick`.
  useEffect(() => {
    pausedRef.current = paused;
    // Let go after a tick was skipped for it: catch up now, not up to 30 s later.
    if (!paused && missedTick.current) {
      missedTick.current = false;
      refresh();
    }
  }, [paused, refresh]);

  // Names come from the project itself first, the org directory second. `GET /v1/employees` needs
  // `EmployeesRead`, which an Employee doesn't have — it 403s, and the team dialog used to show a
  // member count with no rows and "—" for Lead/Manager. The detail response carries each member's
  // name/title, so the directory is only an enhancement (it adds people who aren't project members —
  // the Edit dialog's pickers for anyone who can read it).
  const userMap = useMemo(
    () => ({
      ...membersToUserMap(members),
      ...(typeof directory === "object" && directory ? directory.people : {}),
    }),
    [members, directory],
  );

  /**
   * `DELETE /v1/projects/{id}` — the project and all its children, server-side.
   *
   * No `reload()` afterwards: the project no longer exists, so re-fetching it would only 404 and
   * flip the page into its not-found state. The caller navigates away instead.
   */
  const deleteProject = useCallback(async () => {
    await whileWriting(() => apiDeleteProject(id));
  }, [id, whileWriting]);

  const updateProject = useCallback(
    async (v: ProjectFormValues) => {
      if (!project) return;
      const patch: ProjectPatch = {
        name: v.name,
        description: v.description,
        billable: v.billable,
        // Always sent, empty string included: the server reads "" as "clear it", so deselecting a
        // department is a real edit rather than an unreachable state.
        department: v.department ?? "",
        // A cleared due date is sent as "" — the server reads that as "remove it" (WP-413); before,
        // an end date once set could never be taken off.
        ...(v.dueDate
          ? { end_date: v.dueDate }
          : project.dueDate
            ? { end_date: "" }
            : {}),
      };
      // Status and key only when they changed (see `ProjectPatch`). Nothing in the app could change
      // either before: a finished project could only be deleted (QA audit 2026-10-08, WP-312).
      // The start moves only when it was changed (PROJ-09).
      if (v.startDate && v.startDate !== project.startDate.slice(0, 10))
        patch.start_date = v.startDate;
      if (v.status && v.status !== project.status)
        patch.status = toServerStatus(v.status);
      const key = v.key?.trim().toUpperCase() ?? "";
      // "" clears a key the project had (WP-413); unchanged keys aren't sent.
      if (key !== (project.key ?? "")) patch.key = key;
      await whileWriting(async () => {
        await apiUpdateProject(id, patch);

        // Membership and roles are separate resources the same dialog edits. Without these the
        // PATCH succeeded, the toast said "saved", and the member just added or the lead just picked
        // was never written — the edit silently lost half of itself.
        try {
          await saveTeam(id, project, v);
        } finally {
          // Re-read whatever happened: a partial save must show what did go through, and the next
          // attempt must compute its changes from the truth rather than from this stale copy.
          reload();
        }
      });
    },
    [id, project, reload, whileWriting],
  );

  const createTask = useCallback(
    async (v: TaskFormValues) => {
      await whileWriting(() =>
        apiCreateTask(id, {
          title: v.title,
          description: v.description,
          status: v.status,
          assignee_ids: v.assigneeIds,
          due: v.dueDate || undefined,
          priority: v.priority,
          // Omitted when there is none: an estimate of zero is a different statement.
          ...(v.estimateHours !== null ? { estimate_hours: v.estimateHours } : {}),
          attachments: v.attachments,
        }),
      );
      reload();
    },
    [id, reload, whileWriting],
  );

  const updateTask = useCallback(
    async (before: Task, v: TaskFormValues) => {
      const patch = taskPatchFrom(before, v);
      // Nothing changed — and the server refuses an empty PATCH.
      if (!patch) return;
      try {
        await whileWriting(() => apiUpdateTask(id, before.id, patch));
      } catch (e) {
        // Changed (409 `task_changed`) or deleted since the board was read: re-read, so the person
        // decides again looking at what is actually there.
        if (e instanceof ApiError && (e.status === 409 || e.status === 404)) reload();
        throw e;
      }
      reload();
    },
    [id, reload, whileWriting],
  );

  const reviewerIds = useMemo(
    () =>
      members
        .filter((m) => m.project_role === "manager" || m.project_role === "lead")
        .map((m) => m.user_id),
    [members],
  );

  const moveTask = useCallback(
    async (taskId: string, status: TaskStatus) => {
      // Optimistic: the card should snap columns instantly on drop; the re-read reconciles. A review
      // belongs to Done, so it doesn't travel with the card out of it. A read already out is now
      // older than the board (see `optimisticGen`).
      optimisticGen.current += 1;
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status, review: status === "done" ? t.review : null }
            : t,
        ),
      );
      try {
        await whileWriting(() => apiUpdateTask(id, taskId, { status }));
      } finally {
        // On success, fresh KPIs; on a refusal, the truth — the card goes back, and the caller says
        // why (the move used to spring back with no word at all — QA audit 2026-10-08, WP-303).
        reload();
      }
    },
    [id, reload, whileWriting],
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      await whileWriting(() => apiDeleteTask(id, taskId));
      reload();
    },
    [id, reload, whileWriting],
  );

  return {
    project,
    tasks,
    userMap,
    departments:
      directory === null
        ? undefined
        : typeof directory === "object"
          ? directory.departments
          : null,
    directoryAvailable: directory !== "denied",
    authority,
    reviewerIds,
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
 * Bring the team and its two roles in line with the form, in the one order that works for every
 * caller.
 *
 * A hand-over stands the outgoing manager down to `member`, and a member can neither set roles nor
 * remove anyone. So everything the current manager must do happens **before** the transfer, and only
 * what the server refuses while someone is still the manager happens after it. The order used to put
 * the transfer before the lead change, so a manager handing over and changing the lead in one save got
 * a 403 on the lead and could no longer fix it; the outgoing manager unticked from the team stayed on
 * it; and standing the old lead down re-added a lead the same save had just removed (QA audit
 * 2026-10-08, WP-299).
 */
async function saveTeam(
  projectId: string,
  project: Project,
  v: ProjectFormValues,
): Promise<void> {
  const prevManager = project.managerId ?? "";
  const nextManager = v.managerId || prevManager;
  // Picking the manager as lead means "no separate lead": a `lead` row for them would overwrite
  // their `manager` membership and strip their authority over their own project (WP-024).
  const nextLead = v.leadUserId && v.leadUserId !== nextManager ? v.leadUserId : "";

  // 1 · Membership — first, because the role writes need their people on the team. Never removed
  //     here: the manager (the server refuses; a hand-over below takes them off if asked), the
  //     incoming manager (a hand-over needs them on it), and the lead.
  //
  //     **The incoming manager is added here**, whether or not they were ticked: the hand-over
  //     refuses anyone not on the team, and the picker offers the whole organization. Picking an
  //     outsider used to save every other change and then fail (UX audit PROJ-08).
  const nextTeam =
    nextManager && nextManager !== prevManager ? [...v.memberIds, nextManager] : v.memberIds;
  await syncMembers(projectId, project.memberIds, nextTeam, [
    prevManager,
    nextManager,
    nextLead,
  ]);
  // 2 · The lead, while the caller still runs the project.
  await syncLead(projectId, {
    prevLead: project.leadUserId,
    nextLead,
    prevManager,
    nextManager,
    memberIds: v.memberIds,
  });
  // 3 · The hand-over, then 4 · what had to wait for it.
  if (nextManager && nextManager !== prevManager) {
    await syncManager(projectId, nextManager);
    await afterHandover(projectId, prevManager, nextLead, v.memberIds);
  }
}

/**
 * Reconcile the project's membership with what the form now says.
 *
 * Two rules keep this honest:
 * - **`keep` is never removed here** — the manager above all. They are a member by construction
 *   (`create_project` writes the `MEMBER#` row alongside the project) and the server refuses to remove
 *   a manager through the membership routes; handing over a project is its own action.
 * - **Failures are reported, not swallowed.** The caller shows a success toast when this resolves, so
 *   a rejected add has to surface; otherwise we are back to the bug this fixes — a "saved" message
 *   over a change that never happened.
 */
async function syncMembers(
  projectId: string,
  current: string[],
  next: string[],
  keep: string[],
): Promise<void> {
  const before = new Set(current);
  const after = new Set(next.filter(Boolean));
  const added = [...after].filter((uid) => !before.has(uid));
  const removed = [...before].filter((uid) => !after.has(uid) && !keep.includes(uid));
  if (!added.length && !removed.length) return;

  // Adds a few at a time (`addMembers`), never one unbounded burst.
  const adds = await addMembers(
    projectId,
    added.map((userId) => ({ userId, role: "member" as const })),
  );
  let failed = adds.failed;
  // Removals one at a time. Each rewrites the assignees of every task the leaver is on, and two at
  // once can undo each other's change on a task they share — leaving it on someone who has left, or
  // on nobody (QA audit 2026-10-08, WP-310).
  for (const uid of removed) {
    try {
      await removeMember(projectId, uid);
    } catch {
      failed += 1;
    }
  }
  if (failed) {
    const total = added.length + removed.length;
    throw new Error(
      failed === total
        ? "The project was saved but its members weren't updated. You may not have permission to manage this project's team."
        : `The project was saved, but ${failed} of ${total} team changes failed. Save again to retry them.`,
    );
  }
}

/**
 * Make `nextLead` the project's lead, and stand the previous one down.
 *
 * Two people can hold `lead` in the data model (LLD §5 allows N), but the dialog offers a single
 * "Project lead", so leaving the old one promoted would make the field lie the moment it was used:
 * the picker would show one name over a project with two leads.
 *
 * The outgoing manager can't be made lead here — their row still says `manager`, which the server
 * will not re-role (WP-024); {@link afterHandover} does it once the transfer has stood them down.
 */
async function syncLead(
  projectId: string,
  r: {
    prevLead: string;
    nextLead: string;
    prevManager: string;
    nextManager: string;
    memberIds: string[];
  },
): Promise<void> {
  if (r.nextLead === r.prevLead) return;
  try {
    if (r.nextLead && r.nextLead !== r.prevManager) {
      await addMember(projectId, r.nextLead, "lead");
    }
    // Stand the previous lead down — unless they have just left the team (a "demotion" is an upsert
    // and would put them back on it), or are taking the project over (the transfer re-roles them).
    if (r.prevLead && r.memberIds.includes(r.prevLead) && r.prevLead !== r.nextManager) {
      await addMember(projectId, r.prevLead, "member");
    }
  } catch (e) {
    throw new Error(
      e instanceof ApiError && e.status === 403
        ? "The project was saved, but the lead wasn't changed. You may not have permission to manage this project's team."
        : `The project was saved, but the lead wasn't changed. ${friendlyError(e)}`,
    );
  }
}

/**
 * Hand the project over. A failure is surfaced rather than swallowed — the caller shows "saved", and
 * a silent refusal here is precisely the bug this dialog has already had twice.
 */
async function syncManager(projectId: string, next: string): Promise<void> {
  try {
    await transferProjectManager(projectId, next);
  } catch (e) {
    throw new Error(
      // The team save above added them, so a 400 now means they left it again in between.
      e instanceof ApiError && e.status === 400
        ? "The project was saved, but the manager wasn't changed — they aren't on the team. Save again to retry."
        : e instanceof ApiError && e.status === 403
          ? "The project was saved, but the manager wasn't changed. Only the current manager or an admin can transfer a project."
          : `The project was saved, but the manager wasn't changed. ${friendlyError(e)}`,
    );
  }
}

/**
 * The two edits the server refuses while someone is still the manager, made once the hand-over has
 * stood them down: making the outgoing manager the lead, or taking them off the team.
 *
 * Both need the project's manager or an admin. When a manager hands over their own project they are
 * no longer either, so these are left to the new manager — and said so, rather than reported as a
 * generic failure.
 */
async function afterHandover(
  projectId: string,
  prevManager: string,
  nextLead: string,
  memberIds: string[],
): Promise<void> {
  if (!prevManager) return;
  const makeLead = nextLead === prevManager;
  const remove = !makeLead && !memberIds.includes(prevManager);
  if (!makeLead && !remove) return;
  try {
    if (makeLead) await addMember(projectId, prevManager, "lead");
    else await removeMember(projectId, prevManager);
  } catch (e) {
    const what = makeLead
      ? "making the previous manager its lead"
      : "taking the previous manager off the team";
    throw new Error(
      e instanceof ApiError && e.status === 403
        ? `The project was handed over. Only its new manager can finish ${what} — ask them to.`
        : `The project was handed over, but ${what} didn't go through. ${friendlyError(e)}`,
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
