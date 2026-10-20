import { describe, expect, it } from "vitest";
import { orderSessions, sessionLabel } from "./sessions";

const s = (id: string, last: number | null, ua?: string) => ({
  session_id: id,
  last_seen: last,
  user_agent: ua,
});

describe("orderSessions", () => {
  it("puts this browser first, then the newest", () => {
    const rows = orderSessions([s("a", 300), s("me", 100), s("b", 200)], "me");
    expect(rows.map((r) => r.session.session_id)).toEqual(["me", "a", "b"]);
    expect(rows.map((r) => r.isThisDevice)).toEqual([true, false, false]);
  });

  it("marks nothing when this browser isn't in the list — no guessing (SET-18)", () => {
    const rows = orderSessions([s("a", 300), s("b", 200)], "me");
    expect(rows.some((r) => r.isThisDevice)).toBe(false);
    expect(rows[0].session.session_id).toBe("a");
  });

  it("marks nothing when this browser has no id (storage blocked)", () => {
    expect(orderSessions([s("", 1)], "").some((r) => r.isThisDevice)).toBe(false);
  });

  it("sessions never seen sort last", () => {
    const rows = orderSessions([s("never", null), s("recent", 5)], "");
    expect(rows.map((r) => r.session.session_id)).toEqual(["recent", "never"]);
  });
});

describe("sessionLabel", () => {
  it("uses the reported browser, else a plain name — never the id", () => {
    expect(sessionLabel(s("d-123", 1, "Chrome on Windows"))).toBe("Chrome on Windows");
    expect(sessionLabel(s("d-123", 1, "  "))).toBe("Web browser");
    expect(sessionLabel(s("d-123", 1))).toBe("Web browser");
  });
});
