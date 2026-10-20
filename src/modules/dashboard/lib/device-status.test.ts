import { describe, expect, it } from "vitest";
import type { MyDevice } from "@/modules/agents/services/my-devices.service";
import {
  describeConnection,
  desktopAppBehind,
  hasDesktopApp,
  isOlderVersion,
  primaryDevice,
} from "./device-status";

const dev = (over: Partial<MyDevice> = {}): MyDevice => ({
  agent_id: "a1",
  hostname: "LAPTOP-1",
  os: "Windows",
  agent_version: "0.1.30",
  last_heartbeat: 1_000,
  connectivity: "online",
  ...over,
});

describe("device status (UX audit EMP-09)", () => {
  it("keeps unknown distinct from 'not installed'", () => {
    expect(hasDesktopApp(null)).toBeNull();
    expect(hasDesktopApp([])).toBe(false);
    expect(primaryDevice(null)).toBeNull();
    expect(desktopAppBehind(null, "0.1.30")).toBe(false);
  });

  it("counts only active interactive devices as the desktop app", () => {
    expect(hasDesktopApp([dev({ state: "revoked" })])).toBe(false);
    expect(hasDesktopApp([dev({ variant: "managed" })])).toBe(false);
    expect(hasDesktopApp([dev({ variant: "service" })])).toBe(false);
    expect(hasDesktopApp([dev({ state: "" })])).toBe(true);
    expect(hasDesktopApp([dev({ state: "active" })])).toBe(true);
  });

  it("picks the most recently heard-from device of the preferred kind", () => {
    const old = dev({ agent_id: "old", last_heartbeat: 10 });
    const fresh = dev({ agent_id: "fresh", last_heartbeat: 20 });
    const managed = dev({ agent_id: "m", variant: "managed", last_heartbeat: 30 });
    expect(primaryDevice([old, fresh, managed], "interactive")?.agent_id).toBe("fresh");
    expect(primaryDevice([old, fresh, managed], "managed")?.agent_id).toBe("m");
    expect(primaryDevice([old, fresh, managed])?.agent_id).toBe("m");
    expect(primaryDevice([dev({ state: "released" })])).toBeNull();
  });

  it("compares versions numerically", () => {
    expect(isOlderVersion("0.1.9", "0.1.30")).toBe(true);
    expect(isOlderVersion("0.1.30", "0.1.30")).toBe(false);
    expect(isOlderVersion("v0.2.0", "0.1.30")).toBe(false);
    expect(isOlderVersion("0.1", "0.1.1")).toBe(true);
    expect(isOlderVersion("", "0.1.30")).toBe(false);
    expect(isOlderVersion("0.1.2", null)).toBe(false);
  });

  it("flags an update only for an installed app that is behind", () => {
    expect(desktopAppBehind([dev({ agent_version: "0.1.28" })], "0.1.30")).toBe(true);
    expect(desktopAppBehind([dev()], "0.1.30")).toBe(false);
    expect(desktopAppBehind([dev({ agent_version: "0.1.28", variant: "managed" })], "0.1.30")).toBe(
      false,
    );
    expect(desktopAppBehind([], "0.1.30")).toBe(false);
  });

  it("describes a connection without guessing", () => {
    const ago = () => "5m ago";
    expect(describeConnection(dev(), ago)).toEqual({ tone: "ok", label: "Connected" });
    expect(describeConnection(dev({ connectivity: "idle" }), ago).tone).toBe("idle");
    expect(describeConnection(dev({ connectivity: "offline" }), ago)).toEqual({
      tone: "offline",
      label: "Last seen 5m ago",
    });
    expect(describeConnection(dev({ last_heartbeat: 0 }), ago).tone).toBe("pending");
  });
});
