import { isEmail } from "@/lib/validation";
import { cell, readSheet, resolveColumns } from "./spreadsheet";

/**
 * Turn an uploaded `.csv` or `.xlsx` into invite rows (`POST /v1/employees/invites`).
 *
 * The third importer in this module, and the one that carries the most per-row information. Its
 * siblings are worth knowing apart:
 *
 * - `parse-emails` — a **paste** of addresses. One role/department/title, chosen in the dialog,
 *   applies to everyone. Right for "invite these eight interns".
 * - `parse-employee-csv` — a **file** of people who never log in (`POST /v1/employees`). No invite,
 *   no email, no account.
 * - this — a **file** of people who do log in, each with **their own** role, department and title.
 *   Right for an HR export where the whole point is that the rows differ.
 *
 * ## Why a row may leave fields blank
 * Every field except the address is optional *here* even though the API requires role, department
 * and title, because the dialog supplies its picks as the default for any row that omits one. That
 * makes a one-column file of addresses a valid import, and it makes a file that specifies a title
 * for only some people behave the way the person who made it expects. Resolution of those defaults,
 * and of a name like "Engineering" into a department id, belongs to the dialog that holds the org
 * lists — this parser deals only in what the file literally said.
 *
 * ## `name` is kept, but never sent
 * Real HR exports lead with a name column, and an importer that rejected the file for containing one
 * would send people back to the spreadsheet to delete it. An invite still has no name — the invitee
 * types their own at signup, and `CreateInviteRequest` has no field for it — so nothing here reaches
 * the server. It is carried only to label each person in the handout file the import produces: a
 * list of 500 codes against bare addresses is far harder to distribute than one with names on it.
 *
 * Row numbers are **1-based and count the header**, matching what the spreadsheet shows — the whole
 * point of a row number is that someone can go and look at that row.
 */

/** One parsed row. Values are as written in the file — names, not ids. */
export interface InviteFileRow {
  email: string;
  /** Role name as written, e.g. "Manager". Resolved to an id by the caller. */
  role?: string;
  department?: string;
  team?: string;
  title?: string;
  /**
   * The person's name, kept **only** to label them in the handout file the import produces.
   *
   * It is deliberately not sent to the server: `CreateInviteRequest` has no name field, and the
   * invitee types their own at signup. But an export listing 500 codes against bare email addresses
   * is far harder to hand out than one that names each person, so the column is carried this far
   * and no further.
   */
  name?: string;
}

/** A row that could not be used, with the line to look at. */
export interface InviteRowError {
  /** 1-based line in the file, header included. */
  line: number;
  reason: string;
}

export interface ParsedInviteFile {
  rows: InviteFileRow[];
  errors: InviteRowError[];
  /** Duplicate addresses folded away, for an honest "50 rows, 48 people". */
  duplicates: number;
  /** Set when the file is unusable as a whole (no header, no rows, not a table at all). */
  fatal?: string;
}

/**
 * Header aliases, normalised. `role` deliberately does **not** accept "position"/"designation" —
 * those mean job title to most people, and `parse-employee-csv` already maps them to `title`. A file
 * whose "Designation" column landed in the *permission* role would hand out access nobody intended.
 */
const HEADER_ALIASES = {
  email: ["email", "emailaddress", "workemail", "officialemail", "mail"],
  role: ["role", "accessrole", "permissionrole", "rolename", "userrole"],
  department: ["department", "dept", "departmentname"],
  team: ["team", "teamname"],
  title: ["title", "jobtitle", "designation", "position"],
  name: ["name", "fullname", "employeename", "displayname", "person"],
} as const;

type Field = keyof typeof HEADER_ALIASES;

/**
 * Domains RFC 2606 reserves for documentation. They can never receive mail, so an invite to one is
 * always a mistake — and in practice it is one specific mistake: the template's own sample rows,
 * left in place while real people were typed underneath them. Rejecting them by name turns the most
 * likely way to misuse a template into a message that says exactly what to do.
 *
 * Only the three reserved *second-level* domains. The `.test` TLD is reserved too, but this app uses
 * `acme.test` for its own demo data and placeholders, so refusing it would reject addresses the
 * product itself suggests.
 */
const SAMPLE_DOMAINS = ["example.com", "example.net", "example.org"];

function isSampleAddress(email: string): boolean {
  const domain = email.split("@")[1] ?? "";
  return SAMPLE_DOMAINS.includes(domain);
}

export async function parseInviteFile(file: File): Promise<ParsedInviteFile> {
  const empty: ParsedInviteFile = { rows: [], errors: [], duplicates: 0 };

  let sheet;
  try {
    sheet = await readSheet(file);
  } catch {
    // A corrupt workbook, a `.xlsx` that is really something else, a password-protected file.
    return { ...empty, fatal: "That file couldn't be read. Save it as .csv or .xlsx and try again." };
  }

  const columns = resolveColumns<Field>(sheet.headers, HEADER_ALIASES);

  // Diagnose a missing header row specifically. Without this the first data line is read as the
  // header, and every row after it fails against nonsense column names — a wall of errors whose
  // actual cause is one absent line.
  if (!columns.email) {
    return {
      ...empty,
      fatal:
        "The file needs a header row with an email column. Found: " +
        (sheet.headers.length ? sheet.headers.join(", ") : "no columns") +
        ".",
    };
  }

  const rows: InviteFileRow[] = [];
  const errors: InviteRowError[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  sheet.rows.forEach((raw, i) => {
    // +2: one for the header line, one because spreadsheet rows are 1-based.
    const line = i + 2;
    const email = cell(raw, columns.email).toLowerCase();

    // A line with no address and nothing else in it is padding, not a mistake.
    const hasAnythingElse = (["role", "department", "team", "title", "name"] as const).some((f) =>
      cell(raw, columns[f]),
    );
    if (!email && !hasAnythingElse) return;

    if (!isEmail(email)) {
      errors.push({ line, reason: email ? `Invalid email: ${email}` : "No email" });
      return;
    }
    if (isSampleAddress(email)) {
      errors.push({ line, reason: "Example row from the template — delete it before importing" });
      return;
    }
    if (seen.has(email)) {
      duplicates++;
      return;
    }
    seen.add(email);

    const row: InviteFileRow = { email };
    const role = cell(raw, columns.role);
    const department = cell(raw, columns.department);
    const team = cell(raw, columns.team);
    const title = cell(raw, columns.title);
    const name = cell(raw, columns.name);
    if (role) row.role = role;
    if (department) row.department = department;
    if (team) row.team = team;
    if (title) row.title = title;
    if (name) row.name = name;
    rows.push(row);
  });

  if (rows.length === 0 && errors.length === 0) {
    return { ...empty, fatal: "That file has a header but no rows." };
  }

  return { rows, errors, duplicates };
}

/**
 * Match a name from the file to one of the org's records, case- and space-insensitively.
 *
 * Exact-ish or nothing: no fuzzy matching, no "did you mean". Guessing that "Eng" meant
 * "Engineering" would file someone in a department the file never named, and the cost of being
 * wrong — a person with the wrong access, discovered weeks later — is far higher than the cost of
 * telling the admin to fix a cell.
 */
export function matchByName<T extends { id: string; name: string }>(
  value: string | undefined,
  options: T[],
): T | undefined {
  if (!value) return undefined;
  const wanted = value.trim().toLowerCase();
  return options.find((o) => o.name.trim().toLowerCase() === wanted);
}

