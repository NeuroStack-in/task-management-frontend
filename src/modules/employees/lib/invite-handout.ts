/**
 * The handout: an `.xlsx` of the invites a run just created, with each person's code and join link.
 *
 * ## Why this exists, and why it downloads without being asked
 *
 * `token` and `otp` come back from `POST /v1/employees/invites` **exactly once**. The server keeps
 * only their hashes and cannot reproduce either — not for support, not for the admin who created
 * them, not ever. So the few seconds after a bulk run are the only moment these values exist
 * anywhere outside the recipient's email, and a button someone might not press is the wrong way to
 * hold something unrecoverable. The file is produced automatically when a run succeeds.
 *
 * It also decouples onboarding from email entirely. Five hundred invites is five hundred emails
 * against a provider quota, and if any bounce the codes are gone with them. With this file an admin
 * can hand the code out over chat, in person, or on paper, and email becomes a convenience rather
 * than the only channel.
 *
 * ## Treat the file as credentials
 *
 * Every row is a working way into the organization as that person, until it is used or expires. That
 * is stated on the sheet itself rather than left for someone to infer from a column called "code" —
 * the file will be forwarded, and the warning has to travel with it.
 */
import type { ApiInviteCreated } from "../services/employees.service";

/** One created invite, plus the name we knew for them from the imported file. */
export interface HandoutRow {
  invite: ApiInviteCreated;
  /** From the file's name column; absent for a pasted list, which carries addresses only. */
  name?: string;
}

/**
 * The link the invitee opens. Mirrors `notifications::consumers` exactly — if the two ever disagree,
 * the emailed link and the handed-out link stop being the same invite.
 */
export function joinLink(base: string, tenantId: string, invite: ApiInviteCreated): string {
  const q = new URLSearchParams({
    tenant_id: tenantId,
    invite_id: invite.invite_id,
    token: invite.token,
  });
  return `${base.replace(/\/$/, "")}/invite/accept?${q.toString()}`;
}

/**
 * Columns, in the order they appear. `Name` is **conditional** — see [`handoutTable`].
 *
 * Widths are paired with the headers here rather than listed separately at the call site, because the
 * two must drop the same entry when Name is absent; keeping them apart is how a sheet ends up with
 * its columns one place out.
 */
const COLUMNS: readonly { header: string; width: number }[] = [
  { header: "Employee ID", width: 16 },
  { header: "Name", width: 24 },
  { header: "Email", width: 32 },
  { header: "Invite code", width: 16 },
  { header: "Join link", width: 72 },
  { header: "Expires", width: 22 },
];

/** Index of the conditional column, so the header and the row build stay in step. */
const NAME_COLUMN = 1;

/** `expires_at` is epoch **seconds** on this DTO, unlike most timestamps in the app. */
function expiryText(epochSeconds: number): string {
  if (!epochSeconds) return "";
  return new Date(epochSeconds * 1000).toLocaleString();
}

/**
 * Headers and rows together — pure, so the shape is unit-testable without touching a workbook.
 *
 * **`withName` decides whether the `Name` column exists at all.** The caller passes it from which
 * input was used, not from whether names happen to be present: an import has a name column, a paste
 * does not. Deciding per-batch from the data instead would mean a file whose name cells were all
 * blank produced a differently-shaped sheet from the same button — two files to reconcile where an
 * admin expected one.
 *
 * Headers and rows are returned from one function so they cannot disagree: build them separately and
 * the day Name is dropped from one and not the other, every value after it reads under the wrong
 * heading — a code in the email column is the kind of mistake nobody spots until it has been sent.
 */
export function handoutTable(
  rows: HandoutRow[],
  base: string,
  tenantId: string,
  { withName }: { withName: boolean },
): { headers: string[]; rows: string[][] } {
  const keep = <T,>(cells: T[]): T[] =>
    withName ? cells : cells.filter((_, i) => i !== NAME_COLUMN);

  return {
    headers: keep(COLUMNS.map((c) => c.header)),
    rows: rows.map(({ invite, name }) =>
      keep([
        invite.emp_id ?? "",
        name ?? "",
        invite.email,
        invite.otp,
        joinLink(base, tenantId, invite),
        expiryText(invite.expires_at),
      ]),
    ),
  };
}

/** Column widths matching whatever [`handoutTable`] decided to include. */
function widthsFor(headers: string[]): { width: number }[] {
  return headers.map((h) => ({
    width: COLUMNS.find((c) => c.header === h)?.width ?? 20,
  }));
}

/**
 * Build and download the workbook. Resolves once the browser has the file.
 *
 * The writer is imported on demand — the same one the import template uses — so this costs nothing
 * to anyone who never runs a bulk invite.
 */
export async function downloadInviteHandout(
  rows: HandoutRow[],
  base: string,
  tenantId: string,
  opts: { withName: boolean },
): Promise<void> {
  if (rows.length === 0) return;
  const writeXlsxFile = (await import("write-excel-file/browser")).default;

  // A warning line above the header, not a separate "read me" sheet: this file gets forwarded, and a
  // caution on a tab nobody opens protects nobody. It sits in row 1 so it is the first thing read.
  const table = handoutTable(rows, base, tenantId, opts);

  const notice = [
    {
      value:
        "Each row below is a working invite — anyone with the code and link can join as that person until it is used or expires. Share it the way you would a password.",
      fontWeight: "bold" as const,
      wrap: true,
      span: table.headers.length,
    },
  ];
  const header = table.headers.map((value) => ({ value, fontWeight: "bold" as const }));
  const body = table.rows.map((row) => row.map((value) => ({ value })));

  const stamp = new Date().toISOString().slice(0, 10);
  await writeXlsxFile([notice, header, ...body], {
    columns: widthsFor(table.headers),
  }).toFile(`workpulse-invites-${stamp}.xlsx`);
}
