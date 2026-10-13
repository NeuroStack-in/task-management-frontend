/**
 * `useTimesheet`'s request bookkeeping.
 *
 * - A poll that lands while a foreground load is in flight is skipped. It used to supersede the
 *   load, and then nothing ever cleared `loading`: the table sat on skeleton rows and Refresh stayed
 *   disabled (QA audit 2026-10-08, WP-192).
 * - `null` reads nothing. `undefined` means *today*, so a caller still settling its date fetched
 *   today's sheet and armed the poll before fetching the day it wanted (WP-433).
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiTodayResponse } from "./services/timesheet.service";

const { getToday } = vi.hoisted(() => ({
  getToday: vi.fn<(date: string) => Promise<ApiTodayResponse>>(),
}));

vi.mock("./services/timesheet.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./services/timesheet.service")>()),
  getToday,
}));

vi.mock("@/modules/projects/services/projects.service", () => ({
  projectNameMap: () => Promise.resolve(new Map<string, string>()),
  listMyTasks: () => Promise.resolve([]),
}));

import { useTimesheet } from "./use-timesheet";

function sheet(date: string): ApiTodayResponse {
  return {
    date,
    entries: [
      {
        session_id: "s1",
        date,
        task_id: "t1",
        task_title: "Write the report",
        project_id: "",
        start: Date.parse(`${date}T09:00:00`),
        end: Date.parse(`${date}T10:00:00`),
        duration_secs: 3600,
        billable: false,
        source: "agent",
      },
    ],
    total_secs: 3600,
    billable_secs: 0,
    running: false,
  };
}

/** A promise the test settles by hand. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("useTimesheet", () => {
  beforeEach(() => {
    getToday.mockReset();
  });

  it("skips a poll that lands mid-load, and the load still clears `loading`", async () => {
    const first = deferred<ApiTodayResponse>();
    getToday.mockReturnValueOnce(first.promise);

    const { result } = renderHook(() => useTimesheet());
    expect(result.current.loading).toBe(true);
    expect(getToday).toHaveBeenCalledTimes(1);

    // Returning to the tab fires the poll's refetch at once — the foreground load is still out.
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(getToday).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.resolve(sheet("2026-10-08"));
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0]?.taskId).toBe("t1");
  });

  it("reads nothing, and polls nothing, for a day that is not known yet", () => {
    const { result } = renderHook(() => useTimesheet(null));
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(getToday).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("reads the given day once it is known", async () => {
    getToday.mockResolvedValue(sheet("2026-10-07"));
    const { result, rerender } = renderHook(({ day }: { day: string | null }) => useTimesheet(day), {
      initialProps: { day: null as string | null },
    });
    expect(getToday).not.toHaveBeenCalled();

    rerender({ day: "2026-10-07" });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getToday).toHaveBeenCalledTimes(1);
    expect(getToday).toHaveBeenCalledWith("2026-10-07");
  });
});
