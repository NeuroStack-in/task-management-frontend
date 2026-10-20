import { describe, expect, it } from "vitest";
import type { ApiDevice } from "../services/fleet.service";
import { cmpVersion, isBehind, latestVersions } from "./agent-version";

const dev = (id: string, version: string, extra: Partial<ApiDevice> = {}): ApiDevice => ({
  agent_id: id,
  user_id: "u",
  hostname: id,
  os: "Windows",
  os_version: "11",
  agent_version: version,
  ip: "",
  last_heartbeat: 0,
  connectivity: "offline",
  state: "active",
  cpu_pct: 0,
  mem_pct: 0,
  outbox_mb: 0,
  idle: false,
  ...extra,
});

describe("agent versions", () => {
  it("compares numerically, not as text", () => {
    expect(cmpVersion("0.1.9", "0.1.30")).toBeLessThan(0);
    expect(cmpVersion("v0.1.30", "0.1.30")).toBe(0);
    expect(cmpVersion("1.0", "0.9.9")).toBeGreaterThan(0);
  });

  it("an all-old fleet is behind the published release (SET-11)", () => {
    const fleet = [dev("a", "0.1.20"), dev("b", "0.1.20")];
    const latest = latestVersions(fleet, "0.1.30");
    expect(latest.appSource).toBe("release");
    expect(fleet.filter((d) => isBehind(d, latest))).toHaveLength(2);
  });

  it("falls back to the newest in the fleet while the release is unknown", () => {
    const fleet = [dev("a", "0.1.20"), dev("b", "0.1.25")];
    const latest = latestVersions(fleet, null);
    expect(latest).toMatchObject({ app: "0.1.25", appSource: "fleet" });
    expect(fleet.filter((d) => isBehind(d, latest)).map((d) => d.agent_id)).toEqual(["a"]);
  });

  it("the managed service is compared within its own stream", () => {
    const fleet = [
      dev("app", "0.1.30"),
      dev("svc-old", "0.2.0", { variant: "service" }),
      dev("svc-new", "0.2.4", { variant: "service" }),
    ];
    const latest = latestVersions(fleet, "0.1.30");
    expect(latest.service).toBe("0.2.4");
    expect(fleet.filter((d) => isBehind(d, latest)).map((d) => d.agent_id)).toEqual(["svc-old"]);
  });

  it("retired devices are never behind and never set the bar", () => {
    const fleet = [
      dev("live", "0.1.20"),
      dev("gone", "0.1.40", { state: "released" }),
      dev("gone-old", "0.1.1", { state: "revoked" }),
    ];
    const latest = latestVersions(fleet, null);
    expect(latest.app).toBe("0.1.20");
    expect(fleet.filter((d) => isBehind(d, latest))).toHaveLength(0);
  });

  it("a device newer than the release (a test build) is not behind", () => {
    const latest = latestVersions([dev("a", "0.1.31")], "0.1.30");
    expect(isBehind(dev("a", "0.1.31"), latest)).toBe(false);
  });
});
