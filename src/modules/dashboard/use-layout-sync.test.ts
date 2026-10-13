/**
 * Server sync for the dashboard layout — the cases that lost a user's layout (QA audit 2026-10-08,
 * WP-195): a change that never reached the server (a save cut short by leaving the page, a failed
 * PUT, an edit made before the first read returned) was overwritten by the server's older layout on
 * the next mount.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ApiDashboardLayouts,
  SaveLayoutRequest,
} from "./services/dashboard.service";

const api = vi.hoisted(() => ({
  getDashboardLayouts: vi.fn(),
  putDashboardLayout: vi.fn(),
}));

vi.mock("./services/dashboard.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./services/dashboard.service")>()),
  getDashboardLayouts: api.getDashboardLayouts,
  putDashboardLayout: api.putDashboardLayout,
}));
vi.mock("@/hooks/use-permissions", () => ({ usePermissions: () => ({ can: () => true }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

import { DEFAULT_WIDGETS, useDashboardStore } from "@/stores/dashboard.store";
import { useDashboardLayoutSync } from "./use-layout-sync";

/** The server holds a layout showing only "Department comparison", at `version`. */
function serverLayout(version: number): ApiDashboardLayouts {
  return {
    personal: { widgets: [], version: 0 },
    oversight: {
      widgets: [{ widget_id: "team_activity", order: 0, config: { visible: true } }],
      version,
    },
  };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** The PUT body of the n-th save. */
const putBody = (n = 0) => api.putDashboardLayout.mock.calls[n]?.[1] as SaveLayoutRequest;

describe("useDashboardLayoutSync", () => {
  beforeEach(() => {
    api.getDashboardLayouts.mockReset();
    api.putDashboardLayout.mockReset();
    api.putDashboardLayout.mockImplementation(async (_type: string, body: SaveLayoutRequest) => ({
      widgets: body.widgets,
      version: body.version + 1,
    }));
    useDashboardStore.setState({ widgets: DEFAULT_WIDGETS, unsynced: false });
  });

  it("installs the server's layout on a device with nothing unsynced", async () => {
    api.getDashboardLayouts.mockResolvedValue(serverLayout(3));
    renderHook(() => useDashboardLayoutSync());

    await waitFor(() => expect(useDashboardStore.getState().widgets).not.toBe(DEFAULT_WIDGETS));
    const visible = useDashboardStore.getState().widgets.filter((w) => w.visible);
    expect(visible.map((w) => w.type)).toEqual(["team_activity"]);
    expect(api.putDashboardLayout).not.toHaveBeenCalled();
  });

  it("pushes a layout this device never got confirmed instead of overwriting it", async () => {
    const local = DEFAULT_WIDGETS.map((w) =>
      w.type === "org_attendance" ? { ...w, visible: false } : w,
    );
    useDashboardStore.setState({ widgets: local, unsynced: true });
    api.getDashboardLayouts.mockResolvedValue(serverLayout(3));

    renderHook(() => useDashboardLayoutSync());

    await waitFor(() => expect(api.putDashboardLayout).toHaveBeenCalledTimes(1));
    expect(putBody().version).toBe(3);
    const attendance = putBody().widgets.find((p) => p.widget_id === "org_attendance");
    expect(attendance?.config.visible).toBe(false);
    expect(useDashboardStore.getState().widgets).toBe(local);
    await waitFor(() => expect(useDashboardStore.getState().unsynced).toBe(false));
  });

  it("keeps and pushes an edit made before the first read returned", async () => {
    const read = deferred<ApiDashboardLayouts>();
    api.getDashboardLayouts.mockReturnValue(read.promise);
    renderHook(() => useDashboardLayoutSync());

    act(() => useDashboardStore.getState().toggleWidget("org_attendance"));
    const edited = useDashboardStore.getState().widgets;

    await act(async () => {
      read.resolve(serverLayout(5));
    });
    await waitFor(() => expect(api.putDashboardLayout).toHaveBeenCalledTimes(1));
    expect(putBody().version).toBe(5);
    expect(useDashboardStore.getState().widgets).toBe(edited);
  });

  it("sends a save still waiting out its debounce when the dashboard unmounts", async () => {
    api.getDashboardLayouts.mockResolvedValue({
      personal: { widgets: [], version: 0 },
      oversight: { widgets: [], version: 2 },
    });
    const { unmount } = renderHook(() => useDashboardLayoutSync());
    await waitFor(() => expect(api.getDashboardLayouts).toHaveBeenCalled());
    await act(async () => {});

    act(() => useDashboardStore.getState().toggleWidget("org_attendance"));
    expect(api.putDashboardLayout).not.toHaveBeenCalled();

    unmount();
    await waitFor(() => expect(api.putDashboardLayout).toHaveBeenCalledTimes(1));
    expect(putBody().version).toBe(2);
  });

  it("leaves the layout unsynced when the save fails, so the next visit pushes it", async () => {
    api.getDashboardLayouts.mockResolvedValue(serverLayout(1));
    api.putDashboardLayout.mockRejectedValue(new Error("throttled"));
    useDashboardStore.setState({ widgets: DEFAULT_WIDGETS, unsynced: true });

    renderHook(() => useDashboardLayoutSync());
    await waitFor(() => expect(api.putDashboardLayout).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(useDashboardStore.getState().unsynced).toBe(true);
  });
});
