"use client";

/**
 * The signed-in user's own work, from the live backend — for the personal (self-scoped) dashboard.
 *
 * `GET /v1/me/tasks` is lean (`{id, project_id, status, due}`, no title), so titles are enriched from
 * each involved project's board. That per-project board fetch is **bounded** ({@link mapWithConcurrency},
 * cap 3) and skip-on-fail — an unbounded burst throttles the Lambda and 503s the page.
 *
 * "My projects" is the projects the user manages plus any they have tasks in (the backend has no
 * per-user membership endpoint). Progress/productivity are agent-gated and simply absent.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { mapWithConcurrency } from "@/lib/concurrency";
import { useAuthStore } from "@/stores/auth.store";
import {
  listMyTasks,
  listProjects,
  getBoard,
  type ApiProject,
} from "@/modules/projects/services/projects.service";

const BOARD_FANOUT = 3;

export interface MyTask {
  id: string;
  title: string;
  projectKey: string | null;
  projectName: string | null;
  status: string;
  due: string | null;
}

export interface MyProject {
  id: string;
  name: string;
  key: string | null;
  status: string;
}

export interface MyWork {
  openTasks: MyTask[];
  doneCount: number;
  myProjects: MyProject[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useMyWork(): MyWork {
  const userId = useAuthStore((s) => s.user?.id ?? "");
  const [openTasks, setOpenTasks] = useState<MyTask[]>([]);
  const [doneCount, setDoneCount] = useState(0);
  const [myProjects, setMyProjects] = useState<MyProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const [tasks, projects] = await Promise.all([listMyTasks(), listProjects()]);
        if (!live) return;

        const projById = new Map<string, ApiProject>(projects.map((p) => [p.id, p]));
        const open = tasks.filter((t) => t.status !== "done");
        const done = tasks.length - open.length;

        // Enrich open-task titles from the boards of just the projects that hold them (bounded).
        const involved = [...new Set(open.map((t) => t.project_id))];
        const boards = await mapWithConcurrency(involved, BOARD_FANOUT, (pid) =>
          getBoard(pid)
            .then((cols) => ({ pid, cols }))
            .catch(() => ({ pid, cols: [] })),
        );
        if (!live) return;
        const titleById = new Map<string, string>();
        for (const { cols } of boards) {
          for (const col of cols) for (const task of col.tasks) titleById.set(task.id, task.title);
        }

        setOpenTasks(
          open
            .map((t) => ({
              id: t.id,
              title: titleById.get(t.id) ?? "Untitled task",
              projectKey: projById.get(t.project_id)?.key ?? null,
              projectName: projById.get(t.project_id)?.name ?? null,
              status: t.status,
              due: t.due ?? null,
            }))
            .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999")),
        );
        setDoneCount(done);

        // My projects: managed ∪ projects I have tasks in.
        const taskProjectIds = new Set(tasks.map((t) => t.project_id));
        const mine = projects.filter(
          (p) => p.manager_user_id === userId || taskProjectIds.has(p.id),
        );
        setMyProjects(
          mine.map((p) => ({ id: p.id, name: p.name, key: p.key ?? null, status: p.status })),
        );
      } catch (e) {
        if (live) setError(messageOf(e));
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [userId, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { openTasks, doneCount, myProjects, loading, error, reload };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    return e.message;
  }
  return "Couldn't load your work. Check your connection and retry.";
}
