import Papa from "papaparse";

/**
 * Reading a header'd table out of a file an admin exported from somewhere else.
 *
 * Two importers need this — monitored employees (`parse-employee-csv`) and invites
 * (`parse-invite-file`) — and they must agree on what counts as a column, or the same spreadsheet
 * would import in one dialog and fail in the other. So header matching lives here once.
 *
 * **CSV and XLSX arrive by different routes but leave as the same shape**: a header list plus rows
 * keyed by the header text exactly as the file spells it. Everything downstream then works on one
 * representation and never asks which format it came from.
 */

/** `"  Work Email "` → `"workemail"`. Case and punctuation are noise; only the letters mean anything. */
export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Map each field to the header string that carries it, or leave it out when the file lacks it.
 *
 * Resolved by header text, never by position, because exporters order columns however they like.
 * The first header that maps to a field wins, so a file with both `Email` and `Work Email` picks one
 * and ignores the other rather than silently preferring the rightmost.
 */
export function resolveColumns<F extends string>(
  headers: string[],
  aliases: Record<F, readonly string[]>,
): Partial<Record<F, string>> {
  const found: Partial<Record<F, string>> = {};
  for (const header of headers) {
    const key = normalizeHeader(header);
    for (const [field, list] of Object.entries(aliases) as [F, readonly string[]][]) {
      if (found[field] === undefined && list.includes(key)) {
        found[field] = header;
      }
    }
  }
  return found;
}

/** Read one cell as trimmed text; absent column or absent value both read as `""`. */
export const cell = (row: Record<string, string>, header?: string): string =>
  header ? (row[header] ?? "").trim() : "";

/** A file read into headers + rows, before any field-specific validation. */
export interface SheetData {
  headers: string[];
  rows: Record<string, string>[];
}

/** True for a file we should read with the XLSX reader rather than the CSV one. */
export function isExcelFile(file: File): boolean {
  return /\.xlsx?$/i.test(file.name) || /spreadsheetml|ms-excel/.test(file.type);
}

/**
 * Read a `.csv` or `.xlsx` file into headers + rows.
 *
 * The XLSX half is deliberately **not** SheetJS: the only build of `xlsx` published to npm (0.18.5)
 * carries two high-severity advisories — prototype pollution and a ReDoS — and the fixed builds are
 * distributed off-registry. This runs in the browser on a file someone was handed, which is exactly
 * the threat model those advisories describe, so it uses `read-excel-file` instead.
 *
 * Every cell is coerced to a string here. A spreadsheet will hand back numbers, `Date`s and booleans
 * depending on how a cell was formatted — an employee id typed as `00421` comes back as the number
 * 421 — and downstream code that expects text would otherwise break on one oddly-formatted column.
 */
export async function readSheet(file: File): Promise<SheetData> {
  if (isExcelFile(file)) return readXlsx(file);
  return readCsv(await fileText(file));
}

/**
 * A file's text, without assuming `Blob.text()`.
 *
 * It is absent in jsdom and in older Safari, and the failure is silent in the worst way: the read
 * rejects, the caller says "that file couldn't be read", and the file is perfectly fine.
 *
 * The fallback is `FileReader` rather than `new Response(file).text()` — the latter looks tidier and
 * is wrong here, because where `Blob.text` is missing the `Response` body is usually unsupported too
 * and the file gets stringified to `"[object File]"`, which then parses as a one-column header and
 * reports a *header* problem for a file whose header was fine.
 */
async function fileText(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return read(file, (reader) => reader.readAsText(file)) as Promise<string>;
}

/** A file's bytes, without assuming `Blob.arrayBuffer()`. Same reasoning as [`fileText`]. */
async function fileBuffer(file: File): Promise<ArrayBuffer> {
  if (typeof file.arrayBuffer === "function") return file.arrayBuffer();
  return read(file, (reader) => reader.readAsArrayBuffer(file)) as Promise<ArrayBuffer>;
}

/** The `FileReader` promise wrapper both fallbacks share. */
function read(file: File, start: (reader: FileReader) => void): Promise<string | ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result ?? "");
    reader.onerror = () => reject(reader.error ?? new Error("file read failed"));
    start(reader);
  });
}

async function readXlsx(file: File): Promise<SheetData> {
  // The `/browser` entry specifically: the package publishes no root export, and the `/node` one
  // expects a stream. Imported lazily so the reader only costs its weight to someone who actually
  // opens a spreadsheet — a CSV import, and every other page, never loads it.
  //
  // `readSheet`, not the default export: since v9 the default reads and returns *every* sheet in the
  // workbook, and an import only ever looks at the first. Reading one sheet skips parsing the rest.
  const { readSheet: readFirstSheet } = await import("read-excel-file/browser");
  // Hand it an ArrayBuffer rather than the File. The reader accepts either, but reading the bytes
  // out of the File itself relies on `Blob.arrayBuffer`/`Blob.stream`, which is the same gap as
  // `Blob.text` — absent in jsdom, and historically in Safari. Reading them here keeps one code
  // path that works everywhere, and makes the importer testable against a real generated workbook.
  const matrix = await readFirstSheet(await fileBuffer(file));
  if (matrix.length === 0) return { headers: [], rows: [] };

  const headers = (matrix[0] ?? []).map((h) => text(h).trim());
  const rows = matrix.slice(1).map((line) => {
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      if (header) row[header] = text(line[i]);
    });
    return row;
  });
  // Drop rows that are entirely blank: a spreadsheet's "used range" often runs past the last real
  // row, and reporting fifty empty lines as errors would bury the one row that is genuinely wrong.
  return { headers, rows: rows.filter((r) => Object.values(r).some((v) => v.trim() !== "")) };
}

function readCsv(content: string): SheetData {
  const parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  return { headers: parsed.meta.fields ?? [], rows: parsed.data };
}

/** One cell → text. `Date` is rendered as an ISO date so it round-trips predictably. */
function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}
