import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the HTTP boundary so these are pure contract tests: assert the exact route/method/body each
// service builds. A drift here would mean the frontend calls a path the backend doesn't serve.
vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(() => Promise.resolve({})),
  ApiError: class ApiError extends Error {},
}));

import { apiFetch } from "@/lib/api";
import {
  draftRun,
  finalizeRun,
  getDeductions,
  getRun,
  listRuns,
  setCompensation,
  updateDeductions,
} from "./payroll.service";

const mock = vi.mocked(apiFetch);
beforeEach(() => mock.mockClear());

describe("payroll.service route contract", () => {
  it("listRuns GETs the runs collection", async () => {
    // getter unwraps `.runs`; give it something to unwrap so it doesn't throw.
    mock.mockResolvedValueOnce({ runs: [] });
    await listRuns();
    expect(mock).toHaveBeenCalledWith("/v1/payroll/runs");
  });

  it("getRun GETs the period-scoped run, encoded", async () => {
    await getRun("2026-08");
    expect(mock).toHaveBeenCalledWith("/v1/payroll/runs/2026-08");
  });

  it("draftRun POSTs the period body to the runs collection", async () => {
    await draftRun("2026-08");
    expect(mock).toHaveBeenCalledWith("/v1/payroll/runs", {
      method: "POST",
      body: JSON.stringify({ period: "2026-08" }),
    });
  });

  it("finalizeRun POSTs to the period finalize route", async () => {
    await finalizeRun("2026-08");
    expect(mock).toHaveBeenCalledWith("/v1/payroll/runs/2026-08/finalize", {
      method: "POST",
    });
  });

  it("getDeductions GETs the deduction rules", async () => {
    mock.mockResolvedValueOnce({ deductions: [] });
    await getDeductions();
    expect(mock).toHaveBeenCalledWith("/v1/payroll/deductions");
  });

  it("updateDeductions PUTs the full rule list under `deductions`", async () => {
    const rules = [{ name: "tax", kind: "percent", value: 10, active: true }];
    mock.mockResolvedValueOnce({ deductions: rules });
    await updateDeductions(rules);
    expect(mock).toHaveBeenCalledWith("/v1/payroll/deductions", {
      method: "PUT",
      body: JSON.stringify({ deductions: rules }),
    });
  });

  it("setCompensation PUTs pay_type + rate to the user-scoped comp route, encoded", async () => {
    await setCompensation("u 1", { pay_type: "hourly", rate: 42.5 });
    expect(mock).toHaveBeenCalledWith("/v1/payroll/comp/u%201", {
      method: "PUT",
      body: JSON.stringify({ pay_type: "hourly", rate: 42.5 }),
    });
  });
});
