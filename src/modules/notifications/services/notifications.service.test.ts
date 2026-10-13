import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the HTTP boundary so these are pure contract tests: assert the exact route/method/body each
// service builds. A drift here would mean the frontend calls a path the backend doesn't serve.
vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(() => Promise.resolve({})),
  ApiError: class ApiError extends Error {},
}));

import { apiFetch } from "@/lib/api";
import {
  getPrefs,
  listNotifications,
  markAllRead,
  markRead,
  dismissNotification,
  updatePrefs,
} from "./notifications.service";

const mock = vi.mocked(apiFetch);
beforeEach(() => mock.mockClear());

describe("notifications.service route contract", () => {
  it("listNotifications GETs the caller's items", async () => {
    // the service maps `.notifications` and reads `.unread`; hand it a well-formed envelope.
    mock.mockResolvedValueOnce({ notifications: [], unread: 0 });
    await listNotifications();
    expect(mock).toHaveBeenCalledWith("/v1/notifications");
  });

  it("markRead POSTs to the id-scoped read route, encoded", async () => {
    await markRead("n1");
    expect(mock).toHaveBeenCalledWith("/v1/notifications/n1/read", {
      method: "POST",
    });
  });

  it("dismiss DELETEs the notification, encoded", async () => {
    await dismissNotification("n 1");
    expect(mock).toHaveBeenCalledWith("/v1/notifications/n%201", { method: "DELETE" });
  });

  it("markAllRead POSTs to the read-all route", async () => {
    await markAllRead();
    expect(mock).toHaveBeenCalledWith("/v1/notifications/read-all", {
      method: "POST",
    });
  });

  it("getPrefs GETs the self-scoped prefs document", async () => {
    await getPrefs();
    expect(mock).toHaveBeenCalledWith("/v1/notifications/prefs");
  });

  it("updatePrefs PUTs the prefs blob wrapped under `prefs`", async () => {
    await updatePrefs({ email: true });
    expect(mock).toHaveBeenCalledWith("/v1/notifications/prefs", {
      method: "PUT",
      body: JSON.stringify({ prefs: { email: true } }),
    });
  });
});

describe("notification links", () => {
  /** WP-013: every leave link pointed at `/leave`, which is not a route — the 404 page. */
  it("sends leave notifications to pages that exist", async () => {
    mock.mockResolvedValueOnce({
      notifications: [
        { id: "a", ntype: "leave_approved", category: "approval", summary: "", read: false, created_at: 1 },
        { id: "b", ntype: "leave_awaiting_approval", category: "approval", summary: "", read: false, created_at: 2 },
        { id: "c", ntype: "ticket_replied", category: "system", summary: "", read: false, created_at: 3 },
      ],
      unread: 3,
    });
    const { items } = await listNotifications();
    const hrefs = Object.fromEntries(items.map((n) => [n.id, n.href]));
    expect(hrefs).toEqual({ a: "/leave-requests", b: "/approvals", c: "/help" });
  });

  /** WP-381: a two-factor reset is a `security` notification, not a generic System one. */
  it("keeps the security category and links a reset to the personal security page", async () => {
    mock.mockResolvedValueOnce({
      notifications: [
        { id: "m", ntype: "mfa_reset", category: "security", summary: "", read: false, created_at: 1 },
        { id: "x", ntype: "brand_new_event", category: "brand_new", summary: "", read: false, created_at: 2 },
      ],
      unread: 2,
    });
    const { items } = await listNotifications();
    expect(items.map((n) => [n.id, n.type, n.href])).toEqual([
      ["m", "security", "/settings/login-security"],
      ["x", "system", undefined],
    ]);
  });
});
