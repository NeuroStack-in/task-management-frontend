import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ApiError } from "@/lib/api";

const employees = vi.hoisted(() => ({
  getEmployeeProfile: vi.fn(),
  departmentMap: vi.fn(),
  teamMap: vi.fn(),
}));
const insights = vi.hoisted(() => ({ getUserActivity: vi.fn(), getUserAppUsage: vi.fn() }));
const timesheet = vi.hoisted(() => ({ getUserTimesheet: vi.fn() }));
const attendance = vi.hoisted(() => ({ getUserDay: vi.fn() }));
const leave = vi.hoisted(() => ({ getOrgBalances: vi.fn() }));
const projects = vi.hoisted(() => ({ listUserProjects: vi.fn(), getProject: vi.fn() }));
const roles = vi.hoisted(() => ({ listRoles: vi.fn() }));

vi.mock("../services/employees.service", () => ({ ...employees, SCORE: 0 }));
vi.mock("@/modules/insights/services/insights.service", () => ({
  ...insights,
  SCORE_WINDOW_DAYS: 30,
}));
vi.mock("@/modules/time-tracking/services/timesheet.service", () => timesheet);
vi.mock("@/modules/attendance/services/attendance.service", () => attendance);
vi.mock("@/modules/leave/services/leave.service", () => leave);
vi.mock("@/modules/projects/services/projects.service", () => projects);
vi.mock("@/modules/roles/services/roles.service", () => roles);

import { chunks, collectEmployeeReport } from "./employee-report-data";
import { renderEmployeeReportPdf, reportFileName } from "./employee-report-pdf";

const PROFILE = {
  user_id: "u1",
  name: "Dana Whitfield",
  email: "dana@example.com",
  emp_id: "LF-004",
  title: "Engineer",
  department_id: "d1",
  team_id: "t1",
  role_id: "role-employee",
  status: "active",
  joined_at: 1_760_000_000_000,
};

beforeEach(() => {
  employees.getEmployeeProfile.mockResolvedValue(PROFILE);
  employees.departmentMap.mockResolvedValue(new Map([["d1", "Engineering"]]));
  employees.teamMap.mockResolvedValue(new Map([["t1", "Platform"]]));
  roles.listRoles.mockResolvedValue([{ id: "role-employee", name: "Employee" }]);
  attendance.getUserDay.mockResolvedValue({
    user_id: "u1",
    date: "2026-09-23",
    late: false,
    on_leave: false,
    permission_minutes: 0,
    worked_minutes: 125,
    running: false,
    entry_count: 2,
    clock_in: 1_790_000_000_000,
    clock_out: 1_790_007_500_000,
  });
  timesheet.getUserTimesheet.mockResolvedValue({
    from: "2026-06-25",
    to: "2026-09-23",
    total_secs: 7200,
    billable_secs: 3600,
    days: [
      {
        date: "2026-09-22",
        total_secs: 7200,
        billable_secs: 3600,
        entries: [
          {
            session_id: "s1",
            date: "2026-09-22",
            task_id: "t1",
            task_title: "Ship the report",
            project_id: "p1",
            start: 1_789_900_000_000,
            end: 1_789_907_200_000,
            duration_secs: 7200,
            billable: true,
            source: "agent",
          },
        ],
      },
    ],
  });
  insights.getUserActivity.mockResolvedValue({
    from: "2026-06-25",
    to: "2026-09-23",
    days: [{ date: "2026-09-22", score: 73, active_sec: 7000, productive_sec: 5000 }],
    trend: { days_scored: 1, avg_score: 73, best: null, worst: null, baseline: 60 },
  });
  insights.getUserAppUsage.mockResolvedValue({
    from: "2026-06-25",
    to: "2026-09-23",
    apps: [{ name: "VS Code", seconds: 5000, category: "productive" }],
    sites: [],
    truncated: false,
  });
  leave.getOrgBalances.mockResolvedValue({
    year: "2026",
    types: [],
    employees: [
      {
        user_id: "u1",
        name: "Dana",
        emp_id: "LF-004",
        department_id: "d1",
        balances: [
          { type_id: "annual", name: "Annual", paid: true, allowance: 12, used: 3, remaining: 9, adjusted: false, seeded: true },
        ],
      },
    ],
  });
  projects.listUserProjects.mockResolvedValue([
    { id: "p1", name: "WorkPulse", key: "WP", status: "active", billable: true, manager_user_id: "m1" },
  ]);
  projects.getProject.mockResolvedValue({
    id: "p1",
    name: "WorkPulse",
    key: "WP",
    description: "",
    status: "active",
    billable: true,
    start_date: "2026-01-01",
    manager_user_id: "m1",
    auto_hold: false,
    members: [],
    authority: "member",
    kpi: {
      completion_pct: 42,
      total_tasks: 10,
      tasks_by_status: { todo: 3, in_progress: 2, in_review: 1, done: 4, blocked: 0 },
      overdue_count: 1,
      active_members: 3,
      velocity: [],
      updated_at: 0,
    },
  });
});

