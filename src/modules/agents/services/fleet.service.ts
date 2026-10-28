/**
 * Device fleet — the real backend (`fleet` context, LLD §18). `GET /v1/fleet` lists the org's agent
 * devices with **read-time connectivity** (online/idle/offline — from a live MQTT presence signal
 * when the device is enrolled on the push rail, else derived from the last heartbeat) and
 * latest telemetry. The devices are the `AgentDevice` items the `ingest-processor` writes from each
 * agent's heartbeat — so the list is empty until agents are actually enrolled and reporting.
 */
import { apiFetch } from "@/lib/api";

/** Mirrors `fleet::shared::device::DeviceView`. */
export interface ApiDevice {
  agent_id: string;
  user_id: string;
  hostname: string;
  os: string;
  os_version: string;
  agent_version: string;
  ip: string;
  /** Epoch ms of the last heartbeat. */
  last_heartbeat: number;
  /**
   * Epoch ms of the last sign of life of any kind — the newer of the last heartbeat and the last
   * live-connection event. Absent on servers from before 2026-10-28; read it through
   * `lib/device-activity.ts` (`lastSeenAt`), which falls back to `last_heartbeat`.
   */
  last_seen?: number;
  /** `online` | `idle` | `offline`. */
  connectivity: string;
  /**
   * True when `connectivity` came from a live MQTT presence signal (the broker observed the socket)
   * rather than the 10-minute heartbeat window. Absent on responses from before the push rail.
   */
  presence_live?: boolean;
  /** `active` | `deactivated` | `released` | `revoked`. */
  state: string;
  cpu_pct: number;
  mem_pct: number;
  outbox_mb: number;
  idle: boolean;
  // ── Managed-agent discriminators (MANAGED-AGENT.md §8 Ph1) — all optional, absent on interactive
  //    devices and on any row that predates the managed agent. Every consumer guards its lookup. ──
  /** `interactive` | `service`. Absent ⇒ interactive (the default and every pre-Ph1 row). */
  variant?: string;
  /** The 1:1-assigned employee (managed only) — attribution independent of who is signed in. Always
   *  populated for a managed device, so "Attributed to" never renders an unmapped state (§8 Ph3). */
  assigned_user_id?: string;
  /** `signed_in` | `asleep` | `signed_out` — the managed logon state driving live presence. */
  logon_state?: string;
  /** Epoch ms the device enrolled (managed only). */
  enrolled_at?: number;
}

export interface ApiFleet {
  total: number;
  online: number;
  offline: number;
  devices: ApiDevice[];
}

export function listFleet(): Promise<ApiFleet> {
  return apiFetch<ApiFleet>("/v1/fleet");
}

export function getDevice(agentId: string): Promise<ApiDevice> {
  return apiFetch<ApiDevice>(`/v1/fleet/${encodeURIComponent(agentId)}`);
}

// ── Tracking policy (agent config, LLD §18) ──────────────────────────────────────────────────────
// The org-wide capture policy every agent pulls on its next config check. `GET /v1/agent/config`
// returns the whole `AgentConfig` (an optimistic-concurrency `version` + the `tracking` block + the
// app/site classification `rules`); the write path (`PUT /v1/fleet/update-policy`) only touches the
// `tracking` block and returns the new `TrackingConfig`. Capture cadence:
//   off → never · min3 / min5 / min10 → a screenshot every 3 / 5 / 10 minutes while active ·
//   { custom: n } → every n minutes (server-validated 1..=60). Mirrors the Rust `Cadence` enum: the
//   presets are strings, a custom interval is `{"custom": n}`.

export type TrackingCadence =
  | "off"
  | "min3"
  | "min5"
  | "min10"
  | { custom: number };

/**
 * The `tracking` block of the agent config (`fleet::dto::TrackingConfig`). Its own `version` is the
 * optimistic-concurrency token: send it back as `expected_version` on the next write, and a 409
 * (`version_conflict`) means someone else changed the policy since you loaded it.
 */
