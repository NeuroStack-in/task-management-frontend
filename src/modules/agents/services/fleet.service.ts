/**
 * Device fleet — the real backend (`fleet` context, LLD §18). `GET /v1/fleet` lists the org's agent
 * devices with **read-time connectivity** (online/idle/offline, derived from the last heartbeat) and
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
  /** `online` | `idle` | `offline`. */
  connectivity: string;
  /** `active` | `deactivated`. */
  state: string;
  cpu_pct: number;
  mem_pct: number;
  outbox_mb: number;
  idle: boolean;
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
}

/** The full agent config document (`fleet::dto::AgentConfig`). */
export interface AgentConfig {
  version: number;
  tracking: TrackingPolicy;
  /** App/site classification rules — opaque to this screen. */
  rules: unknown;
}

/** The exact write payload for `PUT /v1/fleet/update-policy`. */
export interface UpdateTrackingPolicyInput {
  cadence: TrackingCadence;
  blur_level: number;
  retention_days: number;
  silent: boolean;
  auto_update: boolean;
  /** The `tracking.version` last loaded — the server rejects the write (409) if it moved on. */
  expected_version: number;
}

/** Load the org's current agent config, including the tracking policy this screen edits. */
export function getTrackingPolicy(): Promise<AgentConfig> {
  return apiFetch<AgentConfig>("/v1/agent/config");
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
