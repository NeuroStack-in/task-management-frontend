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
 * - `GET /v1/security-events` — the audit trail filtered to the `security` category (LLD §15),
 *   newest-first, perm `security:manage`. Same lean row as `/v1/audit`: there is **no** IP, device,
 *   severity, or success/failure on the server, and no pagination cursor — only `?limit` (1–500).
 */
import { apiFetch } from "@/lib/api";

/** Mirrors `identity::features::list_my_sessions::data::SessionRow`. */
export interface ApiSession {
  session_id: string;
  /** Epoch ms; may be absent for a session that never refreshed. */
  last_seen: number | null;
  /** Friendly device label ("Chrome on Windows") when the client reported one; else absent. */
  user_agent?: string | null;
}

export async function listMySessions(): Promise<ApiSession[]> {
  const data = await apiFetch<ApiSession[] | { sessions: ApiSession[] }>("/v1/me/sessions");
  return Array.isArray(data) ? data : (data?.sessions ?? []);
}

/**
 * `PUT /v1/me/sessions` — record/refresh **this browser's** session, keyed by its stable `device_id`
 * (see `lib/device.ts`). One row per browser: repeated calls (sign-in, app open, token refresh) bump
 * `last_seen` instead of duplicating. Best-effort — a failure must never block the app, so callers
 * swallow it.
 */
export async function heartbeatSession(deviceId: string, label?: string): Promise<void> {
  await apiFetch("/v1/me/sessions", {
    method: "PUT",
    body: JSON.stringify({ device_id: deviceId, label }),
  });
}

/**
 * Mirrors `identity::features::audit_log::data::AuditRow` — the same row `/v1/audit` returns
 * (the security-events route is that read pre-filtered to `category == "security"`).
 */
export interface ApiSecurityEvent {
  /** Epoch **seconds**. */
  ts: number;
  /** Cognito user id (UUID); join to the employee directory for a display name. */
  actor: string;
  /** Always `"security"` on this route. */
  category: string;
  action: string;
  target?: string;
}

/**
 * `GET /v1/security-events?limit` — the tenant's security events, newest-first.
 * Perm `security:manage`. The slice does not paginate by cursor; `limit` is clamped
 * server-side to 1–500.
 */
export function listSecurityEvents(limit = 200): Promise<ApiSecurityEvent[]> {
  const q = new URLSearchParams({ limit: String(limit) });
  return apiFetch<ApiSecurityEvent[]>(`/v1/security-events?${q}`);
}

/** `POST /v1/users/{id}/mfa/reset` — clears the member's TOTP device. */
export async function resetMfaDevice(userId: string): Promise<void> {
  await apiFetch(`/v1/users/${encodeURIComponent(userId)}/mfa/reset`, {
    method: "POST",
  });
}
