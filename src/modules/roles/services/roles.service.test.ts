import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the HTTP boundary so these are pure contract tests: assert the exact route/method/body each
// service builds. A drift here would mean the frontend calls a path the backend doesn't serve.
vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(() => Promise.resolve({})),
  ApiError: class ApiError extends Error {},
}));

import { apiFetch } from "@/lib/api";
import {
  assignRole,
  cloneRole,
  createRole,
  deleteRole,
  getPermissionCatalog,
  listRoles,
  updateRole,
} from "./roles.service";

const mock = vi.mocked(apiFetch);
beforeEach(() => mock.mockClear());

const payload = {
  name: "Analyst",
  description: "reads only",
  scope: "team",
  permissions: ["activity:read:self"],
};

describe("roles.service route contract", () => {
  it("lists roles", async () => {
    await listRoles();
    expect(mock).toHaveBeenCalledWith("/v1/roles");
  });

  it("gets the permission catalog", async () => {
    await getPermissionCatalog();
    expect(mock).toHaveBeenCalledWith("/v1/permissions");
  });

  it("creates a role via POST with the JSON body", async () => {
    await createRole(payload);
    expect(mock).toHaveBeenCalledWith("/v1/roles", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  });

  it("updates a role via PATCH on the encoded id", async () => {
    await updateRole("r1", payload);
    expect(mock).toHaveBeenCalledWith("/v1/roles/r1", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  });

  it("deletes a role via DELETE on the encoded id", async () => {
    await deleteRole("r1");
    expect(mock).toHaveBeenCalledWith("/v1/roles/r1", { method: "DELETE" });
  });

  it("clones a role with a name via POST", async () => {
    await cloneRole("r1", "Copy of Analyst");
    expect(mock).toHaveBeenCalledWith("/v1/roles/r1/clone", {
      method: "POST",
      body: JSON.stringify({ name: "Copy of Analyst" }),
    });
  });

  it("clones a role without a name sends an empty body object", async () => {
    await cloneRole("r1");
    expect(mock).toHaveBeenCalledWith("/v1/roles/r1/clone", {
      method: "POST",
      body: JSON.stringify({}),
    });
  });

  it("assigns a role via PUT on the user route with role_id body", async () => {
    await assignRole("u1", "r1");
    expect(mock).toHaveBeenCalledWith("/v1/users/u1/role", {
      method: "PUT",
      body: JSON.stringify({ role_id: "r1" }),
    });
  });
});
