import { beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({ status: "active" as "active" | "gone" | "offline" }));
vi.mock("@/lib/cognito", () => ({
  getIdToken: vi.fn(async () => "id-token"),
  sessionStatus: vi.fn(async () => session.status),
}));

process.env.NEXT_PUBLIC_API_URL = "https://api.test";

import { ApiError, apiFetch, onSessionExpired } from "./api";

/** A `fetch` stub returning one canned response. `text()` is what `apiFetch` reads. */
function reply(status: number, raw: string) {
  const res = { ok: status >= 200 && status < 300, status, text: async () => raw };
  return vi.fn(async () => res as unknown as Response);
}

beforeEach(() => vi.restoreAllMocks());

describe("apiFetch without a token", () => {
  /** WP-391: a refresh that failed on the network is a connection error, never a silent 401. */
  it("reports a connection problem instead of sending the request unauthenticated", async () => {
    const { getIdToken } = await import("@/lib/cognito");
    vi.mocked(getIdToken).mockResolvedValueOnce(null);
    session.status = "offline";
    const f = reply(200, JSON.stringify({ data: {} }));
    vi.stubGlobal("fetch", f);
    await expect(apiFetch("/v1/me/profile")).rejects.toMatchObject({ status: 0, code: "network" });
    expect(f).not.toHaveBeenCalled();
    session.status = "active";
  });
});

describe("apiFetch response handling", () => {
  it("unwraps the success envelope", async () => {
    vi.stubGlobal("fetch", reply(200, JSON.stringify({ data: { id: "p1" } })));
    await expect(apiFetch("/v1/projects/p1")).resolves.toEqual({ id: "p1" });
  });

  /**
   * The regression. `DELETE /v1/projects/{id}/members/{user_id}` answers **204 with no body**, and
   * the old code did `(await res.json()).data` — `res.json()` rejected, the `.catch` made it `null`,
   * and reading `.data` off `null` threw. The member really was removed, but the UI reported that it
   * hadn't been. Every 204 route was affected, task deletion included.
   */
  it("treats a 204 as success rather than throwing on an absent envelope", async () => {
    vi.stubGlobal("fetch", reply(204, ""));
    await expect(
      apiFetch("/v1/projects/p1/members/u1", { method: "DELETE" }),
    ).resolves.toBeUndefined();
  });

  /** A handler returning `Ok(())` answers 200 with an empty body — same reasoning as the 204. */
  it("treats an empty 200 body as success", async () => {
    vi.stubGlobal("fetch", reply(200, ""));
    await expect(apiFetch("/v1/thing", { method: "POST" })).resolves.toBeUndefined();
  });

  /**
   * The error envelope becomes an `ApiError` whose `message` is display-ready (`lib/errors`) while
   * the server's own words are kept on `serverMessage` for the console — callers render `message`,
   * so the raw text must not be it.
   */
  it("surfaces the server's error envelope as an ApiError with friendly text", async () => {
    vi.stubGlobal(
      "fetch",
      reply(
        403,
        JSON.stringify({ error: { code: "forbidden", message: "missing bit 17" } }),
      ),
    );
    await expect(apiFetch("/v1/projects")).rejects.toMatchObject({
      status: 403,
      code: "forbidden",
      serverMessage: "missing bit 17",
    });
    await expect(apiFetch("/v1/projects")).rejects.toThrow(/don't have permission/i);
  });

  /** A 400 keeps the server's sentence — it names the one thing that was wrong. */
  it("keeps a validation message from a 400", async () => {
    vi.stubGlobal(
      "fetch",
      reply(400, JSON.stringify({ error: { message: "end_date must be YYYY-MM-DD" } })),
    );
    await expect(apiFetch("/v1/projects")).rejects.toThrow("End date must be YYYY-MM-DD.");
  });

  /** `fetch` rejecting means the request never landed — that is a connection message, not a crash. */
  it("turns a network failure into an offline ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    await expect(apiFetch("/v1/projects")).rejects.toMatchObject({ status: 0 });
    await expect(apiFetch("/v1/projects")).rejects.toThrow(/internet connection/i);
  });

  /** An empty *error* body must still be an ApiError with its status, not a success. */
  it("still throws on an error status with no body", async () => {
    vi.stubGlobal("fetch", reply(500, ""));
    await expect(apiFetch("/v1/projects")).rejects.toBeInstanceOf(ApiError);
  });

  /** A non-empty body that isn't the envelope is a contract break — a clear error beats a TypeError. */
  it("rejects an OK response whose body is not an envelope", async () => {
    vi.stubGlobal("fetch", reply(200, JSON.stringify({ projects: [] })));
    await expect(apiFetch("/v1/projects")).rejects.toBeInstanceOf(ApiError);
  });
});

/**
 * WP-011 (QA audit 2026-10-08): nothing reacted to a 401, so a dead session left the shell rendering
 * with every panel failing. A 401 now signs the user out — but only when Cognito confirms the session
 * is gone, because the public invite routes also answer 401 for a bad link.
 */
describe("apiFetch and a dead session", () => {
  it("reports a 401 when the Cognito session is gone", async () => {
    session.status = "gone";
    const expired = vi.fn();
    const off = onSessionExpired(expired);
    vi.stubGlobal("fetch", reply(401, JSON.stringify({ error: { code: "unauthorized" } })));
    await expect(apiFetch("/v1/projects")).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledTimes(1);
    off();
  });

  it("does not sign anyone out over a 401 while the session is alive or unknown", async () => {
    const expired = vi.fn();
    const off = onSessionExpired(expired);
    vi.stubGlobal("fetch", reply(401, JSON.stringify({ error: { code: "unauthorized" } })));
    for (const status of ["active", "offline"] as const) {
      session.status = status;
      await expect(apiFetch("/v1/invites/inv-1?tenant_id=t&token=x")).rejects.toMatchObject({
        status: 401,
      });
    }
    expect(expired).not.toHaveBeenCalled();
    off();
  });

  it("does not check the session for other failures", async () => {
    session.status = "gone";
    const expired = vi.fn();
    const off = onSessionExpired(expired);
    vi.stubGlobal("fetch", reply(403, JSON.stringify({ error: { code: "forbidden" } })));
    await expect(apiFetch("/v1/projects")).rejects.toMatchObject({ status: 403 });
    expect(expired).not.toHaveBeenCalled();
    off();
  });
});
