import { beforeEach, describe, expect, it, vi } from "vitest";

const cognito = vi.hoisted(() => ({
  status: "active" as "active" | "gone" | "offline",
  fresh: [] as Array<(s: unknown) => void>,
}));
vi.mock("@/lib/cognito", () => ({
  getIdToken: vi.fn(async () => "id-token"),
  sessionStatus: vi.fn(async () => cognito.status),
  onFreshSession: (fn: (s: unknown) => void) => {
    cognito.fresh.push(fn);
    return () => {};
  },
}));
const logoutService = vi.hoisted(() => vi.fn());
vi.mock("@/modules/auth/services/auth.service", () => ({
  clearWorkPulseState: vi.fn(),
  completeSso: vi.fn(),
  completeTotpChallenge: vi.fn(),
  login: vi.fn(),
  logout: logoutService,
  reestablishSession: vi.fn(),
  // The test "session" is already the authority it carries.
  authorityOf: (s: Record<string, unknown>) => s,
  toSession: () => ({ token: "t2", userId: "u1", issuedAt: 2 }),
}));

/** A browser that remembers a sign-in: what `persist` wrote on the last visit. */
function remembered() {
  localStorage.setItem(
    "wp-auth",
    JSON.stringify({
      state: { session: null, user: { id: "u1" }, isAuthenticated: true },
      version: 0,
    }),
  );
}

async function loadStore() {
  vi.resetModules();
  const { useAuthStore } = await import("./auth.store");
  await vi.waitFor(() => expect(useAuthStore.getState().hydrated).toBe(true));
  return useAuthStore;
}

beforeEach(() => {
  localStorage.clear();
  logoutService.mockClear();
  cognito.fresh.length = 0;
});

/**
 * WP-011 (QA audit 2026-10-08): `isAuthenticated` was a persisted flag nobody reconciled with
 * Cognito, so a dead session rendered the shell forever and /login bounced back to it.
 */
describe("auth store and the Cognito session", () => {
  it("drops a remembered sign-in whose Cognito session is gone", async () => {
    cognito.status = "gone";
    remembered();
    const store = await loadStore();
    expect(store.getState().isAuthenticated).toBe(false);
    expect(store.getState().user).toBeNull();
    expect(logoutService).toHaveBeenCalledTimes(1);
  });

  it("keeps it while the session is alive, or when Cognito can't be reached", async () => {
    for (const status of ["active", "offline"] as const) {
      cognito.status = status;
      remembered();
      const store = await loadStore();
      expect(store.getState().isAuthenticated, status).toBe(true);
    }
    expect(logoutService).not.toHaveBeenCalled();
  });

  it("signs out when the API reports the session expired", async () => {
    cognito.status = "active";
    remembered();
    const store = await loadStore();
    const { onSessionExpired } = await import("@/lib/api");
    // The store subscribed at import; a fresh listener proves the channel, the store's state the effect.
    const seen = vi.fn();
    const off = onSessionExpired(seen);
    cognito.status = "gone";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 401, text: async () => "" }) as unknown as Response),
    );
    process.env.NEXT_PUBLIC_API_URL = "https://api.test";
    const { apiFetch } = await import("@/lib/api");
    await expect(apiFetch("/v1/me")).rejects.toMatchObject({ status: 401 });
    expect(seen).toHaveBeenCalledTimes(1);
    expect(store.getState().isAuthenticated).toBe(false);
    off();
    vi.unstubAllGlobals();
  });

  /** WP-129: nothing readable to restore must still end in `hydrated`, or guarded pages spin forever. */
  it("finishes hydrating when wp-auth holds corrupt JSON", async () => {
    localStorage.setItem("wp-auth", "{not json");
    const store = await loadStore();
    expect(store.getState().isAuthenticated).toBe(false);
    expect(logoutService).not.toHaveBeenCalled();
  });

  it("finishes hydrating when site storage is blocked", async () => {
    const own = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("The operation is insecure.", "SecurityError");
      },
    });
    try {
      const store = await loadStore();
      expect(store.getState().isAuthenticated).toBe(false);
    } finally {
      if (own) Object.defineProperty(window, "localStorage", own);
      else delete (window as { localStorage?: Storage }).localStorage;
    }
  });

  /** WP-093: a refreshed token's role and permissions reach the store without a re-login. */
  it("re-applies the authority a newer token carries", async () => {
    cognito.status = "active";
    remembered();
    const store = await loadStore();
    store.setState({ user: { ...store.getState().user!, roleId: "role-employee", perm: "1" } });
    const fresh = cognito.fresh.at(-1)!;
    fresh({ id: "u1", roleId: "role-admin", isOwner: false, organizationId: "t1", perm: "999" });
    expect(store.getState().user?.roleId).toBe("role-admin");
    expect(store.getState().user?.perm).toBe("999");
    // Someone else's token is not applied.
    fresh({ id: "u2", roleId: "role-owner", isOwner: true, organizationId: "t1", perm: "0" });
    expect(store.getState().user?.roleId).toBe("role-admin");
  });
});
