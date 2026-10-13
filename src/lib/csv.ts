import Papa from "papaparse";

/**
 * Byte-order mark, so Excel opens a download as UTF-8. Without it every em dash placeholder, `−`
 * sign and accented name came out as mojibake (QA audit 2026-10-08, WP-285).
 */
export const CSV_BOM = "﻿";

/**
 * CSV text, **formula-escaped**: any cell beginning with `=`, `+`, `-`, `@`, a tab or a carriage
 * return gets a leading `'`, so text a person typed — a name of `=HYPERLINK(…)`, a job title — is
 * shown as text instead of being evaluated when an admin opens the export in a spreadsheet
 * (CSV injection, QA audit 2026-10-08, WP-224 / WP-284). No BOM: for joining several bodies.
 */
export function csvBody(input: Papa.UnparseObject<unknown> | unknown[][] | object[]): string {
  return Papa.unparse(input as unknown[][], { escapeFormulae: true });
}

/** A whole CSV file: BOM + formula-escaped body. What every download should use. */
export function toCsv(input: Papa.UnparseObject<unknown> | unknown[][] | object[]): string {
  return CSV_BOM + csvBody(input);
}
