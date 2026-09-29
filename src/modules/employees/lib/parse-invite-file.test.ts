import { describe, expect, it, vi } from "vitest";

import { matchByName, parseInviteFile, type ParsedInviteFile } from "./parse-invite-file";
import { INVITE_CSV_TEMPLATE, INVITE_TEMPLATE_COLUMNS } from "./invite-template";

/** A `File` the parser will route to the CSV reader. */
function csvFile(content: string, name = "invites.csv"): File {
  return new File([content], name, { type: "text/csv" });
}

/**
 * An `.xlsx` is a zip, which is impractical to hand-build here — and the point of these tests is the
 * parsing rules, not the XLSX byte format (that is the library's job). So the reader is stubbed and
 * the tests assert what we do with the rows it returns.
 */
function stubXlsx(matrix: unknown[][]) {
  vi.doMock("read-excel-file/browser", () => ({
    readSheet: vi.fn().mockResolvedValue(matrix),
  }));
}

describe("parseInviteFile", () => {
  /**
   * The template's headers must be the ones the importer resolves. A template that doesn't match
   * the parser fails only after someone has typed two hundred rows into it.
   */
  it("resolves every column the template ships with", async () => {
    const filled = INVITE_CSV_TEMPLATE.split("\n")[0] + "\na@acme.test,Employee,Eng,Core,Dev\n";
    const out = await parseInviteFile(csvFile(filled));
    expect(out.fatal).toBeUndefined();
    expect(out.rows).toEqual([
      { email: "a@acme.test", role: "Employee", department: "Eng", team: "Core", title: "Dev" },
    ]);
    expect(INVITE_TEMPLATE_COLUMNS).toEqual(["email", "role", "department", "team", "title"]);
  });

  /**
   * Filling in underneath the samples and uploading is the most likely way to use a template, and
   * it must not invite the samples. `example.com` is reserved by RFC 2606 and can never receive
   * mail, so an invite to one is always a mistake worth naming.
   */
  it("refuses the template's own example rows instead of inviting them", async () => {
    const out = await parseInviteFile(csvFile(INVITE_CSV_TEMPLATE + "real@acme.test,,,,\n"));
    expect(out.rows.map((r) => r.email)).toEqual(["real@acme.test"]);
    expect(out.errors).toEqual([
      { line: 2, reason: "Example row from the template — delete it before importing" },
      { line: 3, reason: "Example row from the template — delete it before importing" },
    ]);
  });

  /** `.test` is reserved too, but the product uses `acme.test` in its own placeholders. */
  it("still accepts the acme.test addresses the app itself suggests", async () => {
    const out = await parseInviteFile(csvFile("email\njordan@acme.test\n"));
    expect(out.rows).toEqual([{ email: "jordan@acme.test" }]);
    expect(out.errors).toEqual([]);
  });

  it("accepts a file of nothing but addresses — the dialog supplies the rest", async () => {
    const out = await parseInviteFile(csvFile("email\na@acme.test\nb@acme.test\n"));
    expect(out.fatal).toBeUndefined();
    expect(out.rows).toEqual([{ email: "a@acme.test" }, { email: "b@acme.test" }]);
  });

  it("matches headers case-insensitively and through aliases, in any column order", async () => {
    const out = await parseInviteFile(
      csvFile("Job Title,Work Email,Access Role\nBackend Engineer,PRIYA@acme.test,Employee\n"),
    );
    expect(out.rows).toEqual([
      { email: "priya@acme.test", role: "Employee", title: "Backend Engineer" },
    ]);
  });

  /**
   * "Designation" means job title to every HR system that emits it. Mapping it to the permission
   * role would grant access nobody asked for, so it must land in `title`.
   */
  it("treats designation as a job title, never as a permission role", async () => {
    const out = await parseInviteFile(csvFile("email,designation\na@acme.test,Support Lead\n"));
    expect(out.rows[0]).toEqual({ email: "a@acme.test", title: "Support Lead" });
    expect(out.rows[0].role).toBeUndefined();
  });

  /** An invite has no name field — the invitee types their own at signup. */
  it("tolerates a name column and drops it", async () => {
    const out = await parseInviteFile(csvFile("name,email\nPriya Nair,priya@acme.test\n"));
    expect(out.rows).toEqual([{ email: "priya@acme.test" }]);
  });

  it("ignores columns it doesn't recognise rather than rejecting the file", async () => {
    const out = await parseInviteFile(
      csvFile("email,salary,start date\na@acme.test,90000,2026-01-05\n"),
    );
    expect(out.fatal).toBeUndefined();
    expect(out.rows).toEqual([{ email: "a@acme.test" }]);
  });

  it("reports bad rows by the line number the spreadsheet shows, and keeps the good ones", async () => {
    const out = await parseInviteFile(
      csvFile("email\ngood@acme.test\nnot-an-email\n\nalso.good@acme.test\n"),
    );
    expect(out.rows.map((r) => r.email)).toEqual(["good@acme.test", "also.good@acme.test"]);
    expect(out.errors).toEqual([{ line: 3, reason: "Invalid email: not-an-email" }]);
  });

  it("folds duplicate addresses case-insensitively and counts them", async () => {
    const out = await parseInviteFile(csvFile("email\nA@acme.test\na@acme.test\nb@acme.test\n"));
    expect(out.rows.map((r) => r.email)).toEqual(["a@acme.test", "b@acme.test"]);
    expect(out.duplicates).toBe(1);
  });

  /** Without this the first data line becomes the header and every row fails against nonsense. */
  it("names a missing header row as the problem, not the rows beneath it", async () => {
    const out = await parseInviteFile(csvFile("priya@acme.test\nsam@acme.test\n"));
    expect(out.fatal).toMatch(/header row with an email column/i);
    expect(out.rows).toEqual([]);
  });

  it("reports an empty file and a header-only file distinctly", async () => {
    expect((await parseInviteFile(csvFile("email\n"))).fatal).toMatch(/no rows/i);
    expect((await parseInviteFile(csvFile(""))).fatal).toBeTruthy();
  });
});

