"use client";

/**
 * The reads behind "why is this day empty" (UX audit 2026-10-16, MON-10) — see `lib/capture-status`.
 *
 * Only existing GET routes, through their module services, and only once a surface is actually
 * empty (`enabled`): a day full of captures never pays for them.
 *  - the screenshot switch — the entitlements store the shell already loaded (no request);
 *  - the capture interval and policy — `GET /v1/agent/config` (any signed-in user);
 *  - the fleet — `GET /v1/fleet`, only for a reader holding `agents:view`; anyone else gets `null`
 *    and the generic wording rather than a refusal.
 *
 * Read once per mount and shared between the surfaces on a page; a failed read degrades to `null`
 * (that part of the explanation is skipped), never to a wrong claim.
 */
import { useEffect, useState } from "react";
import { usePermissions } from "@/hooks/use-permissions";
import { useTrackingMode } from "@/hooks/use-features";
import { effectiveFromState, useEntitlementsStore } from "@/stores/entitlements.store";
import { getTrackingPolicy, listFleet, type AgentConfig } from "@/modules/agents/services/fleet.service";
import type { CaptureContext, CaptureDevice } from "./lib/capture-status";

const SCREENSHOTS = "monitoring.screenshots";

export interface CaptureContextState extends CaptureContext {
  /** Every read it needs has answered (either way) — until then, don't show a cause. */
  ready: boolean;
}

export function useCaptureContext(enabled: boolean): CaptureContextState {
  const { can } = usePermissions();
  const canFleet = can("agents:view");
  const trackingMode = useTrackingMode();
  const loaded = useEntitlementsStore((s) => s.loaded);
  const screenshotsInPlan = useEntitlementsStore((s) => s.allowed.includes(SCREENSHOTS));
  // The org's own switch — `useIsFeatureOn` exempts the owner, who would never be told it was off.
  const screenshotsOn = useEntitlementsStore((s) => effectiveFromState(s, SCREENSHOTS));

  const [config, setConfig] = useState<AgentConfig | "failed" | null>(null);
  const [fleet, setFleet] = useState<CaptureDevice[] | "failed" | null>(null);

  useEffect(() => {
    if (!enabled || config) return;
    let live = true;
    getTrackingPolicy()
      .then((c) => live && setConfig(c))
      // The interval and policy parts are skipped.
      .catch(() => live && setConfig("failed"));
    return () => {
      live = false;
    };
  }, [enabled, config]);

  useEffect(() => {
    if (!enabled || !canFleet || fleet) return;
    let live = true;
    listFleet()
      .then((f) => live && setFleet(f.devices))
      // The agent part falls back to the generic wording.
      .catch(() => live && setFleet("failed"));
    return () => {
      live = false;
    };
  }, [enabled, canFleet, fleet]);

  const cfg = config && config !== "failed" ? config : null;
  return {
    screenshotsInPlan: loaded ? screenshotsInPlan : null,
    screenshotsOn: loaded ? screenshotsOn : null,
    cadenceOff: cfg ? cfg.tracking.cadence === "off" : null,
    gateOff: cfg?.capture_gate ? cfg.capture_gate.capture_policy_active === false : null,
    devices: canFleet && Array.isArray(fleet) ? fleet : null,
    trackingMode,
    ready: config !== null && (!canFleet || fleet !== null),
  };
}
