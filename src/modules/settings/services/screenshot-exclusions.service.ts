/**
 * Per-person screenshot exclusions — `GET`/`PUT /v1/insights/screenshot-opt-outs` (needs
 * `monitoring:manage`). An excluded person's screenshots are never shown in the review grid, sent for
 * AI analysis or summarised (the privacy gate enforces it server-side). Added with the owner's
 * decision of 2026-10-09 (QA audit WP-146).
 */
import { ApiError, apiFetch } from "@/lib/api";

/** The excluded user ids, or `null` when the server predates the route (404). */
export async function getScreenshotExclusions(): Promise<string[] | null> {
  try {
    const res = await apiFetch<{ user_ids: string[] }>("/v1/insights/screenshot-opt-outs");
    return res.user_ids;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

/** Replace the whole list. A concurrent save by someone else answers 409 `opt_outs_changed`. */
export async function setScreenshotExclusions(userIds: string[]): Promise<string[]> {
  const res = await apiFetch<{ user_ids: string[] }>("/v1/insights/screenshot-opt-outs", {
    method: "PUT",
    body: JSON.stringify({ user_ids: userIds }),
  });
  return res.user_ids;
}
