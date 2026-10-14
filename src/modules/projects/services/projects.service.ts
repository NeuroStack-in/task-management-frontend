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
import { ApiError, apiFetch } from "@/lib/api";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { TaskReview } from "../types";
import type { UserMini } from "../lib";
import { readRoster } from "@/modules/employees/services/employees.service";

/** Mirrors `projects::features::list_projects::dto::ProjectRow`. */
export interface ApiProject {
  id: string;
  name: string;
  /** Short uppercase key (e.g. "WP"). Optional — projects created without one have none. */
  key?: string;
  /**
   * `active` | `on_hold` | `archived` (LLD §5). The UI calls `archived` "Completed" —
   * `mapProjectStatus` translates, so compare the mapped value, never this raw one, to `"completed"`.
   */
  status: string;
  /**
   * Why the project is on hold: `auto-hold` (the nightly sweep parked it) or `manual`. Present only
   * for `on_hold`, and only `auto-hold` is lifted when time is logged again — a manual hold is a human
   * decision the sweep must not undo.
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

/**
 * Precomputed KPIs from the Streams aggregator (`project_kpi`). Absent until it has run, and
 * recomputed only when a task changes — so the clock-relative fields describe the moment of the
 * last change, not now.
 */
export interface ApiProjectKpi {
  /** Weighted 0–100 over every task except blocked (the board's `STATUS_WEIGHT`). */
  completion_pct: number;
  /**
   * **Live work only: todo + in progress + in review.** The server already excludes `done` and
   * `blocked`, so this is the open-task count as it stands — subtracting `tasks_by_status.done` from
   * it counts the finished work out a second time (QA audit 2026-10-08, WP-316).
   */
  total_tasks: number;
  tasks_by_status: {
    todo: number;
    in_progress: number;
    in_review: number;
    done: number;
    blocked: number;
  };
  /** Open tasks past their due date **as of the last recompute** — a quiet project keeps its count. */
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
  /** Accepted by the server; the form collected it and the create path used to drop it (WP-025). */
  description?: string;
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
 *
 * `status` and `key` go **only when they changed**. Re-sending an unchanged `on_hold` is not a no-op:
 * the server stamps every hold it is sent as `manual`, which would turn a sweep's `auto-hold` into one
 * that logging time no longer lifts. A blank `key` or `end_date` **clears** it (WP-413), and the
 * server refuses an end date before the project's start.
 */
export interface ProjectPatch {
  name: string;
  description: string;
  billable: boolean;
  department: string;
  end_date?: string;
  status?: "active" | "on_hold" | "archived";
  key?: string;
}

/** `PATCH /v1/projects/{id}` — edit a project's own fields. Membership is a separate resource. */
export async function updateProject(id: string, body: ProjectPatch): Promise<void> {
  await apiFetch(`/v1/projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/**
 * `POST /v1/projects/{id}/transfer-manager` — hand the project to another member.
 *
 * Its own route because membership cannot express it: `POST /members` refuses the `manager` role
 * outright, since a project has exactly one and it is a property of the project rather than of a
 * membership row. The server promotes the new manager, repoints `manager_user_id`, and stands the
 * previous manager down, in that order.
 *
 * **They must already be on the project** — the server rejects a stranger rather than adding them,
 * so save membership first. Idempotent: transferring to the current manager is a no-op 200, which
 * is what lets the Edit dialog send this on every save.
 */
export async function transferProjectManager(
  projectId: string,
  userId: string,
): Promise<void> {
  await apiFetch(`/v1/projects/${encodeURIComponent(projectId)}/transfer-manager`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
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
export function listSubtasks(
  projectId: string,
  taskId: string,
): Promise<SubtaskListResponse> {
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
  /**
   * Sign-off, served inline so the badge needs no second call. Read it only on a `done` task:
   * rows reopened before the server cleared it on leaving Done may still carry one (`boardTasks`
   * drops it there).
   */
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
  /**
   * Everyone to put on it — **at least one, at most 10** (`assignment::require_someone`,
   * `MAX_ASSIGNEES`). Omitted or `[]` is a 400: unassigned tasks were retired on 2026-09-01.
   */
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

/**
 * PATCH — omitted fields are left as-is; `null` on `due`/`estimate_hours` clears. Send only what
 * changed (`taskPatchFrom`): an empty patch is a 400, and a changed status/due/assignee set is
 * conditioned on the rest of the task's index position being unchanged — **409 `task_changed`** means
 * someone else edited (or deleted) it meanwhile, so re-read before retrying.
 */
export interface TaskPatch {
  title?: string;
  description?: string;
  status?: string;
  due?: string | null;
  /**
   * **Replaces** the whole set, like `attachments` — a present array is exactly who ends up on the
   * task. Omit to leave the assignees alone. `[]` and `null` are refused: a task keeps at least one
   * person on it (`assignment::require_someone`), and at most 10.
   */
  assignee_ids?: string[];
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

/** Membership writes in flight at once — writes are never retried, so a throttled one is lost. */
const MEMBER_WRITE_FANOUT = 3;

/**
 * Add several people to a project, a few at a time. Resolves to how many writes failed, and whether
 * the caller was refused outright (`denied`) — then the rest are not sent, since each would be
 * refused too. Never rejects: the caller decides what a shortfall means.
 *
 * Callers used to fire every add at once and discard the failures, so "Select all" on a big org sent
 * a hundred simultaneous writes and reported success over whichever were throttled (QA audit
 * 2026-10-08, WP-311).
 */
export async function addMembers(
  projectId: string,
  writes: { userId: string; role: "lead" | "member" }[],
): Promise<{ failed: number; denied: boolean }> {
  if (writes.length === 0) return { failed: 0, denied: false };
  const add = (w: { userId: string; role: "lead" | "member" }) =>
    addMember(projectId, w.userId, w.role).then(
      () => ({ ok: true as const }),
      (error: unknown) => ({ ok: false as const, error }),
    );
  // One first, alone: someone who may not manage the team (a creator who named another manager, for
  // one) is refused every add, and finding that out once beats a burst of refusals.
  const first = await add(writes[0]);
  if (!first.ok && first.error instanceof ApiError && first.error.status === 403) {
    return { failed: writes.length, denied: true };
  }
  const rest = await mapWithConcurrency(writes.slice(1), MEMBER_WRITE_FANOUT, add);
  return {
    failed: [first, ...rest].filter((r) => !r.ok).length,
    denied: false,
  };
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

/** What the project forms can offer from the org directory. */
export interface ProjectDirectory {
  /** `user_id → UserMini` for every person in the org. */
  people: Record<string, UserMini>;
  /** The org's department names, for the Department picker; `null` when they couldn't be read. */
  departments: string[] | null;
}

/**
 * The org directory as the project forms use it — the option list behind the lead, manager and
 * member pickers, the join that turns an assignee id into a name, and the Department picker's
 * options (one walk serves all three: the roster read lists the departments on the way).
 *
 * Reads through the **employees** module service (`readRoster`), which walks every department
 * partition. Both project hooks used to call a bare `GET /v1/employees` directly: that endpoint
 * truncates to `limit` alphabetically with **no cursor and no signal** (see the warning on
 * `listEmployees`), so a picker built from it silently could not offer anyone past the first page —
 * a member you cannot select reads as a broken form, not a short list.
 *
 * Needs `employees:view` (both routes are `EmployeesRead`). **Without it** — an org Employee who
 * manages a project — it falls back to the projects context's own picker, `GET /v1/projects/people`
 * (`?project_id=` for an existing project's Manager, bare for someone who may create projects), so
 * "Add members" is no longer empty for them (WP-308). Only when that is refused too does the caller
 * get the 403, and the hooks fall back to the names the project itself carries.
 */
export async function readProjectDirectory(
  projectId?: string,
  access?: DirectoryAccess,
): Promise<ProjectDirectory> {
  let roster: Awaited<ReturnType<typeof readRoster>> | null = null;
  // Skip a read the caller is known not to hold, rather than collecting its 403 — an org Employee
  // opening Projects used to make three refused requests per visit (live crawl, 2026-10-14).
  if (access?.directory !== false) {
    try {
      roster = await readRoster();
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 403)) throw e;
    }
  }
  if (!roster) {
    if (access?.picker === false) {
      // Neither read is open to this caller: answer as the server would, without asking it. The
      // hooks treat a 403 as "use the names the project itself carries".
      throw new ApiError("You can't view the employee list.", 403, "forbidden");
    }
    return readPickerDirectory(projectId);
  }
  const people: Record<string, UserMini> = {};
  for (const e of roster.employees) {
    people[e.user_id] = {
      id: e.user_id,
      name: e.name,
      jobTitle: e.title ?? "",
      inactive: e.status === "deactivated" || e.login === "none",
    };
  }
  return {
    people,
    departments: roster.departments
      ? roster.departments.map((d) => d.name).sort((a, b) => a.localeCompare(b))
      : null,
  };
}

/**
 * What the caller may read, so `readProjectDirectory` can skip a request bound to be refused.
 * Mirrors the server: the roster needs `employees:view`; the picker needs `projects:create` (bare) or
 * the right to manage that project (`?project_id=`). Omitted ⇒ try both, as before.
 */
export interface DirectoryAccess {
  directory: boolean;
  picker: boolean;
}

/** Mirrors `projects::features::people::PeopleResponse`. */
interface ApiPickerResponse {
  people: { user_id: string; name: string; title?: string; inactive: boolean }[];
  departments: string[];
}

/** `GET /v1/projects/people[?project_id=]` — the projects-scoped picker (see above). */
async function readPickerDirectory(projectId?: string): Promise<ProjectDirectory> {
  const q = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
  const res = await apiFetch<ApiPickerResponse>(`/v1/projects/people${q}`);
  const people: Record<string, UserMini> = {};
  for (const p of res.people) {
    people[p.user_id] = {
      id: p.user_id,
      name: p.name,
      jobTitle: p.title ?? "",
      inactive: p.inactive,
    };
  }
  return { people, departments: res.departments };
}

/**
 * `POST /v1/projects/{id}/tasks/{taskId}/review` — rate a task that is **in review** and sign it
 * off, which moves it to `done` with the rating and the reviewer's name recorded.
 *
 * Only a Manager or Lead on the project may call it (org admins and owners resolve to Manager), and
 * never for their own task; any other status is a 409 `task_not_awaiting_review`. A Manager or Lead
 * can also drag a card to Done, which records neither — and moving a signed-off task out of Done
 * clears its review.
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
