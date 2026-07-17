"use client";

/**
 * The Projects surface, from the real backend.
 *
 * The list endpoint is lean (id/name/key/status/billable/manager), so KPIs (progress, velocity,
 * overdue, members) and the task board live on per-project reads. This hook fans those out — one
 * `detail` + one `board` per project — and maps everything into the `Project`/`Task` shapes the
 * existing view renders, so the components don't change shape, only their data source.
 *
 * Server-scoped: `GET /v1/projects` already returns all-projects (oversight) or just-mine (member),
 * so there is **no client-side member filter** — the old `useIsSelfScoped` gate is dropped.
 *
 * Names come from the employee directory (`user_id → name`), best-effort: a role that can't read it
 * still gets the board, just with short ids instead of names.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError, apiFetch } from "@/lib/api";
import {
  listProjects,
  getProject,
  getBoard,
  createTask as apiCreateTask,
  updateTask as apiUpdateTask,
  deleteTask as apiDeleteTask,
  addMember,
} from "./services/projects.service";
import type { NewTask, TaskPatch } from "./services/projects.service";
import type {
  Project,
  ProjectStatus,
  Task,
  TaskPriority,
  TaskStatus,
} from "./types";
import type { UserMini } from "./lib";
import type { ProjectFormValues } from "@/stores/projects.store";

export interface ProjectsData {
  projects: Project[];
  tasks: Task[];
  userMap: Record<string, UserMini>;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** Create a project (+ its extra members); resolves to the new id after the server records it. */
  createProject: (values: ProjectFormValues) => Promise<string>;
  createTask: (projectId: string, body: NewTask) => Promise<void>;
  updateTask: (projectId: string, taskId: string, patch: TaskPatch) => Promise<void>;
  deleteTask: (projectId: string, taskId: string) => Promise<void>;
}

export function useProjectsData(): ProjectsData {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [userMap, setUserMap] = useState<Record<string, UserMini>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [list, names] = await Promise.all([
          listProjects(),
          resolveUserMap().catch(() => ({}) as Record<string, UserMini>),
        ]);
        if (!live) return;

        // Per-project detail (KPIs, members, dates) + board (tasks), fanned out.
        const enriched = await Promise.all(
          list.map(async (p) => {
            const [detail, board] = await Promise.all([
              getProject(p.id),
              getBoard(p.id).catch(() => []),
            ]);
            return { detail, board };
          }),
        );
        if (!live) return;

        const projs: Project[] = [];
        const allTasks: Task[] = [];
        for (const { detail, board } of enriched) {
          projs.push(toProject(detail));
          for (const col of board) {
            for (const t of col.tasks) {
              allTasks.push({
                id: t.id,
                projectId: detail.id,
                title: t.title,
                status: col.status as TaskStatus,
                assigneeId: t.assignee_id ?? null,
                priority: (t.priority as TaskPriority) ?? "medium",
                dueDate: t.due ?? null,
                estimateHours: t.estimate_hours ?? 0,
              });
            }
          }
        }

        setProjects(projs);
        setTasks(allTasks);
        setUserMap(names);
      } catch (e) {
        if (live) setError(messageOf(e));
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [nonce]);

  const createProject = useCallback(
    async (v: ProjectFormValues) => {
      const manager = v.managerId || v.leadUserId;
      const created = await apiFetch<{ id: string }>("/v1/projects", {
        method: "POST",
        body: JSON.stringify({
          name: v.name,
          billable: v.billable,
          start_date: todayIso(),
          end_date: v.dueDate || undefined,
          manager_user_id: manager,
          key: deriveKey(v.name),
        }),
      });
      // The manager is a member already (created with the project). Add the rest, best-effort — a
      // failed add shouldn't undo a created project.
      const extras = v.memberIds.filter((id) => id && id !== manager);
      await Promise.allSettled(extras.map((id) => addMember(created.id, id, "member")));
      reload();
      return created.id;
    },
    [reload],
  );

  const createTask = useCallback(
    async (projectId: string, body: NewTask) => {
      await apiCreateTask(projectId, body);
      reload();
    },
    [reload],
  );

  const updateTask = useCallback(
    async (projectId: string, taskId: string, patch: TaskPatch) => {
      await apiUpdateTask(projectId, taskId, patch);
      reload();
    },
    [reload],
  );

  const deleteTask = useCallback(
    async (projectId: string, taskId: string) => {
      await apiDeleteTask(projectId, taskId);
      reload();
    },
    [reload],
  );

  return {
    projects,
    tasks,
    userMap,
    loading,
    error,
    reload,
    createProject,
    createTask,
    updateTask,
    deleteTask,
  };
}

function toProject(d: Awaited<ReturnType<typeof getProject>>): Project {
  return {
    id: d.id,
    name: d.name,
    description: d.description?.trim() || undefined,
    key: d.key ?? "",
    status: d.status as ProjectStatus,
    billable: d.billable,
    // KPIs from the Streams aggregator; 0/[] until it has run for a brand-new project.
    progress: d.kpi?.completion_pct ?? 0,
    velocity: d.kpi?.velocity?.length ? d.kpi.velocity : [],
    leadUserId: d.manager_user_id,
    managerId: d.manager_user_id || undefined,
    memberIds: d.members.map((m) => m.user_id),
    // The server doesn't model a project department; blank rather than invented.
    department: "",
    startDate: d.start_date,
    dueDate: d.end_date ?? "",
  };
}

/** `user_id → UserMini` from the employee directory. Best-effort (see the module note). */
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

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** "Atlas Migration" → "AM"; mirrors the old store's derivation so cards keep a key badge. */
function deriveKey(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const base =
    words.length >= 2 ? words[0][0] + words[1][0] : (words[0] ?? "PR").slice(0, 3);
  return base.toUpperCase().slice(0, 4) || "PRJ";
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to projects.";
    return e.message;
  }
  return "Couldn't load projects. Check your connection and retry.";
}
