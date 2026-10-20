import { describe, expect, it } from "vitest";

import { explainEmptyCaptureDay, LINK, type CaptureContext, type CaptureDevice } from "./capture-status";

const NOW = Date.UTC(2026, 9, 20, 12);
const HOUR = 3_600_000;
const base: CaptureContext = {
  screenshotsInPlan: true,
  screenshotsOn: true,
  cadenceOff: false,
  gateOff: false,
  devices: [],
  trackingMode: "project",
};
const device = (over: Partial<CaptureDevice> = {}): CaptureDevice => ({
  agent_id: "a-1",
  user_id: "u-1",
  last_heartbeat: NOW - 3 * 24 * HOUR,
  connectivity: "offline",
  state: "active",
  ...over,
});
const explain = (ctx: Partial<CaptureContext>, extra: { date?: string; userId?: string; name?: string } = {}) =>
  explainEmptyCaptureDay({
    ctx: { ...base, ...ctx },
    date: extra.date ?? "2026-10-20",
    today: "2026-10-20",
    dayStartMs: Date.UTC(2026, 9, extra.date === "2026-10-14" ? 14 : 20),
    userId: extra.userId,
    name: extra.name,
    when: (ms) => `T${Math.round((NOW - ms) / HOUR)}h`,
    ago: (ms) => `${Math.round((NOW - ms) / (24 * HOUR))}d ago`,
  });

describe("explainEmptyCaptureDay (UX audit MON-10)", () => {
  it("names the plan before anything else", () => {
    const g = explain({ screenshotsInPlan: false, screenshotsOn: false });
    expect(g.title).toMatch(/aren't in your plan/);
    expect(g.links).toEqual([LINK.billing]);
  });

  it("says screenshots are switched off, with Settings → Features", () => {
    const g = explain({ screenshotsOn: false });
    expect(g.title).toBe("Screenshots are switched off");
    expect(g.links).toEqual([LINK.features]);
  });

  it("says the interval is Off, with Settings → Monitoring", () => {
    const g = explain({ cadenceOff: true });
    expect(g.title).toBe("Screenshot capture is set to Off");
    expect(g.links).toEqual([LINK.monitoring]);
  });

  it("blames the capture policy only when every device is a managed one", () => {
    expect(explain({ gateOff: true, trackingMode: "machine" }).title).toBe("The capture policy is off");
    expect(explain({ gateOff: true, trackingMode: "project" }).title).not.toBe("The capture policy is off");
    expect(explain({ gateOff: true, trackingMode: "both" }).title).not.toBe("The capture policy is off");
  });

  it("says no agent is enrolled, with Download and Device agents", () => {
    const g = explain({ devices: [] });
    expect(g.title).toBe("No desktop agents enrolled yet");
    expect(g.links).toEqual([LINK.download, LINK.agents]);
  });

  it("ignores retired devices — they are quiet on purpose", () => {
    const g = explain({ devices: [device({ state: "revoked" })] });
    expect(g.title).toBe("No desktop agents enrolled yet");
  });

  it("says when silent agents last reported", () => {
    const g = explain({ devices: [device(), device({ agent_id: "a-2", last_heartbeat: NOW - 2 * 24 * HOUR })] });
    expect(g.title).toBe("No agent is reporting");
    expect(g.description).toContain("All 2 agents are offline");
    expect(g.description).toContain("T48h (2d ago)");
    expect(g.links).toEqual([LINK.agents]);
  });

  it("for a past day an agent heard from since, says it sent nothing for that day", () => {
    const g = explain({ devices: [device({ last_heartbeat: NOW - HOUR })] }, { date: "2026-10-14" });
    expect(g.description).toMatch(/reported after this day/);
    expect(g.description).toMatch(/timer is running/);
  });

  it("with agents online, explains when they capture", () => {
    const g = explain({ devices: [device({ connectivity: "online", last_heartbeat: NOW })] });
    expect(g.description).toMatch(/1 agent is online now/);
    expect(g.description).toMatch(/only while an employee's timer is running/);
  });

  it("narrows to one person's devices", () => {
    const devices = [device({ user_id: "u-2" })];
    const g = explain({ devices }, { userId: "u-1", name: "Asha" });
    expect(g.title).toBe("No agent enrolled for Asha");
    expect(g.links).toEqual([LINK.agents, LINK.download]);
    // A managed device counts for the person it is assigned to, not whoever enrolled it.
    const managed = [device({ user_id: "it-admin", assigned_user_id: "u-1" })];
    expect(explain({ devices: managed }, { userId: "u-1", name: "Asha" }).title).toBe("Asha's agent isn't reporting");
  });

  it("says nothing it can't know when the fleet can't be read", () => {
    const g = explain({ devices: null });
    expect(g.links).toEqual([]);
    expect(g.description).toMatch(/Someone who can open Device agents/);
  });
});
