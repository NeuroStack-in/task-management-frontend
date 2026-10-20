import { describe, expect, it } from "vitest";

import type { EmployeeRow } from "../use-employees";
import {
  directoryStats,
  filterEmployees,
  hiddenByStatus,
  NO_DEPARTMENT,
  nextSort,
  sortEmployees,
} from "./directory";

function row(over: Partial<EmployeeRow> & { name: string }): EmployeeRow {
  return {
    id: over.name.toLowerCase().replace(/\s+/g, "-"),
    empId: null,
    roleName: "Employee",
    jobTitle: "",
    department: "Engineering",
    status: "active",
    monitored: false,
    benched: false,
    productivityScore: null,
    ...over,
  };
}

const roster: EmployeeRow[] = [
  row({
    name: "Asha Rao",
    empId: "ACME-0001",
    jobTitle: "Designer",
    department: "Design",
    productivityScore: 81,
  }),
  row({
    name: "Bilal Khan",
    roleName: "Admin",
    jobTitle: "Ops lead",
    department: "Operations",
    productivityScore: 64,
  }),
  row({ name: "Chen Wei", benched: true, department: "Engineering" }),
  row({
    name: "Dana Ortiz",
    status: "deactivated",
    department: "Sales",
    productivityScore: 40,
  }),
  row({ name: "Eli Park", department: "", roleName: "", productivityScore: 92 }),
];

const names = (rows: EmployeeRow[]) => rows.map((e) => e.name);

/** UX audit PEOPLE-05: the default view, and who is counted. */
describe("status filter and counts", () => {
  it("defaults to the working roster: no benched, no leavers", () => {
    const shown = filterEmployees(roster, { query: "", dept: "all", status: "active" });
    expect(names(shown)).toEqual(["Asha Rao", "Bilal Khan", "Eli Park"]);
  });

  it("keeps Not tracked and Deactivated apart", () => {
    expect(
      names(filterEmployees(roster, { query: "", dept: "all", status: "benched" })),
    ).toEqual(["Chen Wei"]);
    expect(
      names(filterEmployees(roster, { query: "", dept: "all", status: "deactivated" })),
    ).toEqual(["Dana Ortiz"]);
    expect(
      filterEmployees(roster, { query: "", dept: "all", status: "all" }),
    ).toHaveLength(5);
  });

  it("doesn't count leavers as employees", () => {
    expect(directoryStats(roster)).toEqual({
      total: 4,
      tracked: 3,
      benched: 1,
      deactivated: 1,
    });
  });
});

/** UX audit PEOPLE-04: search reaches department and role, not just name/ID/title. */
describe("search", () => {
  const find = (query: string, status: "active" | "all" = "all") =>
    names(filterEmployees(roster, { query, dept: "all", status }));

  it("matches name, employee ID, title, department and role", () => {
    expect(find("asha")).toEqual(["Asha Rao"]);
    expect(find("acme-0001")).toEqual(["Asha Rao"]);
    expect(find("ops lead")).toEqual(["Bilal Khan"]);
    expect(find("operations")).toEqual(["Bilal Khan"]);
    expect(find("admin")).toEqual(["Bilal Khan"]);
  });

  it("counts the matches another status hides, so the page can point at them", () => {
    const f = { query: "dana", dept: "all", status: "active" as const };
    expect(filterEmployees(roster, f)).toHaveLength(0);
    expect(hiddenByStatus(roster, f)).toBe(1);
    // No search, or "All statuses": nothing is hidden by status worth pointing at.
    expect(hiddenByStatus(roster, { ...f, query: "" })).toBe(0);
    expect(hiddenByStatus(roster, { ...f, status: "all" })).toBe(0);
  });

  it("filters on 'No department'", () => {
    expect(
      names(filterEmployees(roster, { query: "", dept: NO_DEPARTMENT, status: "all" })),
    ).toEqual(["Eli Park"]);
  });
});

/** UX audit PEOPLE-04: sortable columns. */
describe("sorting", () => {
  it("sorts by name either way", () => {
    expect(names(sortEmployees(roster, "name"))[0]).toBe("Asha Rao");
    expect(names(sortEmployees(roster, "-name"))[0]).toBe("Eli Park");
  });

  it("puts blanks last in both directions", () => {
    const up = names(sortEmployees(roster, "productivity"));
    const down = names(sortEmployees(roster, "-productivity"));
    expect(up).toEqual(["Dana Ortiz", "Bilal Khan", "Asha Rao", "Eli Park", "Chen Wei"]);
    expect(down).toEqual([
      "Eli Park",
      "Asha Rao",
      "Bilal Khan",
      "Dana Ortiz",
      "Chen Wei",
    ]);
    expect(names(sortEmployees(roster, "department")).at(-1)).toBe("Eli Park");
    expect(names(sortEmployees(roster, "-department")).at(-1)).toBe("Eli Park");
    expect(names(sortEmployees(roster, "-role")).at(-1)).toBe("Eli Park");
  });

  it("flips the same column and starts a new one ascending (scores highest first)", () => {
    expect(nextSort("name", "name")).toBe("-name");
    expect(nextSort("-name", "name")).toBe("name");
    expect(nextSort("name", "role")).toBe("role");
    expect(nextSort("name", "productivity")).toBe("-productivity");
  });
});
