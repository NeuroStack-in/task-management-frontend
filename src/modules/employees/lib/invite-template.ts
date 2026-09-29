import { downloadBlob } from "@/lib/download";

/**
 * The file an admin downloads, fills in, and uploads back.
 *
 * One definition drives both formats, so the `.csv` and the `.xlsx` can never disagree about which
 * columns exist or how they are spelled — a template that doesn't match the importer is worse than
 * no template, because it fails *after* someone has typed two hundred rows into it.
 *
 * The example rows are kept, because a header-only file leaves people guessing what a "role" is
 * meant to look like. They are safe to keep because the importer **refuses** the reserved
 * `example.com` addresses they use (see `parse-invite-file`): filling in underneath the examples and
 * uploading — the single most likely way to use a template — cannot invite the samples by accident.
 */

/** Columns, in the order they appear in the file. `email` first because it is the only required one. */
export const INVITE_TEMPLATE_COLUMNS = ["email", "role", "department", "team", "title"] as const;

/**
 * Sample rows. The addresses are deliberately `@example.com` — reserved by RFC 2606 precisely so
 * they can never reach a real mailbox, and the marker the importer uses to reject them.
 */
export const INVITE_TEMPLATE_EXAMPLES: readonly string[][] = [
  ["priya.nair@example.com", "Employee", "Engineering", "Platform", "Backend Engineer"],
  ["sam.okoro@example.com", "Manager", "Support", "", "Support Lead"],
];

/** The CSV form. Plain text, so it is built here rather than through a library. */
export const INVITE_CSV_TEMPLATE =
  [INVITE_TEMPLATE_COLUMNS.join(","), ...INVITE_TEMPLATE_EXAMPLES.map((r) => r.join(","))].join(
    "\n",
  ) + "\n";

export function downloadInviteCsvTemplate() {
  downloadBlob(
    new Blob([INVITE_CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" }),
    "invite-template.csv",
  );
}

/**
 * The `.xlsx` form — a real workbook, not a CSV with a different extension.
 *
 * Worth the dependency because of what Excel does to a `.csv`: opening one and pressing save keeps
 * it as CSV behind a "some features may be lost" dialog, and an address column can be mangled by
 * autoformatting on the way. Handing back a genuine workbook means the round trip is Excel → Excel.
 *
 * The writer is imported on demand, so this costs nothing to anyone who never clicks the button.
 */
export async function downloadInviteXlsxTemplate(): Promise<void> {
  // `/browser` specifically — like its reader sibling, this package publishes no root export, and
  // the `/node` build writes to a stream rather than triggering a download.
  const writeXlsxFile = (await import("write-excel-file/browser")).default;
  const header = INVITE_TEMPLATE_COLUMNS.map((c) => ({ value: c, fontWeight: "bold" as const }));
  const rows = INVITE_TEMPLATE_EXAMPLES.map((row) => row.map((value) => ({ value })));
  // The browser build hands back `{ toBlob, toFile }` rather than writing anywhere itself; `toFile`
  // is what actually triggers the download.
  await writeXlsxFile([header, ...rows], {
    // Wide enough that an email address is readable without dragging the column out first.
    columns: [{ width: 32 }, { width: 16 }, { width: 20 }, { width: 16 }, { width: 24 }],
  }).toFile("invite-template.xlsx");
}