export interface TrackingPolicy {
  version: number;
  cadence: TrackingCadence;
  /** Screenshot blur strength, 0 (none) … 3 (heaviest). */
  blur_level: number;
  /** Days to retain captures before deletion, 1 … 365. */
  retention_days: number;
  /** Suppress the tray indicator / capture notice on employee devices. */
  silent: boolean;
  /** Let agents self-update to the latest released version. */
  auto_update: boolean;
  /**
   * **Managed agent only** — seconds without keyboard or mouse input before the logon session
   * auto-ends, backdated to the last input. 60 … 28800 (1 minute … 8 hours).
   *
   * The interactive app ignores it: an employee starts and stops that timer themselves. Optional on
   * the type because a server from before the field simply omits it.
   */
  idle_end_secs?: number;
  /** Desktop app: daily privacy-pause allowance in seconds (0 = off; absent = 15 min). */
  pause_allowance_secs?: number;
}

/**
 * The org's **legal capture gate** (`wp_agent_contract::CaptureGateConfig`, MANAGED-AGENT.md §9.2) —
 * what the managed agent enforces before any capture. Read-only here: it arrives inside
 * `GET /v1/agent/config`, and no screen edits it. An org that never stored a gate is served
 * `capture_policy_active: true` with no window (`fleet::serve_config`), at `version` 0.
 */
export interface CaptureWindow {
  /** Permitted weekdays, ISO Mon=1 … Sun=7. Empty ⇒ every day. */
  weekdays: number[];
  /** Start minute-of-day, device-local, 0 … 1439. */
  start_minute: number;
  /** End minute-of-day, device-local, 0 … 1439. `end < start` ⇒ spans midnight. */
  end_minute: number;
}

export interface CaptureGate {
  version: number;
  /** Org-level authorisation to capture at all — on unless the org stored a gate turning it off. */
  capture_policy_active: boolean;
  /** The permitted hours (device-local). `null` ⇒ no time restriction. */
  capture_window: CaptureWindow | null;
}

/** The full agent config document (`fleet::dto::AgentConfig`). */
export interface AgentConfig {
  version: number;
  tracking: TrackingPolicy;
  /** App/site classification rules — opaque to this screen. */
  rules: unknown;
  /** The legal capture gate (§9.2). */
  capture_gate: CaptureGate;
}

/** The exact write payload for `PUT /v1/fleet/update-policy`. */
export interface UpdateTrackingPolicyInput {
  /**
   * Managed agent: seconds of no input before the logon session auto-ends (60 … 28800). Optional so
   * a caller that doesn't manage it leaves the stored value alone — the server defaults it.
   */
  idle_end_secs?: number;
  /** Desktop app: daily privacy-pause allowance in seconds (0 = off; absent = 15 min). */
  pause_allowance_secs?: number;
  cadence: TrackingCadence;
  blur_level: number;
  retention_days: number;
  silent: boolean;
  auto_update: boolean;
  /** The `tracking.version` last loaded — the server rejects the write (409) if it moved on. */
  expected_version: number;
}

/** Result of `POST /v1/fleet/{id}/capture-now`. */
export interface CaptureRequested {
  agent_id: string;
  screenshot_id: string;
  /** Always `requested` — the device's accept/refuse answer arrives later on the push rail. */
  status: string;
  requested_at: number;
}

/**
 * `POST /v1/fleet/{id}/capture-now` — ask a device for a screenshot now (needs
 * `monitoring:manage` + `screenshots:view`, and the org's screenshot entitlement).
 *
 * **202-shaped, not a result.** The device holds the final veto: it refuses during a privacy pause
 * and when no timer is running, and that answer comes back as a `capture_result` push — so callers
 * must show "requested", never "captured", off this response alone.
 */
export function captureNow(agentId: string): Promise<CaptureRequested> {
  return apiFetch<CaptureRequested>(
    `/v1/fleet/${encodeURIComponent(agentId)}/capture-now`,
    { method: "POST" },
  );
}

/** Load the org's current agent config, including the tracking policy the monitoring screen edits. */
export function getTrackingPolicy(): Promise<AgentConfig> {
  return apiFetch<AgentConfig>("/v1/agent/config");
}

// ── Managed-agent enrolment (MANAGED-AGENT.md §6.2, Ph3-4) ────────────────────────────────────────
// The 1:1 device binding: a technician mints a single-use code for a named employee, installs the
// MSI with it, and the device is bound to that person. All `agents:manage`.

