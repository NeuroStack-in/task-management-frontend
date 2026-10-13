import { describe, expect, it } from "vitest";
import { isExcelFile } from "./spreadsheet";

const file = (name: string, type: string) => new File(["email\na@b.co"], name, { type });

/**
 * WP-064 (QA audit 2026-10-08): on Windows with Excel installed a `.csv` arrives as
 * `application/vnd.ms-excel`, and the MIME test sent it to the XLSX reader, which rejected it.
 */
describe("isExcelFile", () => {
  it("reads a .csv as CSV whatever MIME type the browser reports", () => {
    expect(isExcelFile(file("invites.csv", "application/vnd.ms-excel"))).toBe(false);
    expect(isExcelFile(file("invites.CSV", "text/csv"))).toBe(false);
    expect(isExcelFile(file("invites.csv", ""))).toBe(false);
  });

  it("reads a workbook as a workbook", () => {
    expect(isExcelFile(file("invites.xlsx", ""))).toBe(true);
    expect(
      isExcelFile(
        file("export", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
      ),
    ).toBe(true);
  });

  it("does not trust the ambiguous ms-excel type for a file with no extension", () => {
    expect(isExcelFile(file("export", "application/vnd.ms-excel"))).toBe(false);
  });
});
