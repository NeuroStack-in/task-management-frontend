"use client";

/**
 * The signed-in user's own work, from the live backend — for the personal (self-scoped) dashboard.
 *
 * Two reads: `GET /v1/me/tasks`, which carries each task's **title** (the server batch-gets it), and
 * `GET /v1/projects`. Titles used to be enriched from a board fetch per involved project, repeated
 * on every 30 s poll for names already in the first response — and a throttled board read turned a
 * task into "Untitled task" (QA audit 2026-10-08, WP-204).
 *
 * "My projects" is what `GET /v1/projects` returns for a member — see below. Progress/productivity
 * are agent-gated and simply absent.
 */
import { useEffect, useState } from "react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { ApiError } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { useCurrentRole, usePermissions } from "@/hooks/use-permissions";
import { isOpenTaskStatus } from "@/modules/projects/types";
import {
  listMyTasks,
  listProjects,
  type ApiProject,
} from "@/modules/projects/services/projects.service";

export interface MyTask {
  id: string;
  /** The task's project — what a deep link to the task needs (`/projects/{id}?task=…`, PROJ-03). */
  projectId: string;
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
  /**
   * A load the user is looking at failed — set by a first load or a Retry, never by a quiet poll
   * (that keeps the last good lists). While it is set and nothing has loaded, the lists are unknown,
   * not empty: callers must not render "You're all caught up" or "0" over it.
   */
  error: string | null;
  /** The lists have been read at least once. */
  loaded: boolean;
  reload: () => void;
}

/** @param enabled `false` reads nothing — for a surface where Projects is off for the org. */
export function useMyWork(enabled = true): MyWork {
  const userId = useAuthStore((s) => s.user?.id ?? "");
  // Mirrors the server's discriminator exactly (`list_projects::is_oversight`): org **scope** and
  // the bit, not the bit alone — Employee holds `projects:view` too, as the "may open Projects"
  // gate, so branching on it by itself would treat every contributor as an oversight reader.
  const role = useCurrentRole();
  const { can } = usePermissions();
  const seesWholeOrg = (role?.scope ?? "org") === "org" && can("projects:view");
  const [openTasks, setOpenTasks] = useState<MyTask[]>([]);
  const [doneCount, setDoneCount] = useState(0);
  const [myProjects, setMyProjects] = useState<MyProject[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  // Live: a quiet background re-fetch every 30 s, so time on screen keeps up with what the
  // agents have uploaded. `reload` stays the visible path; the poll uses `refresh`.
  const { nonce, reload, isBackground } = useLiveRefresh(enabled ? undefined : null);
  useEffect(() => {
    const background = isBackground();
    if (!enabled) {
      setLoading(false);
      return;
    }
    let live = true;
    if (!background) {
      setLoading(true);
      setError(null);
    }

    (async () => {
      try {
        const [tasks, projects] = await Promise.all([listMyTasks(), listProjects()]);
        if (!live) return;

        const projById = new Map<string, ApiProject>(projects.map((p) => [p.id, p]));
        // `closed` counts as finished too, not just `done` — see `isOpenTaskStatus`.
        const open = tasks.filter((t) => isOpenTaskStatus(t.status));
        const done = tasks.length - open.length;

        setOpenTasks(
          open
            .map((t) => ({
              id: t.id,
              projectId: t.project_id,
              // Empty only if the task vanished between the server's index read and its batch-get.
              title: t.title?.trim() || "Untitled task",
              projectKey: projById.get(t.project_id)?.key ?? null,
              projectName: projById.get(t.project_id)?.name ?? null,
              status: t.status,
              due: t.due ?? null,
            }))
            .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999")),
        );
        setDoneCount(done);

        // **My projects — the server has usually already answered this.**
        //
        // `GET /v1/projects` branches on the caller's reach (projects::list_projects): an org-scoped
        // reader with `projects:view` gets the whole organisation (`list_all`); everyone else gets
        // `list_mine`, which reads a real `MEMBER#` row per project and so *is* the membership list.
        //
        // This used to re-filter that answer down to "projects I manage, or have a task in", which
        // silently dropped every project someone belongs to but has no task in — the dashboard said
        // 3 while the Projects page, showing the same endpoint unfiltered, said 5. For a contributor
        // the right answer is simply what came back.
        //
        // An org-scoped reader is the one case where the list is *not* membership — it is the whole
        // org — so the narrower heuristic stays for them rather than labelling every project in the
        // company as one they belong to.
        const taskProjectIds = new Set(tasks.map((t) => t.project_id));
        const mine = seesWholeOrg
          ? projects.filter(
              (p) => p.manager_user_id === userId || taskProjectIds.has(p.id),
            )
          : projects;
        setMyProjects(
          mine.map((p) => ({ id: p.id, name: p.name, key: p.key ?? null, status: p.status })),
        );
        setLoaded(true);
        setError(null);
      } catch (e) {
        // A quiet poll that fails keeps the last good lists on screen; a load someone is waiting
        // on says it failed.
        if (live && !background) setError(messageOf(e));
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [enabled, userId, nonce, isBackground, seesWholeOrg]);

  return { openTasks, doneCount, myProjects, loading, error, loaded, reload };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    return e.message;
  }
  return "Couldn't load your work. Check your connection and retry.";
}
