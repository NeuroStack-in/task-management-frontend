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

/** `department_id → name`, for turning the directory's ids into labels. Best-effort.
 *  `/v1/departments` answers with a bare array in `data` (not `{departments}`). */
export async function departmentMap(): Promise<Map<string, string>> {
  const depts = await apiFetch<ApiDepartment[]>("/v1/departments");
  return new Map(depts.map((d) => [d.id, d.name]));
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
