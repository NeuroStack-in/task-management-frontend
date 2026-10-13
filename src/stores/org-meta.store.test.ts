import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api";

const getOrg = vi.fn();
vi.mock("@/modules/settings/services/org.service", () => ({
  getOrg: (...args: unknown[]) => getOrg(...args),
}));

import { resetOrgMeta, useOrgMetaStore } from "./org-meta.store";

const view = { name: "Acme", version: 3 } as never;

describe("org meta store", () => {
  beforeEach(() => {
    getOrg.mockReset();
    resetOrgMeta();
  });

  it("shows the loader on the first load only", async () => {
    getOrg.mockResolvedValue(view);
    const first = useOrgMetaStore.getState().load();
    expect(useOrgMetaStore.getState().status).toBe("loading");
    await first;
    expect(useOrgMetaStore.getState().status).toBe("ready");
  });

  /**
   * WP-001. The tab swaps its cards for a spinner while "loading", so a re-fetch that went back to
   * "loading" unmounted the card that asked; it re-mounted when the answer came and asked again —
   * forever, on any failed load. A re-fetch must leave the status where it is until it lands.
   */
  it("never returns to loading after a failed load", async () => {
    getOrg.mockRejectedValue(new ApiError("boom", 500));
    await useOrgMetaStore.getState().load();
    expect(useOrgMetaStore.getState().status).toBe("error");

    const again = useOrgMetaStore.getState().load();
    expect(useOrgMetaStore.getState().status).toBe("error");
    await again;
    expect(useOrgMetaStore.getState().status).toBe("error");
  });

  it("never returns to loading after a not-provisioned (404) load", async () => {
    getOrg.mockRejectedValue(new ApiError("not found", 404));
    await useOrgMetaStore.getState().load();
    expect(useOrgMetaStore.getState().status).toBe("ready");

    const again = useOrgMetaStore.getState().load();
    expect(useOrgMetaStore.getState().status).toBe("ready");
    await again;
  });

  it("recovers on a retry that succeeds", async () => {
    getOrg.mockRejectedValueOnce(new ApiError("busy", 503)).mockResolvedValueOnce(view);
    await useOrgMetaStore.getState().load();
    expect(useOrgMetaStore.getState().error).not.toBeNull();
    await useOrgMetaStore.getState().load();
    const s = useOrgMetaStore.getState();
    expect(s.status).toBe("ready");
    expect(s.error).toBeNull();
    expect(s.version).toBe(3);
  });

  it("collapses concurrent loads into one request", async () => {
    getOrg.mockResolvedValue(view);
    await Promise.all([
      useOrgMetaStore.getState().load(),
      useOrgMetaStore.getState().load(),
    ]);
    expect(getOrg).toHaveBeenCalledTimes(1);
  });
});
