import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(() => Promise.resolve({})),
  ApiError: class ApiError extends Error {},
}));

import { apiFetch } from "@/lib/api";
import { listMySessions, resetMfaDevice } from "./security.service";

const mock = vi.mocked(apiFetch);
beforeEach(() => mock.mockClear());

describe("security.service route contract", () => {
  it("listMySessions GETs /v1/me/sessions", async () => {
    mock.mockResolvedValueOnce([]);
    await listMySessions();
    expect(mock).toHaveBeenCalledWith("/v1/me/sessions");
  });

  it("resetMfaDevice POSTs the encoded user path", async () => {
    await resetMfaDevice("u1");
    expect(mock).toHaveBeenCalledWith("/v1/users/u1/mfa/reset", {
      method: "POST",
    });
  });
});
