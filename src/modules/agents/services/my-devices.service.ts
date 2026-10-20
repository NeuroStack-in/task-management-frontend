/**
 * The caller's **own** devices — `GET /v1/me/devices` (`fleet` context). Any signed-in member; the
 * server returns only devices whose agent runs under, or is assigned 1:1 to, the caller, newest
 * heartbeat first. No permission bit: unlike `GET /v1/fleet` (`AgentsManage`, everyone's devices),
 * this is self-scoped — it is what lets an Employee see "is my device connected?" (UX audit
 * 2026-10-16, EMP-09).
 *
 * **Added 2026-10-20 and not on every server yet.** A server that predates it answers 404; that is
 * returned as `null` — "unknown" — so callers hide device status instead of claiming "not installed"
 * or showing an error. Any other failure still throws.
 */
import { apiFetch, ApiError } from "@/lib/api";

/** One device, as the route returns it (a subset of `fleet::shared::device::DeviceView`). */
export interface MyDevice {
  agent_id: string;
  hostname: string;
  os: string;
  agent_version: string;
  /** Epoch ms of the last heartbeat; `0` = never heard from. */
  last_heartbeat: number;
  /** `online` | `idle` | `offline` — derived server-side at read time. */
  connectivity: string;
  /** Lifecycle: `active` | `deactivated` | `released` | `revoked`. Absent/empty ⇒ active. */
  state?: string;
  /** The login-less managed service (`managed`; the fleet view calls it `service`). Absent ⇒ the
   *  interactive desktop app. */
  variant?: string;
}

interface MyDevicesResponse {
  devices: MyDevice[];
}

/** The caller's devices, or `null` when this server has no such route yet (404). */
export async function getMyDevices(): Promise<MyDevice[] | null> {
  try {
    const res = await apiFetch<MyDevicesResponse>("/v1/me/devices");
    return Array.isArray(res?.devices) ? res.devices : [];
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}
