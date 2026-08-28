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
import type { UserMini } from "../lib";
import { listAllEmployees } from "@/modules/employees/services/employees.service";

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

// ── Project writes (POST / PATCH / DELETE /v1/projects) ────────────────────────────────────────

/** `POST /v1/projects` body. The server mints the id and makes `manager_user_id` a member. */
export interface NewProject {
  name: string;
  billable: boolean;
  start_date: string;
  end_date?: string;
  manager_user_id: string;
  key: string;
  department?: string;
}

/** `POST /v1/projects` — create a project. Returns the new id; the caller re-reads for the rest. */
export function createProject(body: NewProject): Promise<{ id: string }> {
  return apiFetch<{ id: string }>("/v1/projects", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * `PATCH /v1/projects/{id}` body.
 *
 * `department` is **always sent, empty string included**: the server reads `""` as "clear it", so
 * deselecting a department is a real edit rather than an unreachable state.
 */
export interface ProjectPatch {
  name: string;
  description: string;
  billable: boolean;
  department: string;
  end_date?: string;
}

/** `PATCH /v1/projects/{id}` — edit a project's own fields. Membership is a separate resource. */
export async function updateProject(id: string, body: ProjectPatch): Promise<void> {
  await apiFetch(`/v1/projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/**
 * `DELETE /v1/projects/{id}` — the project and all its children, server-side.
 *
 * The caller must navigate away rather than re-reading: the project no longer exists, so a reload
 * would only 404 and flip the page into its not-found state.
 */
export async function deleteProject(id: string): Promise<void> {
  await apiFetch(`/v1/projects/${encodeURIComponent(id)}`, { method: "DELETE" });
}

// ── Task board (GET /v1/projects/{id}/tasks) ───────────────────────────────────────────────────

/** A file attached to a task. Wire shape is snake_case (`content_type`), served inline on the board. */
export interface ApiAttachment {
  id: string;
  filename: string;
  content_type: string;
  size: number;
}

/** One person on a task, as the server stores the assignment. */
export interface ApiTaskAssignee {
  user_id: string;
  /** Cognito `sub` of whoever put them on it. Empty for assignments made before this was recorded. */
  assigned_by: string;
  /** Epoch ms, 0 when unrecorded. */
  assigned_at: number;
}

/** One subtask, as the server serves it. */
export interface ApiSubtask {
  id: string;
  task_id: string;
  title: string;
  /** Same vocabulary as a task: `todo` | `in_progress` | `in_review` | `done` | `closed` | `blocked`. */
  status: string;
  assignee_id?: string;
  created_by: string;
  created_at: number;
  completed_at?: number;
}

/** The `3/5` counter, computed server-side so every surface agrees what "done" counts. */
export interface ApiSubtaskProgress {
  total: number;
  done: number;
}

interface SubtaskListResponse {
  task_id: string;
  subtasks: ApiSubtask[];
  progress: ApiSubtaskProgress;
}

/**
 * One task's breakdown (`GET /v1/projects/{id}/tasks/{taskId}/subtasks`).
 *
 * **Read-only from the web.** Subtasks are created and ticked off in the desktop app — that is a
 * product decision, not a limitation of this endpoint, which would accept writes from either client.
 * There is deliberately no `createSubtask` here: adding one would put a control in the browser that
 * the desktop app is meant to own.
 *
 * Requires project membership; a non-member gets 404 rather than 403, like every project route.
 */
export function listSubtasks(projectId: string, taskId: string): Promise<SubtaskListResponse> {
  return apiFetch<SubtaskListResponse>(
    `/v1/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/subtasks`,
  );
}

export interface ApiBoardTask {
  id: string;
  title: string;
  description?: string;
  /** Files attached to the task; empty/absent when it has none. */
  attachments?: ApiAttachment[];
  /** Everyone on the task. Absent (not `[]`) when nobody is — the server skips empty vectors. */
  assignees?: ApiTaskAssignee[];
  /**
   * The first assignee, still served for clients that only understand one. Prefer `assignees`;
   * this is a copy kept on the task item and it cannot express a second person.
   */
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
  /**
   * How much of this card's breakdown is finished. Served on the board so the counter needs no
   * second call — the server reads every subtask in the project in one query.
   *
   * Absent only from a server that predates subtasks; treat that as "no breakdown", the same as
   * `{total: 0, done: 0}`.
   */
  subtasks?: ApiSubtaskProgress;
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
  /**
   * True for a task nobody has taken. Only ever set when the caller asked for unclaimed work, which
   * the web app never does — the dashboard card and the timesheet picker both mean *assigned to me*,
   * and folding a project's whole backlog into them would bury the two things someone owns.
   * The desktop panel's picker is the one caller that opts in.
   */
  unassigned?: boolean;
}

/**
 * The caller's tasks. `includeUnassigned` adds the unclaimed work in their projects.
 *
 * Two callers want two different things from the same endpoint, and the flag is what keeps them
 * apart. A list the person *reads* as "my work" must stay assigned-only. A **name lookup** — "what
 * is task `k-01M0HYQ…` called?" — has to cover anything they could have tracked time against, and
 * an unassigned task is exactly that: the desktop picker offers it, so it turns up in timesheets.
 * Resolving its name is not the same as claiming it is theirs.
 */
export function listMyTasks(
  opts: { includeUnassigned?: boolean } = {},
): Promise<ApiMyTask[]> {
  const qs = opts.includeUnassigned ? "?include_unassigned=true" : "";
  return apiFetch<{ tasks: ApiMyTask[] }>(`/v1/me/tasks${qs}`).then((r) => r.tasks);
}

// ── Task mutations ─────────────────────────────────────────────────────────────────────────────

export interface NewTask {
  title: string;
  description?: string;
  /** Everyone to put on it. Omit or send `[]` for unassigned, which offers it to the whole project. */
  assignee_ids?: string[];
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

/** PATCH — omitted fields are left as-is; `null` on `due`/`assignee_ids`/`estimate_hours` clears. */
export interface TaskPatch {
  title?: string;
  description?: string;
  status?: string;
  due?: string | null;
  /**
   * **Replaces** the whole set, like `attachments` — a present array is exactly who ends up on the
   * task. Omit to leave the assignees alone; `[]` or `null` unassigns everyone.
   */
  assignee_ids?: string[] | null;
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
 * `user_id → UserMini` for every person in the org — the option list behind the project's lead,
 * manager and member pickers, and the join that turns an assignee id into a name.
 *
 * Reads the directory through the **employees** module service (`listAllEmployees`), which walks
 * every department partition. Both project hooks used to call a bare `GET /v1/employees` directly:
 * that endpoint truncates to `limit` alphabetically with **no cursor and no signal** (see the
 * warning on `listEmployees`), so a picker built from it silently could not offer anyone past the
 * first page — a member you cannot select reads as a broken form, not a short list.
 *
 * Best-effort by contract: callers fall back to `{}` and render ids, never an error.
 */
export async function directoryUserMap(): Promise<Record<string, UserMini>> {
  const people = await listAllEmployees();
  const map: Record<string, UserMini> = {};
  for (const e of people) {
    map[e.user_id] = { id: e.user_id, name: e.name, jobTitle: e.title ?? "" };
  }
  return map;
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
 * Re-exported from `@/lib/upload`, where it moved when leave documents needed the same presigned
 * PUT. Kept here so existing importers are unaffected; new callers should take it from `lib`.
 */
export { uploadFileToPresignedUrl } from "@/lib/upload";
