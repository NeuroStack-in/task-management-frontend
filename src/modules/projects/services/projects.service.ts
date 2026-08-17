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
import type { TaskReview } from "../types";

/** Mirrors `projects::features::list_projects::dto::ProjectRow`. */
export interface ApiProject {
  id: string;
  name: string;
  /** Short uppercase key (e.g. "WP"). Optional — projects created without one have none. */
  key?: string;
  /** `active` | `on_hold` | `completed` (LLD §5). */
  status: string;
  /**
   * Why the project is on hold. Present only for `on_hold`, and only `auto_hold` may be auto-lifted
   * when time is logged again — a manual hold is a human decision the sweep must not undo.
   */
  status_reason?: string;
  billable: boolean;
  manager_user_id: string;
  /** Owning department label. Absent when the project has none. */
  department?: string;
}

interface ProjectsResponse {
  projects: ApiProject[];
}

export async function listProjects(): Promise<ApiProject[]> {
  const res = await apiFetch<ProjectsResponse>("/v1/projects");
  return res.projects;
}

/**
 * `GET /v1/projects/user/{id}` — the projects a specific employee is a **member** of (manager or
 * member), for the admin employee profile. Oversight-gated (`projects:read`). Same row shape as
 * {@link listProjects}; this is the reverse "which projects is this person on" lookup the plain list
 * can't answer for someone other than the caller.
 */
export async function listUserProjects(userId: string): Promise<ApiProject[]> {
  const res = await apiFetch<ProjectsResponse>(
    `/v1/projects/user/${encodeURIComponent(userId)}`,
  );
  return res.projects;
}

// ── Detail + KPIs (GET /v1/projects/{id}) ──────────────────────────────────────────────────────

/** Precomputed KPIs from the Streams aggregator (`project_kpi`). Absent until it has run. */
export interface ApiProjectKpi {
  completion_pct: number;
  total_tasks: number;
  tasks_by_status: {
    todo: number;
    in_progress: number;
    in_review: number;
    done: number;
    blocked: number;
  };
  overdue_count: number;
  active_members: number;
  /** 7-day completed-per-day series, oldest first. */
  velocity: number[];
  updated_at: number;
}

export interface ApiProjectMember {
  user_id: string;
  project_role: string;
  /**
   * Display name, resolved **server-side** from the `User` item (`projects::project_detail`).
   *
   * This exists so a project's members are visible to anyone who can read the project. Building the
   * names from `GET /v1/employees` needs `EmployeesRead`, which an Employee does not have — that call
   * 403s for them, so the dialog showed a member count with no names and "—" for Lead/Manager.
   *
   * Empty string when the `User` item is gone (a deleted employee whose membership row remains).
   * Optional on the type because a response from before the field shipped simply omits it.
   */
  name?: string;
  /** Job title, same resolution and degradation as `name`. */
  title?: string;
}

export interface ApiProjectDetail {
  id: string;
  name: string;
  key?: string;
  description: string;
  status: string;
  status_reason?: string;
  billable: boolean;
  start_date: string;
  end_date?: string;
  manager_user_id: string;
  auto_hold: boolean;
  /** Owning department label. Absent when the project has none. */
  department?: string;
  members: ApiProjectMember[];
  /** The caller's resolved project role — the UI renders from this, never re-deriving the matrix. */
  authority: string;
  /** `None` until the aggregator has computed KPIs for this project (a brand-new project). */
  kpi?: ApiProjectKpi;
}

export function getProject(id: string): Promise<ApiProjectDetail> {
  return apiFetch<ApiProjectDetail>(`/v1/projects/${encodeURIComponent(id)}`);
}

// ── Task board (GET /v1/projects/{id}/tasks) ───────────────────────────────────────────────────

/** A file attached to a task. Wire shape is snake_case (`content_type`), served inline on the board. */
export interface ApiAttachment {
  id: string;
  filename: string;
  content_type: string;
  size: number;
}

export interface ApiBoardTask {
  id: string;
  title: string;
  description?: string;
  /** Files attached to the task; empty/absent when it has none. */
  attachments?: ApiAttachment[];
  assignee_id?: string;
  due?: string;
  /** `low` | `medium` | `high`. */
  priority: string;
  estimate_hours?: number;
  /**
   * Who created the task (Cognito `sub`). Drives the delete affordance: a project **Member** may
   * delete only their own tasks, so the card can't know whether to offer Delete without this.
   *
   * Absent on tasks written before the server recorded it — read that as "not mine", which is how
   * the server answers too (`delete_task` fails the `created_by = :me` condition).
   */
  created_by?: string;
  /** Sign-off, present only on a `closed` task — served inline so the badge needs no second call. */
  review?: TaskReview;
}

export interface ApiBoardColumn {
  /** `todo` | `in_progress` | `in_review` | `done` | `blocked`. */
  status: string;
  tasks: ApiBoardTask[];
}

interface BoardResponse {
  columns: ApiBoardColumn[];
}

export function getBoard(id: string): Promise<ApiBoardColumn[]> {
  return apiFetch<BoardResponse>(`/v1/projects/${encodeURIComponent(id)}/tasks`).then(
    (r) => r.columns,
  );
}

