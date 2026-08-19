/**
 * Department-specific productivity scoring — the config half of the feature (frontend Phase 4).
 *
 * Two things are configurable, at two scopes:
 *   1. **Score term weights** — how the four productivity terms (Utilisation / Quality / Focus /
 *      Reliability) blend into the 0–100 score. The body is `{ u, q, f, r }` as **fractions summing
 *      to 1.0** (the UI edits whole percentages and converts — see `lib/productivity-weights.ts`).
 *      Org-level defaults live at `/v1/org/productivity-weights`; a department overrides them at
 *      `/v1/org/departments/{id}/productivity-weights`.
 *   2. **Classification rules** — the app/URL rules doc. A department's rules override the org rules
 *      (`/v1/org/rules`) for its members; where a department has no rule, the org rules apply. The
 *      rules calls reuse the org-rules types + envelope and live in `org.service.ts`
 *      (`getDeptRules` / `updateDeptRules`).
 *
 * Reads (GET) are open to members; writes (PUT) need `settings:manage` (server `OrgSettingsManage`).
 * A GET may 404 (or return the inherited defaults) when nothing is set at that scope — callers treat
 * a 404 as "inherits the parent scope".
 */
import { apiFetch } from "@/lib/api";

/**
 * The four score-term weights, as **fractions summing to 1.0**. The keys are terse on purpose —
 * they match the backend DTO exactly: `u`tilisation, `q`uality, `f`ocus, `r`eliability.
 */
export interface ProductivityWeights {
  u: number;
  q: number;
  f: number;
  r: number;
}

/** `GET /v1/org/productivity-weights` — the org's default term weights. May 404 when unset. */
export function getOrgProductivityWeights(): Promise<ProductivityWeights> {
  return apiFetch<ProductivityWeights>("/v1/org/productivity-weights");
}

/**
 * `PUT /v1/org/productivity-weights` — set the org's default term weights (fractions summing to 1).
 * Needs `settings:manage`.
 */
export function updateOrgProductivityWeights(
  body: ProductivityWeights,
): Promise<ProductivityWeights> {
  return apiFetch<ProductivityWeights>("/v1/org/productivity-weights", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/**
 * `GET /v1/org/departments/{id}/productivity-weights` — a department's override weights. May 404
 * when the department has none set (⇒ it inherits the org defaults).
 */
export function getDeptProductivityWeights(
  deptId: string,
): Promise<ProductivityWeights> {
  return apiFetch<ProductivityWeights>(
    `/v1/org/departments/${encodeURIComponent(deptId)}/productivity-weights`,
  );
}

/**
 * `PUT /v1/org/departments/{id}/productivity-weights` — override a department's term weights
 * (fractions summing to 1). Needs `settings:manage`.
 */
export function updateDeptProductivityWeights(
  deptId: string,
  body: ProductivityWeights,
): Promise<ProductivityWeights> {
  return apiFetch<ProductivityWeights>(
    `/v1/org/departments/${encodeURIComponent(deptId)}/productivity-weights`,
    {
      method: "PUT",
      body: JSON.stringify(body),
    },
  );
}
