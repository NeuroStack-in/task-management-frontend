import { describe, expect, it } from "vitest";
import { CSV_BOM, toCsv } from "./csv";

/** WP-224 / WP-284 / WP-285 (QA audit 2026-10-08). */
describe("toCsv", () => {
  it("escapes cells a spreadsheet would evaluate", () => {
    const csv = toCsv({ fields: ["name"], data: [["=HYPERLINK(\"http://x\")"], ["@SUM(A1)"], ["Ada"]] });
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'@SUM");
    expect(csv).toContain("Ada");
  });

  it("starts with a BOM so Excel reads UTF-8", () => {
    expect(toCsv([["—"]]).startsWith(CSV_BOM)).toBe(true);
  });
});
