"use client";

/**
 * The Projects surface, from the real backend.
 *
 * The list endpoint is lean (id/name/key/status/billable/manager), so KPIs (progress, velocity,
 * signed-off counts, members) live on per-project detail reads, and tasks on per-project boards. This
 * hook reads them in **two phases**: every detail first — all a card and the stat band need — then
 * every board in the background, for the Tasks tab, the overdue filter and task search. It maps all
 * of it into the `Project`/`Task` shapes the view renders.
 *
 * Server-scoped: `GET /v1/projects` already returns all-projects (oversight) or just-mine (member),
 * so there is **no client-side member filter** — the old `useIsSelfScoped` gate is dropped.
 *
 * Names come from the employee directory (`user_id → name`), best-effort: a role that can't read it
 * still gets the names each project carries for its own members.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { usePermissions } from "@/hooks/use-permissions";
import { mapWithConcurrency } from "@/lib/concurrency";
import {
  listProjects,
  getProject,
  getBoard,
  createProject as apiCreateProject,
  readProjectDirectory,
  addMembers,
  type ApiProjectDetail,
} from "./services/projects.service";
import type { Project, ProjectStatus, Task } from "./types";
import { boardTasks, deriveProjectKey, membersToUserMap, type UserMini } from "./lib";
import type { ProjectFormValues } from "@/modules/projects/forms";

/**
 * Reads in flight at once, in each phase — low enough never to trip the projects Lambda's throttle
 * (an unbounded burst over a live list 503'd the page), high enough that an org loads in a few rounds.
 */
const FANOUT = 4;

/** Signed-off over deliverable tasks — the pair under a card's progress bar. */
export interface TaskSummary {
  done: number;
  total: number;
}

/** What creating a project did, beyond creating it. */
export interface CreatedProject {
  id: string;
  /** People picked for the team (the lead included) who could not be added. */
  notAdded: number;
  /** How many were picked, beyond the manager the project was created with. */
  requested: number;
  /** The creator may not manage the new project's team — only its manager can add the rest. */
  denied: boolean;
}

export interface ProjectsData {
  projects: Project[];
  tasks: Task[];
  /** Per project id, from its KPIs — the same server read as the card's progress bar. */
  taskSummary: Record<string, TaskSummary>;
  userMap: Record<string, UserMini>;
  /** The org's departments, for the New project form; `null` when they couldn't be read. */
  departments: string[] | null;
  /** `false` when the org directory refused this caller — the people pickers are then partial. */
  directoryAvailable: boolean;
  loading: boolean;
  /** The boards are read after the projects; `true` until every one has answered. */
  tasksLoading: boolean;
  error: string | null;
  /** Listed projects whose details could not be read (a fault, worth a retry) — not shown. */
  failedProjects: number;
  /** Listed projects the server won't open for this caller (404: not a member) — not shown. */
  hiddenProjects: number;
  /** Projects whose tasks could not be read — missing from the Tasks tab, the overdue filter and search. */
  failedBoards: number;
  reload: () => void;
  /** Create a project and add the team picked for it; resolves once the server has recorded it. */
  createProject: (values: ProjectFormValues) => Promise<CreatedProject>;
}

