/**
 * Employees — the real backend (`workforce` context, LLD §6).
 *
 * The directory list is deliberately lean (GSI-projected): `{user_id, name, title?, status,
 * department_id}`. It does **not** carry email, avatar, role, team, or a productivity score:
 *   - email/role/team live on the full profile (`GET /v1/employees/{id}`), not the list;
 *   - **productivityScore needs `insights`, which needs the desktop agent's activity data** — not
 *     flowing yet. So the roster is real; the monitoring numbers degrade honestly to "unavailable".
 */
import { apiFetch } from "@/lib/api";

/** Mirrors `workforce::directory_list::dto::EmployeeRow`. */
export interface ApiEmployee {
  user_id: string;
  name: string;
  title?: string;
  /** Human-facing employee id (e.g. `EMP-0001`). Absent for legacy/seeded rows minted before ids. */
  emp_id?: string;
  /** `active` | `deactivated`. */
  status: string;
  department_id: string;
}

interface DirectoryResponse {
  employees: ApiEmployee[];
  cursor?: string;
}

export function listEmployees(): Promise<ApiEmployee[]> {
  return apiFetch<DirectoryResponse>("/v1/employees").then((r) => r.employees);
}

/** Mirrors `workforce::departments::dto::DepartmentView`. */
export interface ApiDepartment {
  id: string;
  name: string;
  /** Epoch **ms**. Omitted by the server on the rename response (`PATCH` doesn't re-read the item). */
  created_at?: number;
}

/** `GET /v1/departments` — bare array in `data` (not `{departments}`). Gated on `employees:read`. */
export function listDepartments(): Promise<ApiDepartment[]> {
  return apiFetch<ApiDepartment[]>("/v1/departments");
}

/** `department_id → name`, for turning the directory's ids into labels. Best-effort. */
export async function departmentMap(): Promise<Map<string, string>> {
  const depts = await listDepartments();
  return new Map(depts.map((d) => [d.id, d.name]));
}

/** Mirrors `workforce::employee_profile::dto::EmployeeProfile` (`GET /v1/employees/{id}`). */
export interface ApiEmployeeProfile {
  user_id: string;
  name: string;
  email: string;
  emp_id?: string;
  title?: string;
  department_id?: string;
  team_id?: string;
  location?: string;
  phone?: string;
  role_id?: string;
  /** `active` | `deactivated`. */
  status: string;
  /** Epoch **ms**. */
  joined_at?: number;
}

export function getEmployeeProfile(userId: string): Promise<ApiEmployeeProfile> {
  return apiFetch<ApiEmployeeProfile>(`/v1/employees/${encodeURIComponent(userId)}`);
}

/** Mirrors `workforce::teams::dto::TeamView`. Every team belongs to exactly one department. */
export interface ApiTeam {
  id: string;
  name: string;
  department_id: string;
  /** Omitted when the team has no lead. */
  lead_id?: string;
}

/** `GET /v1/teams[?dept=]` — gated on `employees:read`. Tolerates both the bare-array and
 *  `{teams}` envelope shapes seen from this endpoint. */
export async function listTeams(departmentId?: string): Promise<ApiTeam[]> {
  const qs = departmentId ? `?dept=${encodeURIComponent(departmentId)}` : "";
  const data = await apiFetch<ApiTeam[] | { teams: ApiTeam[] }>(`/v1/teams${qs}`);
  return Array.isArray(data) ? data : (data?.teams ?? []);
}

/** `team_id → name`, for turning the profile's id into a label. Best-effort. */
export async function teamMap(): Promise<Map<string, string>> {
  const teams = await listTeams();
  return new Map(teams.map((t) => [t.id, t.name]));
}

// ── Department & team administration (LLD §6) ────────────────────────────────────────────────
//
// Reads above are gated on `employees:read`; every mutation below is gated on the backend's
// `org:manage` bit ("Manage departments & teams"), which sits in the server's `employees` module
// group. The frontend catalog has no `org:manage` id, so callers gate on `employees:manage` — the
// same bit this module already uses for its other write affordances. The server is the real gate.

