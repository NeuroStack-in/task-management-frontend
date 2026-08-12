import { describe, expect, it } from "vitest";

import { CSV_TEMPLATE, parseEmployeeCsv } from "./parse-employee-csv";

describe("parseEmployeeCsv", () => {
  it("reads the documented template, which is the file people will actually start from", () => {
    const out = parseEmployeeCsv(CSV_TEMPLATE);
    expect(out.fatal).toBeUndefined();
    expect(out.errors).toEqual([]);
    expect(out.rows).toEqual([
      {
        name: "Priya Nair",
        email: "priya.nair@example.com",
        department: "Engineering",
        team: "Platform",
        title: "Backend Engineer",
      },
      {
        name: "Sam Okoro",
        email: "sam.okoro@example.com",
        department: "Support",
        title: "Support Specialist",
      },
    ]);
  });

  /** An HR export names its columns however it likes; matching is by meaning, not by string. */
  it("matches headers case-insensitively and through common aliases", () => {
    const out = parseEmployeeCsv(
      "Full Name,Work Email,Dept,Job Title\nPriya Nair,PRIYA@acme.test,Engineering,Backend Engineer\n",
    );
    expect(out.rows).toEqual([
      {
        name: "Priya Nair",
        email: "priya@acme.test",
        department: "Engineering",
        title: "Backend Engineer",
      },
    ]);
  });

  /** Column order is an exporter's choice, so columns resolve by header and never by position. */
  it("does not depend on column order", () => {
    const out = parseEmployeeCsv("email,name\nsam@acme.test,Sam Okoro\n");
    expect(out.rows).toEqual([{ name: "Sam Okoro", email: "sam@acme.test" }]);
  });

  /** Refusing a file because it carries a salary column would send someone back to Excel. */
  it("ignores columns it doesn't know instead of rejecting the file", () => {
    const out = parseEmployeeCsv(
      "name,email,salary,manager\nPriya Nair,priya@acme.test,90000,Ada\n",
    );
    expect(out.fatal).toBeUndefined();
    expect(out.rows).toEqual([{ name: "Priya Nair", email: "priya@acme.test" }]);
  });

  /**
   * The specific diagnosis that matters most. Without it the first data line is read as the header
   * and every row fails against nonsense column names — a wall of errors whose real cause is one
   * missing line.
   */
  it("names a missing header row rather than failing every data row", () => {
    const out = parseEmployeeCsv("Priya Nair,priya@acme.test\nSam Okoro,sam@acme.test\n");
    expect(out.fatal).toMatch(/header row/i);
    expect(out.rows).toEqual([]);
  });

  it("says which required column is missing", () => {
    expect(parseEmployeeCsv("name,department\nPriya,Eng\n").fatal).toMatch(/email/);
    expect(parseEmployeeCsv("email,department\np@acme.test,Eng\n").fatal).toMatch(/name/);
  });

  /** Row numbers are what makes an error actionable — they must match the spreadsheet. */
  it("reports 1-based line numbers that count the header", () => {
    const out = parseEmployeeCsv(
      "name,email\nPriya Nair,priya@acme.test\nSam Okoro,not-an-email\n,nobody@acme.test\n",
    );
    expect(out.rows).toHaveLength(1);
    expect(out.errors).toEqual([
      { line: 3, reason: "Invalid email: not-an-email" },
      { line: 4, reason: "No name" },
    ]);
  });

  it("folds duplicate addresses case-insensitively and counts them", () => {
    const out = parseEmployeeCsv(
      "name,email\nPriya Nair,priya@acme.test\nPriya N,PRIYA@acme.test\nSam,sam@acme.test\n",
    );
    expect(out.rows.map((r) => r.email)).toEqual(["priya@acme.test", "sam@acme.test"]);
    expect(out.duplicates).toBe(1);
  });

  /** A spreadsheet export routinely ends with blank lines; they are not errors. */
  it("skips blank lines without reporting them", () => {
    const out = parseEmployeeCsv("name,email\nPriya Nair,priya@acme.test\n\n\n");
    expect(out.rows).toHaveLength(1);
    expect(out.errors).toEqual([]);
  });

  it("blank optional cells are omitted, never sent as empty strings", () => {
    const out = parseEmployeeCsv("name,email,department,team,title\nPriya,p@acme.test,,,  \n");
    expect(out.rows[0]).toEqual({ name: "Priya", email: "p@acme.test" });
  });

  it("treats an empty file and a header-only file as fatal, with different sentences", () => {
    expect(parseEmployeeCsv("").fatal).toMatch(/empty/i);
    expect(parseEmployeeCsv("   \n").fatal).toMatch(/empty/i);
    expect(parseEmployeeCsv("name,email\n").fatal).toMatch(/no rows/i);
  });
});
