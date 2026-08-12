import Papa from "papaparse";
import { isEmail } from "@/lib/validation";

/**
 * Turn an uploaded CSV into monitored-employee rows (`POST /v1/employees`, MANAGED-AGENT.md §6.4).
 *
 * The sibling of `parse-emails.ts`, and it exists for the same reason: onboarding 200 people who
 * will never log in, one dialog at a time, is not a product. The difference is the input — a bulk
 * invite is a *paste*, this is a *file exported from an HR system* — so the tolerances are different:
 *
 * - **headers vary by exporter.** `Name` / `Full Name` / `Employee Name` all mean the same column,
 *   as do `Email` / `Work Email` / `Email Address`. Matching is case- and space-insensitive.
 * - **column order varies**, so columns are resolved by header, never by position.
 * - **the file may carry columns we don't want** (salary, manager, start date). Unknown headers are
 *   ignored rather than rejected — refusing a file because it has an extra column would send people
 *   back to Excel to delete it.
 * - **a header row may be missing entirely.** That is reported as a specific error, because the
 *   symptom otherwise is "row 1 has an invalid email" pointing at the word `email`.
 *
 * Row numbers are **1-based and count the header**, so they match what the spreadsheet shows — the
 * whole point of reporting a row number is that someone can go and look at it.
 */

/** One parsed row, shaped for the API body. */
export interface CsvEmployeeRow {
  name: string;
  email: string;
  department?: string;
  team?: string;
  title?: string;
}

/** A row that could not be used, with the line to look at. */
export interface CsvRowError {
  /** 1-based line in the file, header included. */
  line: number;
  reason: string;
}

export interface ParsedEmployeeCsv {
  rows: CsvEmployeeRow[];
  errors: CsvRowError[];
  /** How many duplicate addresses were folded away, for an honest "50 rows, 48 people". */
  duplicates: number;
  /** Set when the file is unusable as a whole (no header, no rows, not a CSV at all). */
  fatal?: string;
}

/**
 * Header aliases, normalised (lowercased, non-alphanumerics stripped). Order within a list does not
 * matter; the first header in the file that maps to a field wins.
 */
const HEADER_ALIASES: Record<keyof CsvEmployeeRow, readonly string[]> = {
  name: ["name", "fullname", "employeename", "displayname", "person"],
  email: ["email", "emailaddress", "workemail", "officialemail", "mail"],
  department: ["department", "dept", "departmentid", "departmentname"],
  team: ["team", "teamid", "teamname"],
  title: ["title", "jobtitle", "designation", "role", "position"],
};

/** `"  Work Email "` → `"workemail"`. */
function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Map each field to the header string that carries it, or `undefined` if the file lacks it. */
function resolveColumns(headers: string[]): Partial<Record<keyof CsvEmployeeRow, string>> {
  const found: Partial<Record<keyof CsvEmployeeRow, string>> = {};
  for (const header of headers) {
    const key = normalizeHeader(header);
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
      keyof CsvEmployeeRow,
      readonly string[],
    ][]) {
      if (found[field] === undefined && aliases.includes(key)) {
        found[field] = header;
      }
    }
  }
  return found;
}

const cell = (row: Record<string, string>, header?: string): string =>
  header ? (row[header] ?? "").trim() : "";

export function parseEmployeeCsv(text: string): ParsedEmployeeCsv {
  const empty: ParsedEmployeeCsv = { rows: [], errors: [], duplicates: 0 };

  if (!text.trim()) {
    return { ...empty, fatal: "That file is empty." };
  }

  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });

  const headers = parsed.meta.fields ?? [];
  const columns = resolveColumns(headers);

  // Diagnose a missing header row specifically. Without this the first data line is read as the
  // header and every subsequent row fails validation against nonsense column names — a confusing
  // wall of errors whose actual cause is one missing line.
  if (!columns.name || !columns.email) {
    const missing = [!columns.name && "name", !columns.email && "email"]
      .filter(Boolean)
      .join(" and ");
    return {
      ...empty,
      fatal:
        `The file needs a header row with ${missing} column${missing.includes(" and ") ? "s" : ""}. ` +
        `Found: ${headers.length ? headers.join(", ") : "no columns"}.`,
    };
  }

  const rows: CsvEmployeeRow[] = [];
  const errors: CsvRowError[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  parsed.data.forEach((raw, i) => {
    // +2: one for the header line, one because spreadsheet rows are 1-based.
    const line = i + 2;
    const name = cell(raw, columns.name);
    const email = cell(raw, columns.email).toLowerCase();

    if (!name && !email) return; // a blank line the parser kept — silently skip

    if (!name) {
      errors.push({ line, reason: "No name" });
      return;
    }
    if (!isEmail(email)) {
      errors.push({ line, reason: email ? `Invalid email: ${email}` : "No email" });
      return;
    }
    if (seen.has(email)) {
      duplicates++;
      return;
    }
    seen.add(email);

    const row: CsvEmployeeRow = { name, email };
    const department = cell(raw, columns.department);
    const team = cell(raw, columns.team);
    const title = cell(raw, columns.title);
    if (department) row.department = department;
    if (team) row.team = team;
    if (title) row.title = title;
    rows.push(row);
  });

  if (rows.length === 0 && errors.length === 0) {
    return { ...empty, fatal: "That file has a header but no rows." };
  }

  return { rows, errors, duplicates };
}

/** A ready-to-download template, so nobody has to guess the column names. */
export const CSV_TEMPLATE =
  "name,email,department,team,title\n" +
  "Priya Nair,priya.nair@example.com,Engineering,Platform,Backend Engineer\n" +
  "Sam Okoro,sam.okoro@example.com,Support,,Support Specialist\n";
