import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the HTTP boundary so these are pure contract tests: assert the exact route/query the
// service builds. A drift here means the frontend calls a path the backend doesn't serve.
vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(() => Promise.resolve({ tasks: [] })),
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message);
    }
  },
}));

import { ApiError, apiFetch } from "@/lib/api";
import { addMembers, listMyTasks } from "./projects.service";

const mock = vi.mocked(apiFetch);
beforeEach(() => mock.mockClear());

/**
 * One endpoint, two purposes, and the flag is the whole distinction:
 *
 *  - a list a person **reads** as "my work" — assigned only, or a project's whole unclaimed
 *    backlog buries the two things they actually own;
 *  - a **name lookup** for a timesheet row — has to cover anything they could have tracked time
 *    against, and the desktop picker offers unclaimed tasks, so those very much turn up.
 *
 * Getting this backwards is silent in both directions: too broad and the dashboard grows tasks
 * nobody assigned; too narrow and a tracked task renders as "No description".
 */
describe("listMyTasks route contract", () => {
  it("asks for assigned work only by default", async () => {
    await listMyTasks();
    expect(mock).toHaveBeenCalledWith("/v1/me/tasks");
  });

  it("opts into unclaimed work when asked", async () => {
    await listMyTasks({ includeUnassigned: true });
    expect(mock).toHaveBeenCalledWith("/v1/me/tasks?include_unassigned=true");
  });

  /** An explicit `false` must not send the flag — the server treats presence as intent. */
  it("does not send the flag when it is explicitly false", async () => {
    await listMyTasks({ includeUnassigned: false });
    expect(mock).toHaveBeenCalledWith("/v1/me/tasks");
  });
});

/**
 * A new project's team used to go out as one unbounded burst whose failures were discarded under
 * "Project created" (WP-311). These pin the two things the caller now relies on.
 */
describe("addMembers", () => {
  const writes = ["u1", "u2", "u3"].map((userId) => ({ userId, role: "member" as const }));

  it("stops after the first refusal — every other add would be refused too", async () => {
    mock.mockRejectedValueOnce(new ApiError("forbidden", 403));
    await expect(addMembers("p1", writes)).resolves.toEqual({ failed: 3, denied: true });
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("counts the adds that failed, and reports the rest as added", async () => {
    mock
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new ApiError("busy", 503))
      .mockResolvedValueOnce({});
    await expect(addMembers("p1", writes)).resolves.toEqual({ failed: 1, denied: false });
    expect(mock).toHaveBeenCalledTimes(3);
    expect(mock).toHaveBeenCalledWith("/v1/projects/p1/members", {
      method: "POST",
      body: JSON.stringify({ user_id: "u1", role: "member" }),
    });
  });
});
