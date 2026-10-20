/**
 * Which devices run an agent older than the current release (UX audit SET-11).
 *
 * "Behind latest" compared each device with the newest version **in the org's own fleet**, so a
 * fleet that was entirely out of date read "0 behind" — the comparison never saw the release that
 * had actually shipped. The interactive app now compares against the **published release** (the
 * manifest the Download page and the agent's own updater read, `useAgentRelease`).
 *
 * The managed service is a separate release stream whose manifest isn't publicly readable yet, so
 * for it — and for the app while the manifest hasn't answered — the newest version in the fleet is
 * still the reference, and the caller says so.
 *
 * Retired devices (released, revoked, deactivated) never update and are left out of every count.
 */
import type { ApiDevice } from "../services/fleet.service";
import { isLiveDevice } from "./device-state";

/** Numeric dotted-version compare ("0.1.9" < "0.1.30"). Non-numeric parts compare as 0. */
export function cmpVersion(a: string, b: string): number {
  const pa = a.replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/^v/i, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function newest(devices: ApiDevice[]): string | null {
  let max: string | null = null;
  for (const d of devices) {
    if (d.agent_version && (max === null || cmpVersion(d.agent_version, max) > 0)) {
      max = d.agent_version;
    }
  }
  return max;
}

export interface LatestVersions {
  /** What an interactive (desktop app) device is compared against. */
  app: string | null;
  /** `release` when it is the published release; `fleet` when it fell back to the newest in use. */
  appSource: "release" | "fleet";
  /** What a managed-service device is compared against — always the newest in the fleet. */
  service: string | null;
}

export function latestVersions(devices: ApiDevice[], release: string | null): LatestVersions {
  const live = devices.filter((d) => isLiveDevice(d.state));
  const isService = (d: ApiDevice) => d.variant === "service";
  return {
    app: release ?? newest(live.filter((d) => !isService(d))),
    appSource: release ? "release" : "fleet",
    service: newest(live.filter(isService)),
  };
}

/** The version a device should be on, or `null` when there is nothing to compare with. */
export function targetFor(d: ApiDevice, latest: LatestVersions): string | null {
  return d.variant === "service" ? latest.service : latest.app;
}

/** A live device reporting a version older than its target. */
export function isBehind(d: ApiDevice, latest: LatestVersions): boolean {
  if (!isLiveDevice(d.state) || !d.agent_version) return false;
  const target = targetFor(d, latest);
  return target !== null && cmpVersion(d.agent_version, target) < 0;
}