export function useProjectsData(): ProjectsData {
  // Which directory reads this caller holds, so none is made only to be refused (see
  // `readProjectDirectory`): the roster needs employees:view, the bare picker projects:create.
  const { can } = usePermissions();
  const readsDirectory = can("employees:view");
  const usesPicker = can("projects:create");
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskSummary, setTaskSummary] = useState<Record<string, TaskSummary>>({});
  const [userMap, setUserMap] = useState<Record<string, UserMini>>({});
  const [departments, setDepartments] = useState<string[] | null>(null);
  const [directoryAvailable, setDirectoryAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [failedProjects, setFailedProjects] = useState(0);
  const [hiddenProjects, setHiddenProjects] = useState(0);
  const [failedBoards, setFailedBoards] = useState(0);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setTasksLoading(true);
    setError(null);

    (async () => {
      try {
        const [list, directory] = await Promise.all([
          listProjects(),
          readProjectDirectory(undefined, { directory: readsDirectory, picker: usesPicker }).then(
            (d) => ({ d, denied: false }),
            (e: unknown) => ({ d: null, denied: e instanceof ApiError && e.status === 403 }),
          ),
        ]);
        if (!live) return;

        // Phase 1 — each project's detail (KPIs, members, dates). A failure is **counted**, not
        // dropped in silence: a project whose read failed simply vanished while "Total projects"
        // counted one fewer (QA audit 2026-10-08, WP-302). A 404 is a project this caller may list
        // but not open; anything else is a fault worth retrying. apiFetch retries transient 503/429.
        let failed = 0;
        let hidden = 0;
        const details = await mapWithConcurrency(list, FANOUT, (p) =>
          getProject(p.id).catch((e: unknown) => {
            if (e instanceof ApiError && e.status === 404) hidden += 1;
            else failed += 1;
            return null;
          }),
        );
        if (!live) return;
        const loaded = details.filter((d): d is ApiProjectDetail => d !== null);

        // Names carried by the projects themselves. The org directory needs `EmployeesRead`, which an
        // Employee doesn't have — it 403s, which is why the cards and the team dialog showed ids
        // instead of people. Every detail carries its members' server-resolved names, so accumulate
        // those and let the directory — when the caller can read it — win for avatars and non-members.
        const fromMembers: Record<string, UserMini> = {};
        for (const d of loaded) Object.assign(fromMembers, membersToUserMap(d.members));

        setProjects(loaded.map(toProject));
        setTaskSummary(Object.fromEntries(loaded.map((d) => [d.id, summaryOf(d)])));
        setUserMap({ ...fromMembers, ...(directory.d?.people ?? {}) });
        setDepartments(directory.d?.departments ?? null);
        setDirectoryAvailable(!directory.denied);
        setFailedProjects(failed);
        setHiddenProjects(hidden);
        setLoading(false);

        // Phase 2 — the boards, in the background. They feed the Tasks tab, the overdue filter and
        // task search, not the cards; the page used to draw nothing until it had downloaded every task
        // in the organisation (QA audit 2026-10-08, WP-315).
        let boardFailures = 0;
        const boards = await mapWithConcurrency(loaded, FANOUT, (d) =>
          getBoard(d.id).then(
            (columns) => boardTasks(columns, d.id),
            () => {
              boardFailures += 1;
              return [] as Task[];
            },
          ),
        );
        if (!live) return;
        setTasks(boards.flat());
        setFailedBoards(boardFailures);
      } catch (e) {
        if (live) setError(messageOf(e));
      } finally {
        if (live) {
          setLoading(false);
          setTasksLoading(false);
        }
      }
    })();

    return () => {
      live = false;
    };
  }, [nonce, readsDirectory, usesPicker]);

  const createProject = useCallback(
    async (v: ProjectFormValues): Promise<CreatedProject> => {
      const manager = v.managerId || v.leadUserId;
      const created = await apiCreateProject({
        name: v.name,
        ...(v.description?.trim() ? { description: v.description.trim() } : {}),
        billable: v.billable,
        start_date: todayIso(),
        end_date: v.dueDate || undefined,
        manager_user_id: manager,
        key: deriveProjectKey(v.name),
        ...(v.department ? { department: v.department } : {}),
      });
      // The manager is a member already (created with the project). The rest are follow-up writes:
      // a failed one doesn't undo a created project, but it is **reported** — they used to go out as
      // one unbounded burst whose failures were discarded under "Project created" (QA audit
      // 2026-10-08, WP-311).
      // The lead is written as a lead (the form collected it and this path used to drop it, so the
      // new project had no lead and the first Edit demanded one — WP-025). A lead who is also the
      // manager needs no row: the manager outranks a lead, and a lead row would overwrite theirs.
      const lead = v.leadUserId && v.leadUserId !== manager ? v.leadUserId : "";
      const writes = [
        ...(lead ? [{ userId: lead, role: "lead" as const }] : []),
        ...v.memberIds
          .filter((id) => id && id !== manager && id !== lead)
          .map((userId) => ({ userId, role: "member" as const })),
      ];
      const { failed, denied } = await addMembers(created.id, writes);
      // No `reload()`: the caller navigates to the new project, and a full re-read of the list here
      // was thrown away the moment it started.
      return { id: created.id, notAdded: failed, requested: writes.length, denied };
    },
    [],
  );

  return {
    projects,
    tasks,
    taskSummary,
    userMap,
    departments,
    directoryAvailable,
    loading,
    tasksLoading,
    error,
    failedProjects,
    hiddenProjects,
    failedBoards,
    reload,
    createProject,
  };
}

/**
 * A card's "N / M signed off", from the project's KPIs — the same server read as the progress bar
 * above it, so the two can't disagree, and the card needn't wait for the board. `total_tasks` is live
 * work only (todo + in progress + in review), so signed-off work is added back for the denominator and
 * blocked stays out — `taskTotals().deliverable`, computed server-side. No KPIs yet = no tasks yet.
 */
function summaryOf(d: ApiProjectDetail): TaskSummary {
  const k = d.kpi;
  if (!k) return { done: 0, total: 0 };
  return { done: k.tasks_by_status.done, total: k.total_tasks + k.tasks_by_status.done };
}

/**
 * Backend project status → the frontend's vocabulary. The server's terminal state is `archived`
 * (LLD §5: active | on_hold | archived); the UI models it as `completed`. Coerced here so every
 * `PROJECT_STATUS_META[status]` lookup downstream is safe — an unmapped status would crash a card
 * (`status.tone` on undefined). Anything unrecognised falls back to `active` rather than throwing.
 */
export function mapProjectStatus(s: string): ProjectStatus {
  if (s === "archived") return "completed";
  if (s === "active" || s === "on_hold" || s === "completed") return s;
  return "active";
}

/** The inverse of {@link mapProjectStatus}, for a PATCH: the server calls "Completed" `archived`. */
export function toServerStatus(s: ProjectStatus): "active" | "on_hold" | "archived" {
  return s === "completed" ? "archived" : s;
}

function toProject(d: Awaited<ReturnType<typeof getProject>>): Project {
  return {
    id: d.id,
    name: d.name,
    description: d.description?.trim() || undefined,
    key: d.key ?? "",
    status: mapProjectStatus(d.status),
    billable: d.billable,
    // KPIs from the Streams aggregator; 0/[] until it has run for a brand-new project.
    progress: d.kpi?.completion_pct ?? 0,
    velocity: d.kpi?.velocity?.length ? d.kpi.velocity : [],
    // **Empty on purpose.** `GET /v1/projects` returns `manager_user_id` and no membership, so the
    // list cannot know the lead without a query per project. It used to alias the manager here,
    // which is what made "Lead" mean "manager" across the app. The row shows `managerId` instead —
    // the person it actually has. See `use-project-detail`, where the real lead is resolvable.
    leadUserId: "",
    managerId: d.manager_user_id || undefined,
    memberIds: d.members.map((m) => m.user_id),
    department: d.department ?? "",
    startDate: d.start_date,
    dueDate: d.end_date ?? "",
  };
}

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to projects.";
    return e.message;
  }
  return "Couldn't load projects. Check your connection and retry.";
}
