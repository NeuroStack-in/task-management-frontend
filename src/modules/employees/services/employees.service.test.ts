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
  listAllEmployees,
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

  it("listEmployees passes dept/limit/cursor through as query params", async () => {
    mock.mockResolvedValueOnce({ employees: [] });
    await listEmployees({ dept: "d1", limit: 100, cursor: "c1" });
    expect(mock).toHaveBeenCalledWith("/v1/employees?dept=d1&limit=100&cursor=c1");
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


/**
 * `listAllEmployees` exists because `GET /v1/employees` **without** `dept` truncates to `limit` and
 * returns no cursor — the rest of the org is unreachable. Anything deriving a headcount or a
 * filter's option list from the bare call silently loses whole departments, which is what made the
 * dashboard's department filter look broken.
 */
describe("listAllEmployees — the whole roster, not the first page", () => {
  it("walks every department plus the unassigned bucket, following cursors", async () => {
    // GET /v1/departments
    mock.mockResolvedValueOnce([{ id: "eng", name: "Engineering" }]);
    // eng, page 1 (has a cursor) then page 2 (no cursor)
    mock.mockResolvedValueOnce({
      employees: [{ user_id: "u1", name: "Ann", status: "active", department_id: "eng" }],
      cursor: "next",
    });
    mock.mockResolvedValueOnce({
      employees: [{ user_id: "u2", name: "Bob", status: "active", department_id: "eng" }],
    });
    // the unassigned partition
    mock.mockResolvedValueOnce({
      employees: [
        { user_id: "u3", name: "Cara", status: "active", department_id: "unassigned" },
      ],
    });

    const all = await listAllEmployees();

    expect(all.map((e) => e.user_id)).toEqual(["u1", "u2", "u3"]);
    const urls = mock.mock.calls.map((c) => c[0]);
    expect(urls).toContain("/v1/employees?dept=eng&limit=100");
    expect(urls).toContain("/v1/employees?dept=eng&limit=100&cursor=next");
    // The unassigned bucket is a real partition — skipping it drops those people from every total.
    expect(urls).toContain("/v1/employees?dept=unassigned&limit=100");
  });

  it("dedupes a user seen under two partitions rather than double-counting", async () => {
    mock.mockResolvedValueOnce([
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ]);
    const row = { user_id: "u1", name: "Ann", status: "active", department_id: "a" };
    mock.mockResolvedValueOnce({ employees: [row] });
    mock.mockResolvedValueOnce({ employees: [row] });
    mock.mockResolvedValueOnce({ employees: [] });

    expect(await listAllEmployees()).toHaveLength(1);
  });

  it("falls back to a single capped page when departments are unreadable", async () => {
    mock.mockRejectedValueOnce(new Error("403"));
    mock.mockResolvedValueOnce({
      employees: [{ user_id: "u1", name: "Ann", status: "active", department_id: "eng" }],
    });

    const all = await listAllEmployees();

    expect(all).toHaveLength(1);
    expect(mock).toHaveBeenLastCalledWith("/v1/employees?limit=100");
  });

  it("one unreadable department does not empty the roster", async () => {
    mock.mockResolvedValueOnce([
      { id: "ok", name: "OK" },
      { id: "bad", name: "Bad" },
    ]);
    // Partitions are fanned out concurrently, so resolve by URL rather than call order.
    mock.mockImplementation((url: string) => {
      if (url.includes("dept=bad")) return Promise.reject(new Error("boom"));
      if (url.includes("dept=ok")) {
        return Promise.resolve({
          employees: [{ user_id: "u1", name: "Ann", status: "active", department_id: "ok" }],
        });
      }
      return Promise.resolve({ employees: [] });
    });

    expect(await listAllEmployees()).toHaveLength(1);
    mock.mockReset();
  });});
