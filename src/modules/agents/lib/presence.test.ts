import { describe, expect, it } from "vitest";

import {
  bestPresence,
  effectiveUserId,
  isPresent,
  presenceOf,
  type PresenceDevice,
} from "./presence";

const interactive = (over: Partial<PresenceDevice> = {}): PresenceDevice => ({
  variant: "interactive",
  connectivity: "online",
  user_id: "u1",
  ...over,
});

const managed = (over: Partial<PresenceDevice> = {}): PresenceDevice => ({
  variant: "service",
  assigned_user_id: "u1",
  connectivity: "online",
  logon_state: "signed_in",
  ...over,
});

describe("effectiveUserId", () => {
  it("prefers the 1:1 assignment over who is signed in", () => {
    expect(effectiveUserId(managed({ assigned_user_id: "assignee", user_id: "signed-in" }))).toBe(
      "assignee",
    );
  });

  it("falls back to user_id for an interactive device", () => {
    expect(effectiveUserId(interactive({ assigned_user_id: undefined }))).toBe("u1");
  });

  it("is null when neither is set — never a crash for a consumer that reads it", () => {
    expect(effectiveUserId({ variant: "service" })).toBeNull();
  });
});

describe("presenceOf", () => {
  it("an interactive online device is in", () => {
    expect(presenceOf(interactive())).toBe("in");
  });

  /** The bug this module exists for #1: a managed machine slept mid-shift. */
  it("a slept managed laptop is asleep, not out", () => {
    expect(presenceOf(managed({ logon_state: "asleep", connectivity: "offline" }))).toBe("asleep");
  });

  /** The bug this module exists for #2: a managed machine heartbeats from boot with nobody on it. */
  it("a managed machine online but signed out is out, not in", () => {
    expect(presenceOf(managed({ logon_state: "signed_out", connectivity: "online" }))).toBe("out");
  });

  it("a managed signed-in device is in even if the heartbeat window briefly reads offline", () => {
    expect(presenceOf(managed({ logon_state: "signed_in", connectivity: "offline" }))).toBe("in");
  });

  it("a retired device is never present, whatever its telemetry says", () => {
    for (const state of ["deactivated", "released", "revoked"]) {
      expect(presenceOf(managed({ state }))).toBe("out");
    }
  });

  it("no effective user → out", () => {
    expect(presenceOf({ variant: "service", connectivity: "online" })).toBe("out");
  });

  it("an unknown logon_state falls through to the connectivity rule, never crashing", () => {
    expect(presenceOf(managed({ logon_state: "teleported", connectivity: "online" }))).toBe("in");
    expect(presenceOf(managed({ logon_state: "teleported", connectivity: "offline" }))).toBe("out");
  });

  it("offline interactive is out", () => {
    expect(presenceOf(interactive({ connectivity: "offline" }))).toBe("out");
  });
});

describe("bestPresence", () => {
  it("counts a person at any live device as in, once", () => {
    expect(
      bestPresence([
        managed({ logon_state: "signed_out", connectivity: "online" }), // out
        interactive({ connectivity: "online" }), // in
      ]),
    ).toBe("in");
  });

  it("asleep beats out when no device is in", () => {
    expect(
      bestPresence([
        managed({ logon_state: "asleep" }),
        interactive({ connectivity: "offline" }),
      ]),
    ).toBe("asleep");
  });

  it("all out is out", () => {
    expect(bestPresence([interactive({ connectivity: "offline" })])).toBe("out");
    expect(bestPresence([])).toBe("out");
  });
});

describe("isPresent", () => {
  it("asleep does not count toward a live headcount", () => {
    expect(isPresent(managed({ logon_state: "asleep" }))).toBe(false);
    expect(isPresent(managed())).toBe(true);
  });
});
