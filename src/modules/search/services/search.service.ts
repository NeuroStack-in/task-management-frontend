/**
 * Global search — the real backend (`identity` context, LLD §19).
 *
 * `GET /v1/search?q=` — the ⌘K / sidebar palette's server-side lookup. Three things about it shape
 * every caller:
 *
 * - **Prefix only.** The server does a starts-with query over the Directory GSI (`USER#<normalized
 *   name prefix>`). There is no fuzzy/substring matching and no email/job-title matching — "smith"
 *   will not find "John Smith". Callers must not promise more than that.
 * - **Permission-filtered per result.** Employee hits are returned only to a caller holding
 *   `employees:read`; the server is the gate, so the client never needs to pre-filter (and must not
 *   assume a non-empty response).
 * - **Employees only, today.** `projects` and `tasks` are declared in the response shape but the
 *   handler always returns them empty — they ride Dev A's `projects` crate GSI1, which has not
 *   landed. Do not render UI implying projects/tasks are searchable until those buckets fill.
 *
 * A hit is deliberately lean — `{id, label}` and nothing else. The directory item's job title,
 * department, email and avatar are **not** projected onto the index, so they are honestly absent
 * rather than invented.
 */
import { apiFetch } from "@/lib/api";

/** Mirrors `identity::features::search::data::Hit`. */
export interface ApiSearchHit {
  id: string;
  label: string;
}

/** Mirrors `identity::features::search::data::SearchResults`. */
export interface ApiSearchResults {
  employees: ApiSearchHit[];
  /** Always `[]` until Dev A's GSI1 lands (server-side comment says so explicitly). */
  projects: ApiSearchHit[];
  /** Always `[]` until Dev A's GSI1 lands. */
  tasks: ApiSearchHit[];
}

/**
 * Run a prefix search. `signal` lets a caller abort a request superseded by newer keystrokes.
 * Throws `ApiError` on 401/5xx.
 */
export async function search(
  q: string,
  signal?: AbortSignal,
): Promise<ApiSearchResults> {
  const res = await apiFetch<ApiSearchResults>(
    `/v1/search?q=${encodeURIComponent(q)}`,
    { signal },
  );
  return {
    employees: res?.employees ?? [],
    projects: res?.projects ?? [],
    tasks: res?.tasks ?? [],
  };
}