/**
 * `PATCH /v1/departments/{id}` — rename. The whole body is `{name}`; a blank/whitespace name is
 * rejected 400. Responds with the updated department, but **without `created_at`** (the handler
 * doesn't re-read the stored item), so don't rely on that field from this call.
 */
export function renameDepartment(id: string, name: string): Promise<ApiDepartment> {
  return apiFetch<ApiDepartment>(`/v1/departments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

/**
 * `DELETE /v1/departments/{id}`. Guarded server-side: a department that still has teams is
 * **409 `department_in_use`**, because deleting it would orphan `team.department_id`. Empty the
 * department's teams first. A missing department is 404.
 */
export async function deleteDepartment(id: string): Promise<void> {
  await apiFetch<{ id: string; deleted: boolean }>(
    `/v1/departments/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

/**
 * `PATCH /v1/teams/{id}` — partial update; every field is optional and omitted fields are left
 * alone. Only `name` is sent here: moving a team between departments and (re)assigning `lead_id`
 * are supported by the server but have no UI yet. Note the server silently ignores a blank `name`
 * rather than rejecting it, so validate before calling.
 */
export function renameTeam(id: string, name: string): Promise<ApiTeam> {
  return apiFetch<ApiTeam>(`/v1/teams/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

/** `DELETE /v1/teams/{id}`. Unlike departments this has **no in-use guard** server-side — a team
 *  with members deletes cleanly. A missing team is 404. */
export async function deleteTeam(id: string): Promise<void> {
  await apiFetch<{ id: string; deleted: boolean }>(
    `/v1/teams/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

/** `POST /v1/employees/{id}/deactivate` — the lifecycle action (LLD §6). */
export async function deactivateEmployee(userId: string): Promise<void> {
  await apiFetch(`/v1/employees/${encodeURIComponent(userId)}/deactivate`, {
    method: "POST",
  });
}

/** `POST /v1/employees/{id}/reactivate`. */
export async function reactivateEmployee(userId: string): Promise<void> {
  await apiFetch(`/v1/employees/${encodeURIComponent(userId)}/reactivate`, {
    method: "POST",
  });
}

// ── Invites (LLD §6) ─────────────────────────────────────────────────────────────────────────

/**
 * The created invite. **`token` and `otp` are returned exactly once** — only their hashes are
 * stored, so they can never be retrieved again. The server also attempts an email, but SES delivery
 * isn't enabled in this environment, so the admin relays these manually. There is **no list-invites
 * endpoint** (GET is 405), so a created invite can only be acted on (revoke/resend) right here.
 */
export interface ApiInviteCreated {
  invite_id: string;
  emp_id: string;
  email: string;
  role_id: string;
  team_id?: string;
  /** `pending` on creation. */
  status: string;
  /** Epoch **seconds**. */
  expires_at: number;
  token: string;
  otp: string;
}

/** `POST /v1/employees/invites` — mint an invite. Department/team are assigned after they join. */
export function createInvite(body: {
  email: string;
  role_id: string;
  team_id?: string;
}): Promise<ApiInviteCreated> {
  return apiFetch<ApiInviteCreated>("/v1/employees/invites", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** `POST /v1/employees/invites/{id}/revoke`. */
export async function revokeInvite(inviteId: string): Promise<void> {
  await apiFetch(`/v1/employees/invites/${encodeURIComponent(inviteId)}/revoke`, {
    method: "POST",
  });
}

/** `POST /v1/employees/invites/{id}/resend` — re-attempts delivery (new email, same invite). */
export async function resendInvite(inviteId: string): Promise<void> {
  await apiFetch(`/v1/employees/invites/${encodeURIComponent(inviteId)}/resend`, {
    method: "POST",
  });
}
