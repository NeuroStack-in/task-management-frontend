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