/**
 * The caller's own tasks (`GET /v1/me/tasks`). The projection is lean — `{id, project_id, status,
 * The caller's own tasks (`GET /v1/me/tasks`).
 *
 * **`title` is returned** — the server resolves it at read time (backend `757971a`). This comment
 * previously said the projection was title-less and that callers had to enrich each id from its
 * project board; that stopped being true and the stale note was why the timesheet rendered raw
 * `k-01KY…` ids where a task name belonged.
 */
export interface ApiMyTask {
  id: string;
  title: string;
  project_id: string;
  status: string;
  due?: string;
}

export function listMyTasks(): Promise<ApiMyTask[]> {
  return apiFetch<{ tasks: ApiMyTask[] }>("/v1/me/tasks").then((r) => r.tasks);
}

// ── Task mutations ─────────────────────────────────────────────────────────────────────────────

export interface NewTask {
  title: string;
  description?: string;
  assignee_id?: string;
  status?: string;
  due?: string;
  priority?: string;
  estimate_hours?: number;
  attachments?: ApiAttachment[];
}

export function createTask(projectId: string, body: NewTask): Promise<ApiBoardTask> {
  return apiFetch<ApiBoardTask>(`/v1/projects/${encodeURIComponent(projectId)}/tasks`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** PATCH — omitted fields are left as-is; `null` on `due`/`assignee_id`/`estimate_hours` clears. */
export interface TaskPatch {
  title?: string;
  description?: string;
  status?: string;
  due?: string | null;
  assignee_id?: string | null;
  priority?: string;
  estimate_hours?: number | null;
  /** A present array REPLACES the whole attachment set; omit to leave it unchanged. */
  attachments?: ApiAttachment[];
}

export function updateTask(
  projectId: string,
  taskId: string,
  patch: TaskPatch,
): Promise<ApiBoardTask> {
  return apiFetch<ApiBoardTask>(
    `/v1/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
}

/**
 * `DELETE /v1/projects/{id}/tasks/{taskId}` — 204, and idempotent (deleting a task that is already
 * gone succeeds).
 *
 * **Authority is the server's**: Manager/Lead — and an admin holding `projects:manage` — delete any
 * task; a plain Member deletes only tasks they created and gets a 403 otherwise. Gate the button
 * with `canDeleteTask` (`../lib`) so the UI agrees with that answer, never stands in for it.
 */
export async function deleteTask(projectId: string, taskId: string): Promise<void> {
  await apiFetch(
    `/v1/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`,
    { method: "DELETE" },
  );
}

// ── Membership ─────────────────────────────────────────────────────────────────────────────────

export function addMember(
  projectId: string,
  userId: string,
  role: "lead" | "member" = "member",
): Promise<ApiProjectMember> {
  return apiFetch<ApiProjectMember>(
    `/v1/projects/${encodeURIComponent(projectId)}/members`,
    { method: "POST", body: JSON.stringify({ user_id: userId, role }) },
  );
}

export async function removeMember(projectId: string, userId: string): Promise<void> {
  await apiFetch(
    `/v1/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`,
    { method: "DELETE" },
  );
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

/**
 * `POST /v1/projects/{id}/tasks/{taskId}/review` — rate a finished task and close it.
 *
 * Only a Manager or Lead on the project may call it (org admins and owners resolve to Manager), and
 * never for their own task. `closed` is reachable **only** this way: PATCHing the status will not
 * set it, because a state meaning "approved" must not be settable by the person seeking approval.
 */
export function reviewTask(
  projectId: string,
  taskId: string,
  body: { rating: number; note?: string },
): Promise<{ task_id: string; status: string; review: TaskReview }> {
  return apiFetch(
    `/v1/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/review`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

// ── Task attachments ─────────────────────────────────────────────────────────────────────────────

/**
 * `POST /v1/projects/{id}/task-attachments/presign` — mint a presigned S3 PUT URL for one file.
 *
 * Returns the `attachment_id` the task must record and the `upload_url` to PUT the raw bytes to.
 * Uploading is a *separate* step ({@link uploadFileToPresignedUrl}) against S3, not this API.
 */
export function presignTaskAttachment(
  projectId: string,
  filename: string,
  contentType: string,
): Promise<{ attachment_id: string; upload_url: string }> {
  return apiFetch(
    `/v1/projects/${encodeURIComponent(projectId)}/task-attachments/presign`,
    {
      method: "POST",
      body: JSON.stringify({ filename, content_type: contentType }),
    },
  );
}

/**
 * `GET /v1/projects/{id}/tasks/{taskId}/attachments/{attachmentId}/download` — a short-lived
 * presigned GET URL for one attachment. Returns just the URL; the caller opens or fetches it.
 */
export function getAttachmentDownloadUrl(
  projectId: string,
  taskId: string,
  attachmentId: string,
): Promise<string> {
  return apiFetch<{ url: string }>(
    `/v1/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(attachmentId)}/download`,
  ).then((r) => r.url);
}

/**
 * PUT the raw file bytes to a presigned S3 URL. **Not** through `apiFetch`: this is an external S3
 * host and must carry no auth headers — the signature is in the URL. Throws on any non-2xx.
 */
export async function uploadFileToPresignedUrl(
  uploadUrl: string,
  file: File,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!res.ok) {
    throw new Error(`Upload failed (${res.status})`);
  }
}
