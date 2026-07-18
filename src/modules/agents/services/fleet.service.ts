/**
 * Device agents — the real backend (`fleet` context, LLD §18).
 *
 * Two read routes exist and are deployed; both carry `AgentsManage` (they read *other people's*
 * devices). Connectivity is derived server-side at read time from the last heartbeat — never
 * stored — so there is no "mark offline" write to make.
 *
 * - `GET /v1/fleet` — the org's devices + counts.
 * - `GET /v1/fleet/{agent_id}` — one device. 404 until that device has heartbeated once.
 *
 * What the server does **not** serve, and why the UI has no button for it:
 * - No restart / update / remove. `fleet::update_policy` and `deactivate_user_devices` are the two
 *   §18 slices still unbuilt, and there is no agent command channel at all (the WebSocket control
 *   rail was cut — config reaches the agent by polling `GET /v1/agent/config`).
 * - No enrollment token. Enrollment is deferred; the agent authenticates as the *user* via their
 *   Cognito login, so a device needs no separate credential to pair.
 * - No "latest version" to compare against, so there is no outdated badge.
 * - Fleet-wide capture policy is not here — it's the tracking rules editor (`GET/PUT /v1/org/rules`,
 *   already wired at /settings/tracking-rules).
 */
import { apiFetch } from "@/lib/api";

/** Mirrors `fleet::shared::device::DeviceView`. */
export interface ApiDevice {
  /** The device label the agent chose (`DEVICE#<agent_id>`), not an auth identity. */
  agent_id: string;
  /** The user whose Cognito login the agent runs under. */
  user_id: string;
  hostname: string;
  os: string;
  os_version: string;
  agent_version: string;
  ip: string;
  /** Epoch ms of the last heartbeat. */
  last_heartbeat: number;
  /** Derived server-side against a 10-minute window (2× the agent's ~5-min cycle). */
  connectivity: "online" | "idle" | "offline";
  /** Stored lifecycle; defaults to `active` until device deactivation ships. */
  state: string;
  cpu_pct: number;
  mem_pct: number;
  outbox_mb: number;
  idle: boolean;
}

/** Mirrors `fleet::features::fleet_list::dto::FleetResponse`. */
export interface ApiFleet {
  total: number;
  /** Heard from inside the online window — this counts idle devices too. */
  online: number;
  offline: number;
  devices: ApiDevice[];
}

const EMPTY: ApiFleet = { total: 0, online: 0, offline: 0, devices: [] };

export async function getFleet(): Promise<ApiFleet> {
  const data = await apiFetch<ApiFleet>("/v1/fleet");
  return data ?? EMPTY;
}

export async function getDevice(agentId: string): Promise<ApiDevice> {
  return apiFetch<ApiDevice>(`/v1/fleet/${encodeURIComponent(agentId)}`);
}
