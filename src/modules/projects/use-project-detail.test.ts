/**
 * The project page's freshness (UX audit PROJ-20): it re-reads every 30 s, quietly, and never under a
 * dialog or a drag — nor in a way that springs back a card the person has just moved.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({ can: () => false }),
}));

const getProject = vi.fn();
const getBoard = vi.fn();
const updateTask = vi.fn();
vi.mock("./services/projects.service", () => ({
  getProject: (...a: unknown[]) => getProject(...a),
  getBoard: (...a: unknown[]) => getBoard(...a),
  updateTask: (...a: unknown[]) => updateTask(...a),
  readProjectDirectory: () => Promise.resolve({ people: {}, departments: [] }),
  updateProject: vi.fn(),
  transferProjectManager: vi.fn(),
  deleteProject: vi.fn(),
  createTask: vi.fn(),
  deleteTask: vi.fn(),
  addMember: vi.fn(),
  addMembers: vi.fn(),
  removeMember: vi.fn(),
}));

import { useProjectDetail } from "./use-project-detail";

const detail = {
  id: "p1",
  name: "Atlas",
  description: "",
  status: "active",
  billable: true,
  start_date: "2026-09-01",
  manager_user_id: "u-mgr",
  auto_hold: false,
  authority: "member",
  members: [
    { user_id: "u-mgr", project_role: "manager", name: "Kiran" },
    { user_id: "u-me", project_role: "member", name: "Me" },
  ],
};
const board = (status: string) => [
  { status, tasks: [{ id: "k1", title: "Spec", priority: "high", assignees: [] }] },
];

/** A promise the test settles by hand — a read still out when something else happens. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

async function tick() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000);
  });
}

describe("useProjectDetail — polling (PROJ-20)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    getProject.mockReset().mockResolvedValue(detail);
    getBoard.mockReset().mockResolvedValue(board("todo"));
    updateTask.mockReset().mockResolvedValue({});
  });
  afterEach(() => vi.useRealTimers());

  it("re-reads every 30 s without showing a loading state", async () => {
    const { result } = renderHook(() => useProjectDetail("p1"));
    await flush();
    expect(result.current.tasks[0]?.status).toBe("todo");
    const reads = getProject.mock.calls.length;

    getBoard.mockResolvedValue(board("in_progress"));
    const pending = deferred<typeof detail>();
    getProject.mockReturnValueOnce(pending.promise);
    await tick();
    expect(getProject.mock.calls.length).toBe(reads + 1);
    // Out, but quiet: no spinner, nothing blanked.
    expect(result.current.loading).toBe(false);
    expect(result.current.tasks[0]?.status).toBe("todo");

    pending.resolve(detail);
    await flush();
    expect(result.current.tasks[0]?.status).toBe("in_progress");
  });

  it("leaves the state alone when nothing changed", async () => {
    const { result } = renderHook(() => useProjectDetail("p1"));
    await flush();
    const before = result.current.tasks;
    await tick();
    expect(getProject.mock.calls.length).toBeGreaterThan(1);
    expect(result.current.tasks).toBe(before);
  });

  it("holds off while paused, and catches up the moment it is let go", async () => {
    const { result, rerender } = renderHook(({ paused }) => useProjectDetail("p1", { paused }), {
      initialProps: { paused: false },
    });
    await flush();
    const reads = getProject.mock.calls.length;

    rerender({ paused: true });
    getBoard.mockResolvedValue(board("in_review"));
    await tick();
    await tick();
    expect(getProject.mock.calls.length).toBe(reads);
    expect(result.current.tasks[0]?.status).toBe("todo");

    rerender({ paused: false });
    await flush();
    expect(getProject.mock.calls.length).toBe(reads + 1);
    expect(result.current.tasks[0]?.status).toBe("in_review");
  });

  it("does not spring back a card moved while a poll was out", async () => {
    const { result } = renderHook(() => useProjectDetail("p1"));
    await flush();

    // A poll goes out and will answer with the board as it was…
    const stale = deferred<ReturnType<typeof board>>();
    getBoard.mockReturnValueOnce(stale.promise);
    await tick();

    // …the person moves the card meanwhile; the server takes it.
    const write = deferred<object>();
    updateTask.mockReturnValueOnce(write.promise);
    getBoard.mockResolvedValue(board("in_progress"));
    let move!: Promise<void>;
    act(() => {
      move = result.current.moveTask("k1", "in_progress");
    });
    expect(result.current.tasks[0]?.status).toBe("in_progress");

    // The stale answer lands first: ignored.
    stale.resolve(board("todo"));
    await flush();
    expect(result.current.tasks[0]?.status).toBe("in_progress");

    write.resolve({});
    await act(async () => {
      await move;
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.tasks[0]?.status).toBe("in_progress");
  });

  it("stops polling once the project is gone", async () => {
    const { result } = renderHook(() => useProjectDetail("p1"));
    await flush();
    const { ApiError } = await import("@/lib/api");
    getProject.mockRejectedValue(new ApiError("Not found", 404));
    await tick();
    expect(result.current.notFound).toBe(true);
    const reads = getProject.mock.calls.length;
    await tick();
    await tick();
    expect(getProject.mock.calls.length).toBe(reads);
  });
});
