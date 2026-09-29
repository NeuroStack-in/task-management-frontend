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

/** Columns, in the order they appear. */
const COLUMNS = [
  "Employee ID",
  "Name",
  "Email",
  "Invite code",
  "Join link",
  "Expires",
] as const;

/** `expires_at` is epoch **seconds** on this DTO, unlike most timestamps in the app. */
function expiryText(epochSeconds: number): string {
  if (!epochSeconds) return "";
  return new Date(epochSeconds * 1000).toLocaleString();
}

/** The rows as plain values — pure, so the shape is unit-testable without touching a workbook. */
export function handoutRows(
  rows: HandoutRow[],
  base: string,
  tenantId: string,
): string[][] {
  return rows.map(({ invite, name }) => [
    invite.emp_id ?? "",
    name ?? "",
    invite.email,
    invite.otp,
    joinLink(base, tenantId, invite),
    expiryText(invite.expires_at),
  ]);
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
): Promise<void> {
  if (rows.length === 0) return;
  const writeXlsxFile = (await import("write-excel-file/browser")).default;

  // A warning line above the header, not a separate "read me" sheet: this file gets forwarded, and a
  // caution on a tab nobody opens protects nobody. It sits in row 1 so it is the first thing read.
  const notice = [
    {
      value:
        "Each row below is a working invite — anyone with the code and link can join as that person until it is used or expires. Share it the way you would a password.",
      fontWeight: "bold" as const,
      wrap: true,
      span: COLUMNS.length,
    },
  ];
  const header = COLUMNS.map((value) => ({ value, fontWeight: "bold" as const }));
  const body = handoutRows(rows, base, tenantId).map((row) =>
    row.map((value) => ({ value })),
  );

  const stamp = new Date().toISOString().slice(0, 10);
  await writeXlsxFile([notice, header, ...body], {
    columns: [{ width: 16 }, { width: 24 }, { width: 32 }, { width: 16 }, { width: 72 }, { width: 22 }],
  }).toFile(`workpulse-invites-${stamp}.xlsx`);
}
