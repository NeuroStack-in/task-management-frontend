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
  /** RBAC role id (e.g. `role-owner`) — enriched from the base user item so the list can show Role. */
  role_id?: string;
  /**
   * `"none"` for a **monitored** employee — a directory record that can never sign in
   * (MANAGED-AGENT.md §6.4). **Absent** for everyone else, including every row that predates the
   * field, which is what keeps the badge additive.
   *
   * The list needs it because "cannot sign in" and "invited, hasn't accepted yet" render
   * identically today and mean opposite things.
   */
  login?: string;
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

export interface ApiDepartment {
  id: string;
  name: string;
  created_at?: number;
}

/** `GET /v1/departments` → the org's departments (bare array in `data`). Needs `employees:view`. */
export function listDepartments(): Promise<ApiDepartment[]> {
  return apiFetch<ApiDepartment[]>("/v1/departments");
}

/** `department_id → name`, for turning the directory's ids into labels. Best-effort. */
export async function departmentMap(): Promise<Map<string, string>> {
  const depts = await listDepartments();
  return new Map(depts.map((d) => [d.id, d.name]));
}

/** `POST /v1/departments` — create a department. Needs `settings:manage` (backend `OrgManage`). */
export function createDepartment(name: string): Promise<ApiDepartment> {
  return apiFetch<ApiDepartment>("/v1/departments", {
    method: "POST",
    body: JSON.stringify({ name: name.trim() }),
  });
}

