import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(() => Promise.resolve({})),
  ApiError: class ApiError extends Error {},
}));

import { apiFetch } from "@/lib/api";
import {
  createInvite,
  listInvites,
  deactivateEmployee,
  departmentMap,
  getEmployeeProfile,
  listEmployees,
  reactivateEmployee,
  resendInvite,
  revokeInvite,
  teamMap,
} from "./employees.service";

const mock = vi.mocked(apiFetch);
beforeEach(() => mock.mockClear());

describe("employees.service route contract", () => {
  it("listEmployees GETs /v1/employees", async () => {
    mock.mockResolvedValueOnce({ employees: [] });
    await listEmployees();
    expect(mock).toHaveBeenCalledWith("/v1/employees");
  });

  it("departmentMap GETs /v1/departments", async () => {
    mock.mockResolvedValueOnce([]);
    await departmentMap();
    expect(mock).toHaveBeenCalledWith("/v1/departments");
  });

  it("getEmployeeProfile GETs the encoded user path", async () => {
    await getEmployeeProfile("u1");
    expect(mock).toHaveBeenCalledWith("/v1/employees/u1");
  });

  it("teamMap GETs /v1/teams", async () => {
    mock.mockResolvedValueOnce([]);
    await teamMap();
    expect(mock).toHaveBeenCalledWith("/v1/teams");
  });

  it("deactivateEmployee POSTs the encoded deactivate path", async () => {
    await deactivateEmployee("u1");
    expect(mock).toHaveBeenCalledWith("/v1/employees/u1/deactivate", {
      method: "POST",
    });
  });

  it("reactivateEmployee POSTs the encoded reactivate path", async () => {
    await reactivateEmployee("u1");
    expect(mock).toHaveBeenCalledWith("/v1/employees/u1/reactivate", {
      method: "POST",
    });
  });

  it("createInvite POSTs /v1/employees/invites with the invite body", async () => {
    const body = {
      email: "a@acme.test",
      role_id: "r1",
      department_id: "d1",
      title: "Engineer",
      team_id: "t1",
    };
    await createInvite(body);
    expect(mock).toHaveBeenCalledWith("/v1/employees/invites", {
      method: "POST",
      body: JSON.stringify(body),
    });
  });

  it("listInvites GETs /v1/employees/invites", async () => {
    await listInvites();
    expect(mock).toHaveBeenCalledWith("/v1/employees/invites");
  });

  it("revokeInvite POSTs the encoded revoke path", async () => {
    await revokeInvite("i1");
    expect(mock).toHaveBeenCalledWith("/v1/employees/invites/i1/revoke", {
      method: "POST",
    });
  });

  it("resendInvite POSTs the encoded resend path", async () => {
    await resendInvite("i1");
    expect(mock).toHaveBeenCalledWith("/v1/employees/invites/i1/resend", {
      method: "POST",
    });
  });
});
