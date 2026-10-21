/**
 * Why a day has no captures — said from what the app can actually see (UX audit 2026-10-16, MON-10).
 *
 * Every empty capture surface read "Nothing was reported for the selected day", whether no agent was
 * installed, the agents were offline, or screenshots were switched off — and none linked anywhere.
 * These rules pick the first cause the existing reads can establish, in the order a fix would be
 * tried, and name the page that fixes it:
 *
 *  1. **Screenshots switched off** for the organization (Settings → Features) — agents capture nothing.
 *  2. **Capture interval set to Off** (Settings → Monitoring, `tracking.cadence`).
 *  3. **Capture policy off**, for an organization whose devices are all managed (the gate only binds
 *     the login-less service; the interactive app ignores it).
 *  4. **No agent enrolled** — for the organization, or for the one person in view.
 *  5. **Agents silent** — the latest heartbeat, and how long ago.
 *  6. Agents present and reporting, nothing captured — they capture only while a timer runs (or,
 *     on a managed device, while someone is signed in).
 *
 * What it cannot tell, and so never claims: an employee's own consent on their device. The server
 * records no such state — the device simply sends nothing — so a silent agent is reported as silent.
 * A reader who can't read the fleet (`agents:view`) gets the generic line, not a guess.
 *
 * Pure, so the rules are pinned by a test.
 */
import type { TrackingMode } from "@/lib/tracking-mode";

/** The fleet fields read here — a subset of `ApiDevice`, every one guarded. */
export interface CaptureDevice {
  agent_id: string;
  user_id?: string;
  assigned_user_id?: string;
  hostname?: string;
  last_heartbeat: number;
  connectivity?: string;
  state?: string;
}

export interface CaptureContext {
  /** Screenshots are in the organization's plan, or `null` when unknown. */
  screenshotsInPlan: boolean | null;
  /** Settings → Features → Screenshots (the org's own switch — no owner exemption), or `null`. */
  screenshotsOn: boolean | null;
  /** `tracking.cadence === "off"`, or `null` when the policy couldn't be read. */
  cadenceOff: boolean | null;
  /** `capture_gate.capture_policy_active === false`, or `null` when unknown. */
  gateOff: boolean | null;
  /** The fleet, or `null` when the reader can't see it (no `agents:view`) or it failed to load. */
  devices: CaptureDevice[] | null;
  trackingMode: TrackingMode;
}

export interface CaptureLink {
  href: string;
  label: string;
}

export interface CaptureGap {
  title: string;
  description: string;
  /** Where to fix it — the caller drops any the reader's role can't open. */
  links: CaptureLink[];
}

export const LINK = {
  billing: { href: "/settings/billing", label: "Settings → Billing" },
  features: { href: "/settings/features", label: "Settings → Features" },
  monitoring: { href: "/settings/monitoring", label: "Settings → Monitoring" },
  agents: { href: "/settings/agents", label: "Device agents" },
  download: { href: "/download", label: "Download the agent" },
} as const satisfies Record<string, CaptureLink>;

/** When agents capture at all, in the organization's tracking mode. */
export function whenAgentsCapture(mode: TrackingMode): string {
  if (mode === "machine") return "Managed devices take screenshots only while someone is signed in to them.";
  if (mode === "both") {
    return "Agents take screenshots only while an employee's timer is running, or while someone is signed in to a managed device.";
  }
  return "The agent takes screenshots only while an employee's timer is running.";
}

/** A device that is meant to be reporting — retired ones (deactivated / released / revoked) are quiet by design. */
function isLive(d: CaptureDevice): boolean {
  return !d.state || d.state === "active";
}

function isOnline(d: CaptureDevice): boolean {
  return d.connectivity === "online" || d.connectivity === "idle";
}

