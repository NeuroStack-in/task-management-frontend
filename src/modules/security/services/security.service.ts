/**
 * Security — the real backend (`identity` context, LLD §15/§2).
 *
 * Two real capabilities live here; the rest of the Security page is platform-fixed (Cognito) or
 * deferred (§15 IP allowlist / per-session revoke), and stays honestly read-only.
 *
 * - `GET /v1/me/sessions` — your signed-in sessions. Lean by necessity: `{session_id, last_seen}`
 *   only. Cognito exposes no device / IP / location without its paid advanced-security tier, so those
 *   columns are honestly absent rather than invented. There is **no per-session revoke** endpoint
 *   (that's the blocked §15 work), so the list is read-only.
 * - `POST /v1/users/{id}/mfa/reset` — the lost-phone flow: an admin clears a member's authenticator
 *   so they re-enrol at next sign-in (perm `security:manage`). The one real MFA action (LLD §2).
 */
import { apiFetch } from "@/lib/api";

/** Mirrors `identity::features::list_my_sessions::data::SessionRow`. */
export interface ApiSession {
  session_id: string;
  /** Epoch ms; may be absent for a session that never refreshed. */
  last_seen: number | null;
}

export async function listMySessions(): Promise<ApiSession[]> {
  const data = await apiFetch<ApiSession[] | { sessions: ApiSession[] }>("/v1/me/sessions");
  return Array.isArray(data) ? data : (data?.sessions ?? []);
}

/** `POST /v1/users/{id}/mfa/reset` — clears the member's TOTP device. */
export async function resetMfaDevice(userId: string): Promise<void> {
  await apiFetch(`/v1/users/${encodeURIComponent(userId)}/mfa/reset`, {
    method: "POST",
  });
}
