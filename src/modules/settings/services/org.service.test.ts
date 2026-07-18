import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(() => Promise.resolve({})),
  ApiError: class ApiError extends Error {},
}));

import { apiFetch } from "@/lib/api";
import {
  closeOrg,
  exportOrg,
  reopenOrg,
  transferOwnership,
  updateOrg,
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

  it("transferOwnership POSTs the new owner + typed slug confirm", async () => {
    await transferOwnership({ new_owner_id: "u1", confirm: "acme" });
    expect(mock).toHaveBeenCalledWith("/v1/org/transfer-ownership", {
      method: "POST",
      body: JSON.stringify({ new_owner_id: "u1", confirm: "acme" }),
    });
  });

  it("lifecycle routes wrap the confirm slug", async () => {
    await closeOrg("acme");
    expect(mock).toHaveBeenCalledWith("/v1/org/close", {
      method: "POST",
      body: JSON.stringify({ confirm: "acme" }),
    });
    await reopenOrg("acme");
    expect(mock).toHaveBeenCalledWith("/v1/org/reopen", {
      method: "POST",
      body: JSON.stringify({ confirm: "acme" }),
    });
    await exportOrg("acme");
    expect(mock).toHaveBeenCalledWith("/v1/org/export", {
      method: "POST",
      body: JSON.stringify({ confirm: "acme" }),
    });
  });
});
