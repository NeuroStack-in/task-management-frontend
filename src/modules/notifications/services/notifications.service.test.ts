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