/** Mirrors `fleet::mint_enrollment_code::MintedCode`. `code` is shown **once** and never again. */
export interface MintedCode {
  code_id: string;
  /** `<tenant>.<code_id>.<secret>` — the value pasted into `msiexec … ENROLLTOKEN=<code>`. */
  code: string;
  user_id: string;
  /** Epoch **seconds** (the code's TTL). */
  expires_at: number;
}

/** Mirrors `fleet::enrollment_codes::PendingCode` — the technician's worklist. No secret, no hash. */
export interface PendingCode {
  code_id: string;
  user_id: string;
  assign_upn?: string;
  created_by: string;
  created_at: number;
  expires_at: number;
}

/**
 * `POST /v1/fleet/enrollment-codes` — mint a code for one employee. Rejects with a typed 409 the UI
 * must handle inline, not as a toast:
 *   - `tracking_mode_not_managed` → the org isn't in machine/both mode (switch it in Settings);
 *   - `employee_already_has_device` → that employee already has a live agent (release it first).
 */
export function mintEnrollmentCode(body: {
  user_id: string;
  assign_upn?: string;
}): Promise<MintedCode> {
  return apiFetch<MintedCode>("/v1/fleet/enrollment-codes", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** `GET /v1/fleet/enrollment-codes` — pending (unused, unexpired) codes, newest first. */
export function listEnrollmentCodes(): Promise<PendingCode[]> {
  return apiFetch<PendingCode[]>("/v1/fleet/enrollment-codes");
}

/** `DELETE /v1/fleet/enrollment-codes/{id}` — revoke a code that was minted by mistake. */
export async function revokeEnrollmentCode(codeId: string): Promise<void> {
  await apiFetch(`/v1/fleet/enrollment-codes/${encodeURIComponent(codeId)}`, {
    method: "DELETE",
  });
}

/**
 * Mirrors `fleet::uninstall_passcode::UninstallPasscode`. The mirror image of `MintedCode`: one
 * value per **org**, readable as often as needed, because removing an agent happens long after it
 * was installed and usually by someone who wasn't there for the install.
 */
export interface UninstallPasscode {
  /** Typed into `msiexec /x … UNINSTALLPASSCODE=<this>`. */
  passcode: string;
  /** Epoch **ms** of the last rotation, or of creation for one never rotated. */
  rotated_at: number;
  /** Who last rotated it — empty for the passcode created on first read. */
  rotated_by: string;
}

/** `GET /v1/fleet/uninstall-passcode` — the org's passcode, minted server-side on first read. */
export function getUninstallPasscode(): Promise<UninstallPasscode> {
  return apiFetch<UninstallPasscode>("/v1/fleet/uninstall-passcode");
}

/**
 * `POST /v1/fleet/uninstall-passcode/rotate` — replace it. **Devices already installed keep the
 * passcode they were installed with**, so rotating protects future installs only; the UI says so
 * rather than leaving IT to discover it at a desk.
 */
export function rotateUninstallPasscode(): Promise<UninstallPasscode> {
  return apiFetch<UninstallPasscode>("/v1/fleet/uninstall-passcode/rotate", {
    method: "POST",
  });
}

/**
 * `POST /v1/fleet/{id}/release` — free the employee's 1:1 claim, revoke the credential, clear the
 * assignment. The agent stops on its next batch; the employee can then be assigned a replacement.
 * History stays on the employee's record. (The server's `/revoke` — lost/stolen, claim kept — has
 * no screen, so it has no client function either.)
 */
export async function releaseDevice(deviceId: string): Promise<void> {
  await apiFetch(`/v1/fleet/${encodeURIComponent(deviceId)}/release`, {
    method: "POST",
  });
}

/**
 * `POST /v1/fleet/{id}/archive` — tidy a retired (released / revoked / deactivated) device out of the
 * list (UX audit SET-12). Refused (`409 device_active`) for a live device — release it first. The row
 * is kept; `GET /v1/fleet?include_archived=true` still returns it.
 */
export async function archiveDevice(deviceId: string): Promise<void> {
  await apiFetch(`/v1/fleet/${encodeURIComponent(deviceId)}/archive`, {
    method: "POST",
  });
}

/** Persist a new tracking policy. Returns the new `TrackingConfig` (with a bumped `version`). */
export function updateTrackingPolicy(
  body: UpdateTrackingPolicyInput,
): Promise<TrackingPolicy> {
  return apiFetch<TrackingPolicy>("/v1/fleet/update-policy", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}