/** `PATCH /v1/departments/{id}` — rename a department. Needs `settings:manage`. */
export function updateDepartment(id: string, name: string): Promise<ApiDepartment> {
  return apiFetch<ApiDepartment>(`/v1/departments/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ name: name.trim() }),
  });
}

/** `DELETE /v1/departments/{id}`. Needs `settings:manage`. */
export async function deleteDepartment(id: string): Promise<void> {
  await apiFetch(`/v1/departments/${encodeURIComponent(id)}`, { method: "DELETE" });
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

export interface ApiTeam {
  id: string;
  name: string;
  department_id?: string;
  /** `user_id` of the team's lead, if one is assigned. */
  lead_id?: string;
}

/** Tolerate both a bare array and a `{ teams }` envelope in `data`. */
function unwrapTeams(data: ApiTeam[] | { teams: ApiTeam[] }): ApiTeam[] {
  return Array.isArray(data) ? data : (data?.teams ?? []);
}

/** `GET /v1/teams` → the org's teams. Needs `employees:view`. */
export async function listTeams(): Promise<ApiTeam[]> {
  const data = await apiFetch<ApiTeam[] | { teams: ApiTeam[] }>("/v1/teams");
  return unwrapTeams(data);
}

/** `team_id → name`, for turning the profile's id into a label. Best-effort (bare array in `data`). */
export async function teamMap(): Promise<Map<string, string>> {
  const teams = await listTeams();
  return new Map(teams.map((t) => [t.id, t.name]));
}

/** `POST /v1/teams` — create a team. Needs `settings:manage` (backend `OrgSettingsManage`). */
export function createTeam(body: {
  name: string;
  department_id: string;
  lead_id?: string;
}): Promise<ApiTeam> {
  return apiFetch<ApiTeam>("/v1/teams", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** `PATCH /v1/teams/{id}` — rename / re-assign a team. Needs `settings:manage`. */
export function updateTeam(
  id: string,
  body: { name?: string; department_id?: string; lead_id?: string },
): Promise<ApiTeam> {
  return apiFetch<ApiTeam>(`/v1/teams/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

/** `DELETE /v1/teams/{id}`. Needs `settings:manage`. */
export async function deleteTeam(id: string): Promise<void> {
  await apiFetch(`/v1/teams/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/**
 * Mirrors `workforce::update_employee::dto::UpdateEmployeeRequest` (`PATCH /v1/employees/{id}`).
 * Admin-editable fields only (LLD §17). **Omitted fields are left unchanged; an empty string
 * clears the field** — so callers should send only what actually changed. Role is not here
 * (that's `PUT /v1/users/{id}/role` in `identity`); email/payroll are out of scope.
 */
export interface UpdateEmployeeBody {
  name?: string;
  title?: string;
  department_id?: string;
  team_id?: string;
  location?: string;
  phone?: string;
}

/** Mirrors `workforce::update_employee::dto::UpdatedEmployee` — the lean post-update echo. */
export interface ApiUpdatedEmployee {
  user_id: string;
  name: string;
  department_id?: string;
  team_id?: string;
  title?: string;
}

/** `PATCH /v1/employees/{id}` — edit an employee's admin-managed fields. Needs `employees:manage`. */
export function updateEmployee(
  userId: string,
  body: UpdateEmployeeBody,
): Promise<ApiUpdatedEmployee> {
  return apiFetch<ApiUpdatedEmployee>(`/v1/employees/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
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

/**
 * `DELETE /v1/employees/{id}` — **permanent removal.** Unlike deactivate (reversible, keeps the
 * person as a `deactivated` record), this erases the identity: the login, directory entry and email
 * claim. Their time/attendance/payroll history stays on record (a tombstoned `user_id`).
 *
 * **Deactivate first.** The route only permits deletion of an already-`deactivated` employee —
 * deactivation is the saga that reassigns their work and releases their seat/devices. Calling it on
 * an `active` employee returns `409 must_deactivate_first`; the owner (`cannot_delete_owner`) and
 * yourself (`cannot_delete_self`) are also rejected. The manage-menu UI steers around these before
 * they happen and translates any that slip through.
 */
export async function deleteEmployee(userId: string): Promise<void> {
  await apiFetch(`/v1/employees/${encodeURIComponent(userId)}`, {
    method: "DELETE",
  });
}

// ── Invites (LLD §6) ─────────────────────────────────────────────────────────────────────────

/**
 * The created invite. **`token` and `otp` are returned exactly once** — only their hashes are
 * stored, so they can never be retrieved again. The server emails them (Resend, via the
 * notifications rail), and **the UI deliberately does not display them**: the invitee is the only
 * party who should ever hold the credential. Treat them as secrets if you consume this type.
 */
export interface ApiInviteCreated {
  invite_id: string;
  emp_id: string;
  email: string;
  role_id: string;
  team_id?: string;
  department_id: string;
  title: string;
  /** `pending` on creation. */
  status: string;
  /** Epoch **seconds**. */
  expires_at: number;
  token: string;
  otp: string;
}

/** `POST /v1/employees/invites` — mint an invite. Department and title are REQUIRED org facts the
 *  admin fixes up front (server 400s without them and validates the ids exist); team is optional.
 *  They land on the User at accept, and the admin-set title wins over the invitee's signup input. */
export function createInvite(body: {
  email: string;
  role_id: string;
  department_id: string;
  title: string;
  team_id?: string;
}): Promise<ApiInviteCreated> {
  return apiFetch<ApiInviteCreated>("/v1/employees/invites", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * One employee for `POST /v1/employees` — someone who will **never sign in**
 * (MANAGED-AGENT.md §6.4). Mirrors `workforce::create_monitored_employee::MonitoredEmployeeInput`.
 *
 * Only `name` and `email` are required. `department_id`/`title` are optional here, unlike on an
 * invite: a CSV exported from an HR system has no department ULIDs, and an unfiled employee still
 * lists, still reports, and is still pickable at device assignment.
 */
export interface MonitoredEmployeeInput {
  name: string;
  email: string;
  department_id?: string;
  team_id?: string;
  title?: string;
  role_id?: string;
}

/** One row's outcome. `index` maps back to the submitted array — and so to a CSV line. */
export interface MonitoredRowResult {
  index: number;
  email: string;
  created: boolean;
  user_id?: string;
  emp_id?: string;
  /**
   * `invalid_name` · `invalid_email` · `duplicate_in_request` · `email_in_use` ·
   * `unknown_department` · `unknown_team` · `unknown_role` · `write_failed`.
   */
  error?: string;
}

export interface MonitoredCreateResult {
  created: number;
  failed: number;
  results: MonitoredRowResult[];
}

/**
 * `POST /v1/employees` — create employees with **no login**. Needs `employees:manage`.
 *
 * **Partial success is the normal case, not an exception.** The route answers 200 with per-row
 * results even when rows failed, because discarding 199 good rows over one bad address is not an
 * import. Callers must read `results`, not just the absence of a thrown error.
 *
 * One request carries at most 200 rows (the server's cap); the dialog chunks anything larger.
 */
export function createMonitoredEmployees(
  employees: MonitoredEmployeeInput[],
): Promise<MonitoredCreateResult> {
  return apiFetch<MonitoredCreateResult>("/v1/employees", {
    method: "POST",
    body: JSON.stringify({ employees }),
  });
}

/** Human sentences for the server's row codes. Unknown codes fall through to the raw value rather
 *  than a generic "failed" — an unmapped code is still more use than no code. */
const ROW_ERRORS: Record<string, string> = {
  invalid_name: "Name is blank",
  invalid_email: "Email isn't valid",
  duplicate_in_request: "Listed twice in this file",
  email_in_use: "Already in your directory",
  unknown_department: "That department doesn't exist",
  unknown_team: "That team doesn't exist",
  unknown_role: "That role doesn't exist",
  write_failed: "Couldn't be saved — try again",
};

export function monitoredRowError(code: string | undefined): string {
  if (!code) return "Failed";
  return ROW_ERRORS[code] ?? code;
}

/** One row of `GET /v1/employees/invites`. Carries **no token/OTP** — those are emailed to the
 *  invitee and never readable again (see `ApiInviteCreated`). */
export interface ApiInvite {
  invite_id: string;
  emp_id: string;
  email: string;
  role_id: string;
  department_id: string;
  team_id?: string;
  title: string;
  /** `pending` · `revoked` · `accepted`. */
  status: string;
  /** Epoch **seconds**. Expiry is lazy server-side, so a `pending` row whose `expires_at` is in the
   *  past is expired — compare against now rather than trusting `status` alone. */
  expires_at: number;
  /** Epoch **millis**. */
  created_at: number;
  created_by: string;
}

/** `GET /v1/employees/invites` — every invite the org has minted, newest first.
 *  Requires `employees:read` (same bit as the directory — an invite is a not-yet-employee). */
export function listInvites(): Promise<ApiInvite[]> {
  return apiFetch<ApiInvite[]>("/v1/employees/invites");
}

/** `POST /v1/employees/invites/{id}/revoke` — marks it revoked and frees the email for re-invite. */
export async function revokeInvite(inviteId: string): Promise<void> {
  await apiFetch(`/v1/employees/invites/${encodeURIComponent(inviteId)}/revoke`, {
    method: "POST",
  });
}

/** `POST /v1/employees/invites/{id}/resend` — **rotates** the token + OTP, resets the 7-day expiry,
 *  and re-emits the invite email. The invitee's previous link/OTP stops working, so this replaces
 *  a lost invite rather than nudging the same one. */
export async function resendInvite(inviteId: string): Promise<void> {
  await apiFetch(`/v1/employees/invites/${encodeURIComponent(inviteId)}/resend`, {
    method: "POST",
  });
}
