/**
 * Projects — the real backend (`projects` context, LLD §5).
 *
 * This is a module service in the sense CLAUDE.md §3 means it: components call this, this calls
 * `lib/api`, and nothing reaches past it. It is the first service on the real seam alongside
 * `time-tracking/services/timesheet.service.ts`.
 *
 * Note the shape is the **server's**, not the mock's. `src/lib/data.ts` exposes a richer `Project`
 * (progress, budget, tags…) invented before the backend existed; the server serves the six fields
 * below and nothing more. Rather than pad the gap with zeroes that look like real measurements,
 * this module models what is actually served and lets callers handle the rest.
 */
import { apiFetch } from "@/lib/api";

/** Mirrors `projects::features::list_projects::dto::ProjectRow`. */
export interface ApiProject {
  id: string;
  name: string;
  /** `active` | `on_hold` | `completed` (LLD §5). */
  status: string;
  /**
   * Why the project is on hold. Present only for `on_hold`, and only `auto_hold` may be auto-lifted
   * when time is logged again — a manual hold is a human decision the sweep must not undo.
   */
  status_reason?: string;
  billable: boolean;
  manager_user_id: string;
}

interface ProjectsResponse {
  projects: ApiProject[];
}

export async function listProjects(): Promise<ApiProject[]> {
  const res = await apiFetch<ProjectsResponse>("/v1/projects");
  return res.projects;
}

/**
 * `project_id` → name, for joining onto rows that carry only ids (timesheet entries, tasks).
 *
 * The server returns ids because names are not its job to denormalize; the client joins once and
 * reuses the map. Callers must tolerate a **miss**: a project can be deleted while an old time
 * entry still references it, and the entry is still true — the time really was worked.
 */
export async function projectNameMap(): Promise<Map<string, string>> {
  const projects = await listProjects();
  return new Map(projects.map((p) => [p.id, p.name]));
}