function belongsTo(d: CaptureDevice, userId: string): boolean {
  return d.assigned_user_id === userId || (!d.assigned_user_id && d.user_id === userId);
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export interface ExplainArgs {
  ctx: CaptureContext;
  /** The day in view, `YYYY-MM-DD`. */
  date: string;
  today: string;
  /** Local midnight at the start of `date`, epoch ms — for "had it reported by then". */
  dayStartMs: number;
  /** Narrow to one person's devices. */
  userId?: string;
  /** Their display name, for the copy. */
  name?: string;
  /** `formatDateTime`-style label for an epoch ms — injected so the rules stay locale-free in tests. */
  when: (ms: number) => string;
  /** "3d ago"-style label — injected for the same reason. */
  ago: (ms: number) => string;
}

/**
 * The first cause the context can establish for an empty capture day, with where to fix it — or the
 * generic line when it can establish none.
 */
export function explainEmptyCaptureDay({
  ctx,
  date,
  today,
  dayStartMs,
  userId,
  name,
  when,
  ago,
}: ExplainArgs): CaptureGap {
  const who = name || "this employee";
  if (ctx.screenshotsInPlan === false) {
    return {
      title: "Screenshots aren't in your plan",
      description:
        "Your organization's plan doesn't include screenshots, so the agents capture none. A plan that includes them starts capture.",
      links: [LINK.billing],
    };
  }
  if (ctx.screenshotsOn === false) {
    return {
      title: "Screenshots are switched off",
      description:
        "Your organization has turned Screenshots off in Settings → Features, so the agents capture none. Turning it back on starts capture again; days while it was off stay empty.",
      links: [LINK.features],
    };
  }
  if (ctx.cadenceOff === true) {
    return {
      title: "Screenshot capture is set to Off",
      description:
        "The capture interval in Settings → Monitoring is Off, so the agents take no screenshots. Pick an interval there to start capturing.",
      links: [LINK.monitoring],
    };
  }
  if (ctx.gateOff === true && ctx.trackingMode === "machine") {
    return {
      title: "The capture policy is off",
      description:
        "Your organization's capture policy is switched off in Settings → Monitoring, and managed devices take no screenshots while it is.",
      links: [LINK.monitoring],
    };
  }

  const timing = whenAgentsCapture(ctx.trackingMode);

  if (ctx.devices === null) {
    return {
      title: userId ? "No captures on this day" : "No screenshots for this day",
      description: `Nothing was captured${userId ? ` for ${who}` : ""} on this day. ${timing} Someone who can open Device agents can check whether the agents are installed and reporting.`,
      links: [],
    };
  }

  const live = ctx.devices.filter(isLive).filter((d) => !userId || belongsTo(d, userId));

  if (live.length === 0) {
    return userId
      ? {
          title: `No agent enrolled for ${who}`,
          description: `${who} has no active desktop agent, so nothing is captured for them. Install the agent on their computer and sign it in (or enroll their managed device) to start.`,
          links: [LINK.agents, LINK.download],
        }
      : {
          title: "No desktop agents enrolled yet",
          description:
            "Nothing is captured until someone installs the desktop agent and signs in. Once an agent reports, its screenshots appear here.",
          links: [LINK.download, LINK.agents],
        };
  }

  const latest = Math.max(...live.map((d) => d.last_heartbeat || 0));
  const online = live.filter(isOnline).length;
  const lastSeen = latest > 0 ? `${when(latest)} (${ago(latest)})` : "never";
  const subject = userId
    ? live.length === 1
      ? `${who}'s agent`
      : `${who}'s agents`
    : live.length === 1
      ? "The organization's one agent"
      : `All ${live.length} agents`;

  if (online === 0) {
    // Nothing reporting now. For a past day the useful fact is whether it had gone quiet before it.
    if (date < today && latest >= dayStartMs) {
      return {
        title: userId ? "No captures on this day" : "No screenshots for this day",
        description: `${subject} reported after this day — the last time ${lastSeen} — but sent no screenshots for it. ${timing}`,
        links: [LINK.agents],
      };
    }
    return {
      title: userId ? `${who}'s agent isn't reporting` : "No agent is reporting",
      description: `${subject} ${live.length === 1 ? "is" : "are"} offline. The last report was ${lastSeen}.${
        date < today ? " Nothing was received for this day." : ""
      } Check the device is on, connected and signed in.`,
      links: [LINK.agents],
    };
  }

  return {
    title: userId ? "No captures on this day" : "No screenshots for this day",
    description: userId
      ? `${who}'s agent is online, but sent no screenshots for this day. ${timing}`
      : `${plural(online, "agent is", "agents are")} online now (of ${live.length} enrolled), but none sent screenshots for this day. ${timing}`,
    links: [LINK.agents],
  };
}