describe("parseInviteFile — .xlsx", () => {
  /** Same rules as CSV; the format must not change the outcome. */
  it("reads an xlsx through the same rules as a csv", async () => {
    vi.resetModules();
    stubXlsx([
      ["Email", "Role", "Department", "Title"],
      ["priya@acme.test", "Employee", "Engineering", "Backend Engineer"],
      ["sam@acme.test", "Manager", "Support", "Support Lead"],
    ]);
    const { parseInviteFile: parse } = await import("./parse-invite-file");
    const out: ParsedInviteFile = await parse(
      new File([new Uint8Array([0x50, 0x4b])], "staff.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    expect(out.fatal).toBeUndefined();
    expect(out.rows).toEqual([
      {
        email: "priya@acme.test",
        role: "Employee",
        department: "Engineering",
        title: "Backend Engineer",
      },
      { email: "sam@acme.test", role: "Manager", department: "Support", title: "Support Lead" },
    ]);
  });

  /**
   * A spreadsheet hands back typed cells, not text. An employee id typed `00421` arrives as the
   * number 421, and a date column as a `Date` — both must survive as strings rather than crash.
   */
  it("coerces numeric and date cells to text instead of failing on them", async () => {
    vi.resetModules();
    stubXlsx([
      ["Email", "Title", "Team"],
      ["a@acme.test", 2026, new Date(Date.UTC(2026, 0, 5))],
    ]);
    const { parseInviteFile: parse } = await import("./parse-invite-file");
    const out = await parse(new File([""], "s.xlsx"));
    expect(out.rows[0]).toEqual({ email: "a@acme.test", title: "2026", team: "2026-01-05" });
  });

  /** A spreadsheet's used range routinely runs past the last real row. */
  it("skips trailing blank rows rather than reporting them as errors", async () => {
    vi.resetModules();
    stubXlsx([["Email"], ["a@acme.test"], [null], ["   "], [null]]);
    const { parseInviteFile: parse } = await import("./parse-invite-file");
    const out = await parse(new File([""], "s.xlsx"));
    expect(out.rows).toEqual([{ email: "a@acme.test" }]);
    expect(out.errors).toEqual([]);
  });

  it("reports an unreadable workbook as a whole-file problem", async () => {
    vi.resetModules();
    vi.doMock("read-excel-file/browser", () => ({
      readSheet: vi.fn().mockRejectedValue(new Error("not a zip")),
    }));
    const { parseInviteFile: parse } = await import("./parse-invite-file");
    const out = await parse(new File([""], "broken.xlsx"));
    expect(out.fatal).toMatch(/couldn't be read/i);
    expect(out.rows).toEqual([]);
  });
});

/**
 * The one test that covers what an admin actually does: download the template, fill it in, upload
 * it. It uses the real writer and the real reader, so a change to either — or to the columns — fails
 * here rather than in someone's hands.
 */
describe("template round trip", () => {
  it("generates an .xlsx the importer reads back", async () => {
    // The stubs above stay in the module registry and would intercept the reader's dynamic import,
    // quietly turning this into a test of the stub. Drop them so the real library is exercised.
    vi.doUnmock("read-excel-file/browser");
    vi.resetModules();
    const { parseInviteFile } = await import("./parse-invite-file");
    const writeXlsxFile = (await import("write-excel-file/browser")).default;
    const blob = await writeXlsxFile(
      [
        INVITE_TEMPLATE_COLUMNS.map((value) => ({ value })),
        [
          { value: "real@acme.test" },
          { value: "Employee" },
          { value: "Engineering" },
          { value: "Platform" },
          { value: "Backend Engineer" },
        ],
      ],
      {},
    ).toBlob();

    const out = await parseInviteFile(
      new File([blob], "invite-template.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );

    expect(out.fatal).toBeUndefined();
    expect(out.errors).toEqual([]);
    expect(out.rows).toEqual([
      {
        email: "real@acme.test",
        role: "Employee",
        department: "Engineering",
        team: "Platform",
        title: "Backend Engineer",
      },
    ]);
  });
});

describe("matchByName", () => {
  const options = [
    { id: "d1", name: "Engineering" },
    { id: "d2", name: "Customer Support" },
  ];

  it("matches ignoring case and surrounding space", () => {
    expect(matchByName("  engineering ", options)?.id).toBe("d1");
    expect(matchByName("Customer Support", options)?.id).toBe("d2");
  });

  /** Guessing would file someone in a department the file never named. */
  it("refuses a near miss rather than guessing", () => {
    expect(matchByName("Eng", options)).toBeUndefined();
    expect(matchByName("Support", options)).toBeUndefined();
  });

  it("is undefined for an absent value, so a blank cell falls through to the picker", () => {
    expect(matchByName(undefined, options)).toBeUndefined();
    expect(matchByName("", options)).toBeUndefined();
  });
});
