/**
 * Global search — the real backend (`identity` context, `GET /v1/search?q=`, LLD §19).
 *
 * Prefix / starts-with only (no fuzzy — the honest trade for zero new infra), and **perm-scoped
 * server-side**: employees are returned only to callers with `EmployeesRead`. The server's shape
 * wins — a hit is `{ id, label }` and nothing more (no title/department/avatar), so callers render
 * from those two fields alone.
 *
 * `projects` — projects whose **name contains** the query (case-insensitive, starts-with ranked
 * first, max 10), scoped server-side: org scope + projects:read sees every project, anyone else only
 * the projects they are a member of. Added to `search/data.rs` 2026-10-20 (UX audit SHELL-11); a
 * server that predates it returns `[]`, which simply renders no Projects group. `tasks` stays empty.
 */
import { apiFetch } from "@/lib/api";

/** Mirrors `identity::features::search::data::Hit`. */
export interface SearchHit {
  id: string;
  label: string;
}

/** Mirrors `identity::features::search::data::SearchResults`. */
export interface SearchResults {
  employees: SearchHit[];
  projects: SearchHit[];
  tasks: SearchHit[];
}

const EMPTY: SearchResults = { employees: [], projects: [], tasks: [] };

/**
 * Run a prefix search. Empty/blank queries never hit the network (the server would return nothing
 * anyway). Returns empty buckets on any error so the caller degrades to page-nav results rather than
 * surfacing a transient failure in a type-ahead.
 */
export async function searchAll(query: string): Promise<SearchResults> {
  const q = query.trim();
  if (!q) return EMPTY;
  return apiFetch<SearchResults>(`/v1/search?q=${encodeURIComponent(q)}`).catch(() => EMPTY);
}
