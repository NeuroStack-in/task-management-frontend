import { describe, expect, it } from "vitest";
import {
  INACTIVE_AFTER_MS,
  ONLINE_WINDOW_MS,
  ago,
  isCounted,
  isInactive,
  lastSeenAt,
  lastSeenText,
  shownConnectivity,
} from "./device-activity";

const NOW = Date.UTC(2026, 9, 28, 12, 0, 0);
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

const dev = (over: Partial<Parameters<typeof shownConnectivity>[0]> = {}) => ({
  last_heartbeat: NOW - 2 * MIN,
  connectivity: "online",
  state: "active",
  ...over,
});

describe("lastSeenAt", () => {
  it("is the newer of the check-in and the server's last_seen", () => {
    expect(lastSeenAt({ last_heartbeat: 100 })).toBe(100);
    expect(lastSeenAt({ last_heartbeat: 100, last_seen: 400 })).toBe(400);
    expect(lastSeenAt({ last_heartbeat: 500, last_seen: 400 })).toBe(500);
  });
});

describe("shownConnectivity", () => {
  it("keeps the server's online and offline", () => {
    expect(shownConnectivity(dev(), NOW)).toBe("online");
    expect(shownConnectivity(dev({ connectivity: "offline" }), NOW)).toBe("offline");
    expect(shownConnectivity(dev({ connectivity: "weird" }), NOW)).toBe("offline");
  });

  it("shows Idle only from a recent check-in", () => {
    expect(shownConnectivity(dev({ connectivity: "idle" }), NOW)).toBe("idle");
    // 2026-10-28: a days-old idle flag beside a fresh live connection read "Idle".
    const stale = dev({ connectivity: "idle", last_heartbeat: NOW - 3 * DAY, presence_live: true });
    expect(shownConnectivity(stale, NOW)).toBe("online");
    expect(
      shownConnectivity(dev({ connectivity: "idle", last_heartbeat: NOW - ONLINE_WINDOW_MS - 1 }), NOW),
    ).toBe("online");
  });
});

describe("isInactive / isCounted", () => {
  const old = NOW - INACTIVE_AFTER_MS - DAY;

  it("an offline device unseen for 30+ days is inactive and not counted", () => {
    const d = dev({ connectivity: "offline", last_heartbeat: old });
    expect(isInactive(d, NOW)).toBe(true);
    expect(isCounted(d, NOW)).toBe(false);
  });

  it("a recent live connection keeps it active, even with an old check-in", () => {
    const d = dev({ connectivity: "offline", last_heartbeat: old, last_seen: NOW - 2 * DAY });
    expect(isInactive(d, NOW)).toBe(false);
    expect(isCounted(d, NOW)).toBe(true);
  });

  it("a device online now is never inactive", () => {
    expect(isInactive(dev({ last_heartbeat: old, presence_live: true }), NOW)).toBe(false);
  });

  it("a retired device is neither inactive nor counted", () => {
    const d = dev({ connectivity: "offline", last_heartbeat: old, state: "released" });
    expect(isInactive(d, NOW)).toBe(false);
    expect(isCounted(d, NOW)).toBe(false);
  });

  it("a device offline for a week is still counted", () => {
    expect(isCounted(dev({ connectivity: "offline", last_heartbeat: NOW - 7 * DAY }), NOW)).toBe(true);
  });
});

describe("lastSeenText", () => {
  it("says Now while the live connection is up", () => {
    expect(lastSeenText(dev({ presence_live: true, last_heartbeat: NOW - 12 * DAY }), NOW)).toBe("Now");
  });

  it("otherwise the newest sign of life", () => {
    expect(lastSeenText(dev({ connectivity: "offline", last_heartbeat: NOW - 12 * DAY, last_seen: NOW - 44 * MIN }), NOW)).toBe("44m ago");
    expect(lastSeenText(dev({ connectivity: "offline", last_heartbeat: 0 }), NOW)).toBe("never");
  });

  it("formats ages", () => {
    expect(ago(NOW - 30_000, NOW)).toBe("just now");
    expect(ago(NOW - 5 * MIN, NOW)).toBe("5m ago");
    expect(ago(NOW - 3 * 60 * MIN, NOW)).toBe("3h ago");
    expect(ago(NOW - 12 * DAY, NOW)).toBe("12d ago");
  });
});