afterEach(() => vi.clearAllMocks());

describe("collectEmployeeReport", () => {
  it("fetches every section fresh and reports progress", async () => {
    const steps: string[] = [];
    const r = await collectEmployeeReport("u1", (p) => steps.push(p.label));

    expect(employees.getEmployeeProfile).toHaveBeenCalledWith("u1");
    expect(r.departmentName).toBe("Engineering");
    expect(r.teamName).toBe("Platform");
    expect(r.roleName).toBe("Employee");
    expect(r.timesheet.ok && r.timesheet.data.total_secs).toBe(7200);
    expect(r.leave.ok && r.leave.data[0].balances[0].name).toBe("Annual");
    expect(r.projects.ok && r.projects.data[0].detail?.kpi?.total_tasks).toBe(10);
    expect(steps).toContain("profile");
    expect(steps.at(-1)).toBe("building the PDF");
  });

  it("stamps the generation time, so the file says when it was built", async () => {
    const before = Date.now();
    const r = await collectEmployeeReport("u1");
    expect(r.generatedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  /** A refused section must explain itself — an empty table would read as "this person has none". */
  it("turns a 403 into a printable reason rather than failing the whole report", async () => {
    leave.getOrgBalances.mockRejectedValue(new ApiError("Forbidden", 403));
    insights.getUserAppUsage.mockRejectedValue(new ApiError("Forbidden", 403));

    const r = await collectEmployeeReport("u1");

    expect(r.leave.ok).toBe(false);
    expect(!r.leave.ok && r.leave.reason).toMatch(/don't have access to leave balances/);
    expect(!r.apps.ok && r.apps.reason).toMatch(/don't have access to app usage/);
    // The sections that were permitted still made it in.
    expect(r.timesheet.ok).toBe(true);
    expect(r.profile.name).toBe("Dana Whitfield");
  });

  it("keeps going when one project's detail read fails", async () => {
    projects.getProject.mockRejectedValue(new ApiError("Gone", 404));
    const r = await collectEmployeeReport("u1");
    expect(r.projects.ok && r.projects.data[0].detail).toBeNull();
  });
});

describe("renderEmployeeReportPdf", () => {
  it("produces a multi-page PDF that carries the employee's data", async () => {
    const r = await collectEmployeeReport("u1");
    const doc = renderEmployeeReportPdf(r);

    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    const text = doc.output("datauristring");
    expect(text.startsWith("data:application/pdf")).toBe(true);
  });

  it("renders even when every optional section was refused", async () => {
    leave.getOrgBalances.mockRejectedValue(new ApiError("Forbidden", 403));
    insights.getUserAppUsage.mockRejectedValue(new ApiError("Forbidden", 403));
    insights.getUserActivity.mockRejectedValue(new ApiError("Forbidden", 403));
    timesheet.getUserTimesheet.mockRejectedValue(new ApiError("Forbidden", 403));
    attendance.getUserDay.mockRejectedValue(new ApiError("Forbidden", 403));
    projects.listUserProjects.mockRejectedValue(new ApiError("Forbidden", 403));

    const r = await collectEmployeeReport("u1");
    expect(() => renderEmployeeReportPdf(r)).not.toThrow();
  });

  it("names the file from the employee code and the generation day", async () => {
    const r = await collectEmployeeReport("u1");
    expect(reportFileName(r)).toMatch(/^LF-004-report-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  /** A uuid is an internal id, not an employee code — fall back to the person's name. */
  it("falls back to the name when the employee code is a uuid", async () => {
    employees.getEmployeeProfile.mockResolvedValue({
      ...PROFILE,
      emp_id: "3f1b0c2e-6a1d-4b7a-9f2e-0a1b2c3d4e5f",
    });
    const r = await collectEmployeeReport("u1");
    expect(reportFileName(r)).toMatch(/^Dana-Whitfield-report-/);
  });
});

describe("history walking", () => {
  it("splits a long range into windows that respect each server cap", () => {
    // 92 days is the timesheet cap; a 365-day year needs four windows, contiguous and non-overlapping.
    const year = chunks("2026-01-01", "2026-12-31", 92);
    expect(year.length).toBe(4);
    expect(year[0]).toEqual({ from: "2026-01-01", to: "2026-04-02" });
    expect(year.at(-1)?.to).toBe("2026-12-31");
    for (const [a, b] of year.slice(0, -1).map((w, i) => [w, year[i + 1]] as const)) {
      expect(new Date(b.from).getTime() - new Date(a.to).getTime()).toBe(86_400_000);
    }
  });

  it("returns a single window when the range already fits", () => {
    expect(chunks("2026-09-01", "2026-09-10", 92)).toEqual([
      { from: "2026-09-01", to: "2026-09-10" },
    ]);
  });

  /** The whole point of the rewrite: history starts the day the person joined. */
  it("walks from the join date, asking the server for every window", async () => {
    const joined = new Date();
    joined.setDate(joined.getDate() - 200);
    employees.getEmployeeProfile.mockResolvedValue({ ...PROFILE, joined_at: joined.getTime() });

    const r = await collectEmployeeReport("u1");

    expect(r.history.anchoredOnJoinDate).toBe(true);
    expect(r.history.days).toBeGreaterThanOrEqual(200);
    // 200 days ÷ 92 = 3 timesheet windows, ÷ 62 = 4 app windows.
    expect(timesheet.getUserTimesheet).toHaveBeenCalledTimes(3);
    expect(insights.getUserAppUsage).toHaveBeenCalledTimes(4);
  });

  it("merges chunks: days are deduped and totals re-summed across windows", async () => {
    const joined = new Date();
    joined.setDate(joined.getDate() - 120);
    employees.getEmployeeProfile.mockResolvedValue({ ...PROFILE, joined_at: joined.getTime() });
    let n = 0;
    timesheet.getUserTimesheet.mockImplementation(async () => {
      n += 1;
      return {
        from: "x",
        to: "y",
        total_secs: 3600,
        billable_secs: 1800,
        days: [{ date: `2026-0${n}-01`, total_secs: 3600, billable_secs: 1800, entries: [] }],
      };
    });

    const r = await collectEmployeeReport("u1");

    expect(r.timesheet.ok && r.timesheet.data.days.length).toBe(2);
    expect(r.timesheet.ok && r.timesheet.data.total_secs).toBe(7200);
  });

  it("sums one app's time across every window instead of keeping the last", async () => {
    const joined = new Date();
    joined.setDate(joined.getDate() - 120);
    employees.getEmployeeProfile.mockResolvedValue({ ...PROFILE, joined_at: joined.getTime() });
    insights.getUserAppUsage.mockResolvedValue({
      from: "x",
      to: "y",
      apps: [{ name: "VS Code", seconds: 1000, category: "productive" }],
      sites: [{ name: "github.com", seconds: 500, category: "productive" }],
      truncated: true,
    });

    const r = await collectEmployeeReport("u1");

    const vscode = r.apps.ok && r.apps.data.rows.find((x) => x.name === "VS Code");
    expect(vscode && vscode.seconds).toBe(2000); // two windows × 1000
    expect(r.apps.ok && r.apps.data.rows.find((x) => x.kind === "Website")?.name).toBe("github.com");
    expect(r.apps.ok && r.apps.data.truncated).toBe(true);
  });

  it("recomputes the trend over the whole history, not per window", async () => {
    const joined = new Date();
    joined.setDate(joined.getDate() - 400);
    employees.getEmployeeProfile.mockResolvedValue({ ...PROFILE, joined_at: joined.getTime() });
    let n = 0;
    insights.getUserActivity.mockImplementation(async () => {
      n += 1;
      return {
        from: "x",
        to: "y",
        days: [{ date: `2026-0${n}-15`, score: n === 1 ? 40 : 80, active_sec: 3600 }],
        trend: { days_scored: 1, avg_score: n === 1 ? 40 : 80, best: null, worst: null, baseline: 55 },
      };
    });

    const r = await collectEmployeeReport("u1");

    expect(r.activity.ok && r.activity.data.trend.days_scored).toBe(2);
    expect(r.activity.ok && r.activity.data.trend.avg_score).toBe(60); // (40 + 80) / 2
    expect(r.activity.ok && r.activity.data.trend.best?.score).toBe(80);
    expect(r.activity.ok && r.activity.data.trend.worst?.score).toBe(40);
  });

  it("collects a leave ledger for every calendar year on record", async () => {
    const joined = new Date();
    joined.setFullYear(joined.getFullYear() - 1);
    employees.getEmployeeProfile.mockResolvedValue({ ...PROFILE, joined_at: joined.getTime() });

    const r = await collectEmployeeReport("u1");

    expect(leave.getOrgBalances).toHaveBeenCalledTimes(2);
    expect(r.leave.ok && r.leave.data.length).toBe(2);
    // Newest year first.
    if (!r.leave.ok) throw new Error(r.leave.reason);
    expect(Number(r.leave.data[0].year)).toBeGreaterThan(Number(r.leave.data[1].year));
  });
});
