/**
 * Global search — the real backend (`identity` context, `GET /v1/search?q=`, LLD §19).
 *
 * Prefix / starts-with only (no fuzzy — the honest trade for zero new infra), and **perm-scoped
 * server-side**: employees are returned only to callers with `EmployeesRead`. The server's shape
 * wins — a hit is `{ id, label }` and nothing more (no title/department/avatar), so callers render
 * from those two fields alone.
 *
 * `projects` and `tasks` are declared by the contract but the backend returns them **empty for now**
 * (`search/data.rs` hardcodes `vec![]`, pending the projects crate's GSI1 search). We wire them
 * anyway so the surface lights up automatically the day the backend fills them — no frontend change.
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
