import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(() => Promise.resolve({})),
  ApiError: class ApiError extends Error {},
}));

import { apiFetch } from "@/lib/api";
import {
  closeOrg,
  exportOrg,
  getWorkingHours,
  reopenOrg,
  updateOrg,
  updateWorkingHours,
} from "./org.service";

const mock = vi.mocked(apiFetch);
beforeEach(() => mock.mockClear());

describe("org.service route contract", () => {
  it("updateOrg PATCHes /v1/org with the partial body", async () => {
    await updateOrg({ name: "Acme", version: 3 });
    expect(mock).toHaveBeenCalledWith("/v1/org", {
      method: "PATCH",
      body: JSON.stringify({ name: "Acme", version: 3 }),
    });
  });

  it("lifecycle routes wrap the confirm slug", async () => {
    await closeOrg("acme");
    expect(mock).toHaveBeenCalledWith("/v1/org/close", {
      method: "POST",
      body: JSON.stringify({ confirm: "acme" }),
    });
    // Reopen asks for no confirmation server-side (`ownership::reopen_handler` takes no body).
    await reopenOrg();
    expect(mock).toHaveBeenCalledWith("/v1/org/reopen", { method: "POST" });
    await exportOrg("acme");
    expect(mock).toHaveBeenCalledWith("/v1/org/export", {
      method: "POST",
      body: JSON.stringify({ confirm: "acme" }),
    });
  });

  it("getWorkingHours reads the singleton", async () => {
    await getWorkingHours();
    expect(mock).toHaveBeenCalledWith("/v1/org/working-hours");
  });

  it("updateWorkingHours PATCHes only the fields given", async () => {
    await updateWorkingHours({ workdays: [1, 2, 3, 4, 7] });
    expect(mock).toHaveBeenCalledWith("/v1/org/working-hours", {
      method: "PATCH",
      body: JSON.stringify({ workdays: [1, 2, 3, 4, 7] }),
    });
  });
});
