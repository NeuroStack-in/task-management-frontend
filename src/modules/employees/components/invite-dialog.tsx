"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, FileSpreadsheet, FileUp, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { mapWithConcurrency } from "@/lib/concurrency";
import { parseEmails } from "../lib/parse-emails";
import {
  matchByName,
  parseInviteFile,
  type ParsedInviteFile,
} from "../lib/parse-invite-file";
import {
  downloadInviteCsvTemplate,
  downloadInviteXlsxTemplate,
} from "../lib/invite-template";
import { downloadInviteHandout, hasCodes, type HandoutRow } from "../lib/invite-handout";
import { NewDepartmentInline } from "./new-department-inline";
import { useAuthStore } from "@/stores/auth.store";
import { listRoles, type ApiRole } from "@/modules/roles/services/roles.service";
import {
  createInvite,
  listDepartments,
  listTeams,
  type ApiDepartment,
  type ApiTeam,
} from "../services/employees.service";

/**
 * Most addresses one bulk invite may carry. **Raised from 50 to 100 by the owner, 2026-09-29.**
 *
 * Not a technical ceiling — nothing breaks at 101, and the server imposes no limit of its own. It
 * bounds the failure modes a single run can produce: the addresses are sent as one POST each, four
 * in flight, and writes are never retried (`lib/api`), so closing the tab part-way leaves the rest
 * unsent with no record on screen of which.
 *
 * One paste of 100 is therefore still 100 requests — "one invite" from where the admin stands, not
 * from the server's. A hundred of them takes a visible half-minute, which the button counts out
 * (`Inviting 40 of 100…`) so a long run doesn't read as a hung one.
 *
 * The dialog **refuses** above this rather than truncating: silently dropping people from a paste
 * is worse than making someone split it, because nothing on screen would say who was left out.
 */
const MAX_INVITES = 100;

/**
 * Most rows one imported file may carry. **Raised from 200 to 500 by the owner, 2026-09-29.**
 *
 * Higher than the paste ceiling because the inputs differ in kind: fifty pasted addresses is usually
 * a mistake, whereas a several-hundred-row export is the ordinary case — that is the whole reason to
 * import a file rather than paste.
 *
 * It is still bounded, and the reason is worth keeping in view: **the run is not resumable.** Each
 * row is its own POST, and writes are never retried (`lib/api`), so a closed tab or a dropped
 * connection at row 300 leaves the remaining 200 unsent with nothing on screen naming them. The cap
 * bounds how much damage that does; it is not a capacity limit, and nothing below it imposes one —
 * the server has no cap at all.
 *
 * ⚠️ **Email delivery is the lower ceiling now, and it is not enforced here.** Invites are sent
 * through Resend (`notifications::shared::resend`), whose plan carries its own daily quota — 100/day
 * on the free tier, shared by every org. Past it the email can't go out while the invite is still
 * created. Since UX audit PEOPLE-07 that is **recorded on the invite** — the Invited list's Email
 * column says "Not sent — daily email limit" and offers Resend — and the dialog warns before a large
 * emailed batch. Making the run resumable is what would let this number stop mattering.
 */
const LARGE_EMAIL_BATCH = 100;
const MAX_IMPORT_ROWS = 500;

/** How many bytes of spreadsheet to accept. A file much larger than this is not a staff list. */
const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** Sentinel for "no team" — Base UI's Select can't carry `""` as an item value. */
const NO_TEAM = "__none__";

/**
 * Why one invite wasn't created. The server's 409s carry codes whose message text is only
 * "Conflict: employee is monitored." — so the codes are named here (QA audit 2026-10-08, WP-455).
 */
function inviteFailureReason(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case "employee_is_monitored":
        return "Already in your directory as an employee without a sign-in — giving them a login isn't supported yet";
      case "email_in_use":
        return "Already invited, or already in your directory";
      case "seat_limit_reached":
        return "Your plan has no seat left for this person";
    }
  }
  return friendlyError(e, "Couldn't create this invite.");
}

/** The success toast's title — the same whether the codes are emailed or handed out. */
function createdTitle(n: number): string {
  const noun = n === 1 ? "invite" : "invites";
  // "Created", not "sent", for both: the emails go out after this, and whether each one did is shown
  // in the Invited list (UX audit PEOPLE-07).
  return `${n} ${noun} created`;
}

/** The body `POST /v1/employees/invites` wants, once names from the file are resolved to ids. */
interface ResolvedInvite {
  email: string;
  role_id: string;
  department_id: string;
  team_id?: string;
  title: string;
}

export function InviteDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired after a successful create — the Invited section refetches on it. */
  onCreated?: () => void;
}) {
  const [roles, setRoles] = useState<ApiRole[]>([]);
  const [departments, setDepartments] = useState<ApiDepartment[]>([]);
  const [teams, setTeams] = useState<ApiTeam[]>([]);
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  /** `n of total` while a bulk run is in flight — ten invites take visible seconds. */
  const [progress, setProgress] = useState(0);
  /** Per-address failures from the last run, kept on screen so they can be fixed and retried. */
  const [failures, setFailures] = useState<{ email: string; reason: string }[]>([]);
  /** Which input the admin is using. The two paths differ in kind, not just in looks: a paste gives
   *  everyone the same role/department/title, a file gives each row its own. */
  const [mode, setMode] = useState<"paste" | "file">("paste");
  const [file, setFile] = useState<(ParsedInviteFile & { fileName: string }) | null>(
    null,
  );
  const fileInput = useRef<HTMLInputElement>(null);
  /** Needed for the join links in the handout — the accept URL is tenant-scoped. */
  const tenantId = useAuthStore((s) => s.user?.organizationId ?? "");
  /** Which button started the run in flight, so only that one shows its own busy label. */
  const [handoutRun, setHandoutRun] = useState(false);
  /** Highlights the drop zone while a file is over it — without it, nothing says the drop will land. */
  const [dragging, setDragging] = useState(false);
  /**
   * The code sheet of the last no-email run, held until the dialog is closed. The download is a
   * fire-and-forget click that the browser may block (a second download in a session, with no user
   * gesture after a long run) or the admin may cancel — and it looks the same as success. These rows
   * are the only copy of the codes, so they stay here with a button to download them again, instead
   * of being dropped the moment the run ended (QA audit 2026-10-08, WP-223).
   */
  const [handout, setHandout] = useState<{ rows: HandoutRow[]; withName: boolean } | null>(null);
  /** Which of the pickers' reads failed — said, with a retry, not left at "Loading…" (WP-457). */
  const [loadFailed, setLoadFailed] = useState<{ roles: boolean; departments: boolean }>({
    roles: false,
    departments: false,
  });
  const [departmentsLoaded, setDepartmentsLoaded] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  // Parsed on every keystroke: the chips below the box are the honest answer to "who am I about to
  // invite", which a raw textarea can't give.
  const parsed = useMemo(() => parseEmails(email), [email]);
  const count = parsed.emails.length;
  const overBy = Math.max(0, count - MAX_INVITES);

  // Load assignable roles (never the Owner) + the org structure when the dialog opens. A role and a
  // department are required — the server refuses an invite without either — so a failed read is said
  // in the picker with a retry; it used to read "Loading roles…" or "No departments yet" for good.
  // Teams are optional: a failed teams read leaves that picker empty and invites still work.
  useEffect(() => {
    if (!open) return;
    let live = true;
    setLoadFailed({ roles: false, departments: false });
    listRoles()
      .then((r) => {
        if (!live) return;
        const assignable = r.filter((role) => !role.is_owner);
        setRoles(assignable);
        // Default to Employee if present.
        const emp = assignable.find((role) => /employee/i.test(role.name));
        setRoleId((cur) => cur || emp?.id || assignable[0]?.id || "");
      })
      .catch(() => live && setLoadFailed((f) => ({ ...f, roles: true })));
    listDepartments()
      .then((d) => {
        if (!live) return;
        setDepartments(d);
        setDepartmentsLoaded(true);
      })
      .catch(() => live && setLoadFailed((f) => ({ ...f, departments: true })));
    listTeams()
      .then((t) => live && setTeams(t))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [open, loadAttempt]);

  // Every team. Teams no longer belong to a department (Settings creates them without one), so the
  // old filter by the picked department always came up empty once a department was chosen — and a
  // department is mandatory (QA audit 2026-10-08, WP-063).
  const teamOptions = teams;

  /**
   * Turn the file's rows into request bodies, or into a reason the row can't be sent.
   *
   * Two rules decide everything here. **A row's own value wins**, so a file that names a department
   * per person means what it says. **A field the row leaves blank falls back to the picker below**,
   * which is what makes a one-column file of addresses a valid import and stops an admin having to
   * repeat "Engineering" two hundred times.
   *
   * Nothing is guessed. A department the org doesn't have is refused by name rather than quietly
   * swapped for the default — importing someone into the wrong department is discovered weeks later,
   * if ever, and is far more expensive than being told to fix a cell now.
   */
  const resolved = useMemo(() => {
    if (!file) return null;
    const ready: ResolvedInvite[] = [];
    const problems: { email: string; reason: string }[] = [];

    for (const row of file.rows) {
      const role = row.role
        ? matchByName(row.role, roles)
        : roles.find((r) => r.id === roleId);
      if (!role) {
        problems.push({
          email: row.email,
          reason: row.role ? `No role named "${row.role}"` : "No role — pick one below",
        });
        continue;
      }
      const department = row.department
        ? matchByName(row.department, departments)
        : departments.find((d) => d.id === departmentId);
      if (!department) {
        problems.push({
          email: row.email,
          reason: row.department
            ? `No department named "${row.department}"`
            : "No department — pick one below",
        });
        continue;
      }
      // A named team that doesn't resolve is an error, never a silent omission: the row asked for a
      // team, and inviting the person with none would look like it worked.
      let team = row.team ? matchByName(row.team, teams) : undefined;
      if (row.team && !team) {
        problems.push({ email: row.email, reason: `No team named "${row.team}"` });
        continue;
      }
      // A row with no team of its own takes the one picked below. Teams span departments, so the
      // row's department does not decide whether that pick applies.
      if (!row.team && teamId) {
        team = teams.find((t) => t.id === teamId);
      }
      const rowTitle = row.title || title.trim();
      if (!rowTitle) {
        problems.push({
          email: row.email,
          reason: "No job title — add a title column or one below",
        });
        continue;
      }
      ready.push({
        email: row.email,
        role_id: role.id,
        department_id: department.id,
        title: rowTitle,
        ...(team ? { team_id: team.id } : {}),
      });
    }
    return { ready, problems };
  }, [file, roles, departments, teams, roleId, departmentId, teamId, title]);

  /** Read + parse a chosen file. Parsing is async because the XLSX reader is loaded on demand. */
  const onFile = useCallback((chosen: File | undefined) => {
    if (!chosen) return;
    if (chosen.size > MAX_FILE_BYTES) {
      toast.error("That file is too large", {
        description: "Imports are limited to 2 MB.",
      });
      return;
    }
    setFailures([]);
    parseInviteFile(chosen)
      .then((parsedFile) => setFile({ ...parsedFile, fileName: chosen.name }))
      .catch(() => toast.error("Couldn't read that file"));
  }, []);

  /** Every input back to empty — but a held code sheet stays (see `handout`). */
  function clearInputs() {
    setEmail("");
    setDepartmentId("");
    setTeamId("");
    setTitle("");
    setSubmitting(false);
    setProgress(0);
    setFailures([]);
    setFile(null);
    setHandoutRun(false);
    setDragging(false);
    setMode("paste");
    if (fileInput.current) fileInput.current.value = "";
  }

  function reset() {
    clearInputs();
    setHandout(null);
  }

  /** Download the held code sheet again — from a click, so the browser treats it as asked for. */
  function downloadHandoutAgain() {
    if (!handout) return;
    downloadInviteHandout(handout.rows, window.location.origin, tenantId, {
      withName: handout.withName,
    }).catch(() =>
      toast.error("Couldn't build the code sheet", {
        description: "Try again — the codes are still held here until you close this dialog.",
      }),
    );
  }

  /** Drop one address from the pending list — the chips are editable, not just a preview. */
  function removeEmail(target: string) {
    setEmail(parsed.emails.filter((e) => e !== target).join(", "));
  }

  /**
   * Create a batch of invites, reporting each one's outcome.
   *
   * `withHandout` picks which of the two buttons ran, and it changes **how the code reaches the
   * person** — the two are alternatives, not additions:
   *
   * - `false` — the server emails each invite (Resend, via the notifications rail). The code stays
   *   between the server and the invitee; nobody else ever sees it.
   * - `true` — no email is sent (`notify: false`), and the codes are written to a spreadsheet for
   *   the admin to hand out. Right for a bulk import distributing over chat or on paper, and it
   *   spends none of the email provider's daily quota.
   *
   * The second mode puts the whole batch's usability in one file: with no email, that spreadsheet is
   * the only place the codes exist. So a failed download there is a genuine problem, not an
   * inconvenience, and is reported as one.
   *
   * Bounded concurrency, not `Promise.all`: firing two hundred POSTs at once bursts the Lambda into
   * throttling, and writes are never retried (lib/api), so a throttled invite would simply be lost.
   * Four at a time keeps a bulk run flat and quick. One bad address never abandons the rest.
   */
  async function runInvites(
    bodies: ResolvedInvite[],
    withHandout: boolean,
    nameOf?: (email: string) => string | undefined,
  ) {
    const created: HandoutRow[] = [];
    const results = await mapWithConcurrency(bodies, 4, async (body) => {
      try {
        const invite = await createInvite(
          withHandout ? { ...body, notify: false } : body,
        );
        // On the handout path this response is the **only** time `token` and `otp` exist: the server
        // stores hashes and can never reproduce them. Losing them here means the invite can only be
        // revoked and re-issued, so they are captured before anything else can go wrong. (An emailed
        // invite comes back without them, by design, so there is nothing to hold.)
        if (withHandout) {
          if (!hasCodes(invite)) {
            // The server always returns them for `notify: false`. If it ever does not, this invite
            // exists but nobody can use it — said plainly, rather than a blank code in the sheet.
            return {
              email: body.email,
              ok: false as const,
              reason:
                "Created, but no code came back. Revoke it in the Invited list and invite again.",
            };
          }
          created.push({ invite, name: nameOf?.(body.email) });
        }
        return { email: body.email, ok: true as const };
      } catch (e) {
        return {
          email: body.email,
          ok: false as const,
          reason: inviteFailureReason(e),
        };
      } finally {
        setProgress((n) => n + 1);
      }
    });
    const failed = results.filter((r) => !r.ok) as { email: string; reason: string }[];

    // Partial runs still produce a file — the invites that succeeded are real, and their codes are
    // just as unrecoverable as a clean run's. The rows are held in the dialog as well (see `handout`):
    // nothing can tell a download the browser blocked from one that landed. The dialog can't be
    // closed while the run is in flight (WP-221), so nothing is lost before this point.
    if (withHandout && created.length > 0) {
      // The imported sheet has a Name column because the file supplies one; a pasted run has no
      // names to put in it, so the column is left out rather than shipped empty in every row.
      const withName = mode === "file";
      setHandout({ rows: created, withName });
      try {
        await downloadInviteHandout(created, window.location.origin, tenantId, { withName });
      } catch {
        // No email was sent on this path, so the sheet is the only way these codes reach anyone.
        // The rows are still held, so the remedy is one click away — said plainly.
        toast.error(
          `${created.length} ${created.length === 1 ? "invite was" : "invites were"} created, but the code sheet couldn't be downloaded`,
          {
            description:
              "No email was sent. Use “Download the code sheet again” before closing this dialog — the codes exist nowhere else.",
            duration: 30000,
          },
        );
      }
    }
    return { failed, sent: results.length - failed.length };
  }

  /** The file path: every row carries its own role, department, team and title. */
  async function submitFile(withHandout: boolean) {
    if (!resolved) return;
    if (!resolved.ready.length) {
      toast.error(
        resolved.problems.length
          ? "No row in that file is ready to send. Fix the ones listed and try again."
          : "That file has no rows to import.",
      );
      return;
    }
    if (resolved.ready.length > MAX_IMPORT_ROWS) {
      toast.error(`Import up to ${MAX_IMPORT_ROWS} people at a time.`, {
        description: "Split the file and send the rest as a second import.",
      });
      return;
    }

    setSubmitting(true);
    setFailures([]);
    setProgress(0);

    // The file's own name column, looked up per address, so the handout names each person rather
    // than listing 500 bare addresses against 500 codes.
    const nameByEmail = new Map(
      (file?.rows ?? []).map((r) => [r.email, r.name] as const),
    );
    const { failed, sent } = await runInvites(resolved.ready, withHandout, (email) =>
      nameByEmail.get(email),
    );

    if (sent) {
      toast.success(createdTitle(sent), {
        description: withHandout
          ? "No emails were sent — the downloaded spreadsheet holds every code and join link, and is the only copy."
          : "Their emails are on their way. The Invited list shows whether each one was sent.",
      });
      onCreated?.();
    }

    if (failed.length) {
      // Keep the file on screen with only the failures listed. Re-pressing the button would resend
      // the whole file, so the successes are named in the toast and the failures below it — the
      // admin decides whether to fix the file or invite the remainder by paste.
      setFailures(failed);
      setSubmitting(false);
      setProgress(0);
      toast.error(
        failed.length === 1
          ? "1 invite couldn't be created"
          : `${failed.length} invites couldn't be created`,
        { description: "The reason for each is listed below." },
      );
      return;
    }

    finish(withHandout);
  }

  /**
   * After a clean run: close — unless the run produced a code sheet, which stays held with its
   * download-again button until the admin closes the dialog themselves (WP-223). The inputs are
   * cleared either way, so the same batch can't be sent twice.
   */
  function finish(withHandout: boolean) {
    if (withHandout) {
      clearInputs();
      return;
    }
    reset();
    onOpenChange(false);
  }

  async function submit(withHandout = false) {
    setHandoutRun(withHandout);
    if (mode === "file") return submitFile(withHandout);
    if (!count) {
      toast.error(
        parsed.invalid.length
          ? "None of those look like email addresses. Check them and try again."
          : "Enter at least one work email.",
      );
      return;
    }
    if (overBy) {
      toast.error(`Invite up to ${MAX_INVITES} people at a time.`, {
        description: `Remove ${overBy} ${overBy === 1 ? "address" : "addresses"} and send the rest as a second batch.`,
      });
      return;
    }
    if (!roleId) {
      toast.error("Pick a role for the invite.");
      return;
    }
    if (!departmentId) {
      toast.error("Pick a department — every employee is filed from day one.");
      return;
    }
    if (!title.trim()) {
      toast.error("Enter a job title.");
      return;
    }

    setSubmitting(true);
    setFailures([]);
    setProgress(0);

    const { failed, sent } = await runInvites(
      parsed.emails.map((address) => ({
        email: address,
        role_id: roleId,
        department_id: departmentId,
        title: title.trim(),
        ...(teamId ? { team_id: teamId } : {}),
      })),
      withHandout,
    );

    if (sent) {
      toast.success(
        sent === 1 && !withHandout
          ? `Invite created for ${parsed.emails.find((e) => !failed.some((f) => f.email === e))}`
          : createdTitle(sent),
        {
          description: withHandout
            ? "No emails were sent — the downloaded spreadsheet holds every code and join link, and is the only copy."
            : "Their emails are on their way. The Invited list shows whether each one was sent.",
        },
      );
      onCreated?.();
    }

    if (failed.length) {
      // The successes are done and reported; leave only what still needs attention in the box so
      // pressing the button again retries exactly those.
      setEmail(failed.map((f) => f.email).join(", "));
      setFailures(failed);
      setSubmitting(false);
      setProgress(0);
      toast.error(
        failed.length === 1
          ? `1 invite couldn't be created`
          : `${failed.length} invites couldn't be created`,
        { description: "They're still in the box with the reason for each." },
      );
      return;
    }

    finish(withHandout);
  }

  /** How many this run would invite, whichever input is in use — both buttons count the same set. */
  const totalToInvite = mode === "file" ? (resolved?.ready.length ?? 0) : count;

  /**
   * Which pickers a loaded file still needs, so each one can say whether it is doing anything.
   *
   * The pickers are fallbacks: a file supplying a column for every row makes the matching picker
   * dead. Leaving it looking the same as a live one is what makes the dialog read as "why am I being
   * asked for this when it is in my file" — so the label answers that instead of the user having to.
   *
   * A field is "needed" when **any** row lacks it, because one blank cell in two hundred is still a
   * row that will be refused without the fallback.
   */
  const fileNeeds = useMemo(() => {
    const rows = mode === "file" ? (file?.rows ?? []) : [];
    if (rows.length === 0) return null;
    return {
      role: rows.some((r) => !r.role),
      department: rows.some((r) => !r.department),
      title: rows.some((r) => !r.title),
    };
  }, [file, mode]);

  /** The parenthetical after a fallback field's label. */
  const fallbackHint = (needed: boolean | undefined) => {
    if (mode !== "file") return null;
    const text =
      needed === false
        ? "every row has its own — not used"
        : "for rows without this column";
    return <span className="text-muted-foreground font-normal">({text})</span>;
  };

  /** Both footer buttons refuse under the same conditions — they differ only in how codes travel. */
  const cannotSubmit =
    submitting ||
    !roles.length ||
    (mode === "paste"
      ? overBy > 0
      : !resolved?.ready.length || resolved.ready.length > MAX_IMPORT_ROWS);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Not while a run is in flight. Escape, the ×, or a click outside used to close the dialog
        // and reset it while the batch kept creating (and emailing) invites in the background — and
        // a second run could then start alongside the first (QA audit 2026-10-08, WP-221).
        if (!o && submitting) return;
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      {/* The body scrolls, the header and footer do not. Without this the dialog grows past the
          viewport on a laptop screen — the title clips off the top and the buttons sit below the
          fold with no way to reach them, which is a dialog you cannot finish. `dvh` rather than
          `vh` so a mobile browser's collapsing toolbar doesn't hide the footer either. */}
      <DialogContent
        showCloseButton={!submitting}
        className="grid max-h-[90dvh] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-lg"
      >
        <DialogHeader>
          <DialogTitle>
            {(() => {
              const total = mode === "file" ? (resolved?.ready.length ?? 0) : count;
              return total > 1 ? `Invite ${total} employees` : "Invite employee";
            })()}
          </DialogTitle>
          <DialogDescription>
            {mode === "file"
              ? "Each row can carry its own role, department, team and title — invitees only fill in their personal details."
              : "Role, department, team and title are fixed by you — each invitee only fills in their personal details."}
          </DialogDescription>
        </DialogHeader>

        {/* `-mx-1 px-1` keeps focus rings from being clipped by the scroll container's edge. */}
        <div className="-mx-1 space-y-4 overflow-y-auto px-1">
          {handout ? (
            <div className="border-primary/30 bg-primary/5 space-y-2 rounded-lg border p-3">
              <p className="text-sm font-medium">
                Code sheet for {handout.rows.length}{" "}
                {handout.rows.length === 1 ? "invite" : "invites"}
              </p>
              <p className="text-muted-foreground text-xs">
                No emails were sent, so this spreadsheet is the only place these codes exist. If it
                didn&apos;t download, download it again now — once you close this dialog, the codes
                are gone.
              </p>
              <Button variant="outline" size="sm" onClick={downloadHandoutAgain}>
                <Download className="size-4" /> Download the code sheet again
              </Button>
            </div>
          ) : null}
          <div className="bg-muted flex gap-1 rounded-lg p-1" role="group" aria-label="How to add people">
            {(
              [
                ["paste", "Paste emails"],
                ["file", "Import CSV or Excel"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                disabled={submitting}
                // The selected half was shown only by its styling (WP-461).
                aria-pressed={mode === value}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:pointer-events-none ${
                  mode === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "file" ? (
            <div className="space-y-3">
              <input
                ref={fileInput}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={(e) => {
                  onFile(e.target.files?.[0]);
                  // Clear it, so picking the same file again — after fixing it — fires `change`
                  // again instead of silently doing nothing (WP-220).
                  e.currentTarget.value = "";
                }}
              />
              {/* A drop target, not just a button. Dragging a spreadsheet onto a dialog is the
                  reflex, and a file input alone silently ignores it — the file lands on the page,
                  the browser navigates away from the app, and the work in the dialog is lost. */}
              <div
                role="button"
                tabIndex={submitting ? -1 : 0}
                aria-label="Choose a CSV or Excel file, or drop one here"
                onClick={() => !submitting && fileInput.current?.click()}
                onKeyDown={(e) => {
                  if (submitting) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInput.current?.click();
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (!submitting) setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  if (!submitting) onFile(e.dataTransfer.files?.[0]);
                }}
                className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed text-center transition-colors ${
                  // Once a file is chosen the card below carries the detail, so this shrinks to a
                  // single line — a tall target competing with its own result is what pushed the
                  // footer off the screen.
                  file ? "px-4 py-2.5" : "flex-col gap-1 px-4 py-5"
                } ${
                  dragging
                    ? "border-primary bg-primary/5"
                    : "border-input hover:border-muted-foreground/40 hover:bg-muted/40"
                } ${submitting ? "pointer-events-none opacity-50" : ""}`}
              >
                <FileUp className="text-muted-foreground size-4 shrink-0" />
                <span className="text-sm font-medium">
                  {dragging
                    ? "Drop it here"
                    : file
                      ? "Drop another file, or click to choose"
                      : "Drop a CSV or Excel file here, or click to choose"}
                </span>
                {file ? null : (
                  <span className="text-muted-foreground text-xs">.csv · .xlsx</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-sm">Template:</span>
                <Button
                  variant="ghost"
                  onClick={downloadInviteCsvTemplate}
                  disabled={submitting}
                >
                  <Download className="size-4" /> CSV
                </Button>
                <Button
                  variant="ghost"
                  onClick={() =>
                    downloadInviteXlsxTemplate().catch(() =>
                      toast.error("Couldn't build the Excel template", {
                        description: "Download the CSV one instead — it opens in Excel.",
                      }),
                    )
                  }
                  disabled={submitting}
                >
                  <Download className="size-4" /> Excel
                </Button>
              </div>

              {/* Guidance for picking a file. Once one is loaded the card below answers the only
                  remaining question, so this stands down rather than pushing the footer off-screen. */}
              {file ? null : (
                <p className="text-muted-foreground text-xs">
                  A <strong>.csv</strong> or <strong>.xlsx</strong> with an{" "}
                  <strong>email</strong> column. Add <em>role</em>, <em>department</em>,{" "}
                  <em>team</em> or <em>title</em> columns to set them per person —
                  anything a row leaves blank uses the selections below. A <em>name</em>{" "}
                  column labels each person in the downloaded code sheet; it isn&apos;t
                  sent, since invitees enter their own name when they sign up.
                </p>
              )}

              {file?.fatal ? (
                <p className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border p-3 text-sm">
                  {file.fatal}
                </p>
              ) : null}

              {file && !file.fatal && resolved ? (
                <div className="border-primary/30 bg-primary/5 space-y-2 rounded-lg border p-3">
                  {/* Loud enough to answer "did it take my file?" at a glance. The quiet one-line
                      version of this read as decoration and got missed. */}
                  <div className="flex items-start gap-2.5">
                    <FileSpreadsheet className="text-primary mt-0.5 size-5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{file.fileName}</p>
                      <p className="text-muted-foreground text-xs">
                        <span className="text-foreground font-medium">
                          {resolved.ready.length} ready to invite
                        </span>
                        {resolved.problems.length
                          ? ` · ${resolved.problems.length} need attention`
                          : ""}
                        {file.errors.length
                          ? ` · ${file.errors.length} row${file.errors.length === 1 ? "" : "s"} skipped`
                          : ""}
                        {file.duplicates
                          ? ` · ${file.duplicates} duplicate${file.duplicates === 1 ? "" : "s"} ignored`
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        setFailures([]);
                        if (fileInput.current) fileInput.current.value = "";
                      }}
                      disabled={submitting}
                      aria-label="Remove this file"
                      className="text-muted-foreground hover:text-foreground rounded-full p-0.5 transition-colors disabled:pointer-events-none"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  {resolved.ready.length > MAX_IMPORT_ROWS ? (
                    <p className="text-destructive text-xs font-medium">
                      That&apos;s {resolved.ready.length - MAX_IMPORT_ROWS} over the{" "}
                      {MAX_IMPORT_ROWS}-row limit. Split the file — nothing is dropped for
                      you.
                    </p>
                  ) : null}

                  {/* Rows the file itself couldn't produce: a bad address, a missing header. The
                      line number is what makes this actionable — it matches the spreadsheet. */}
                  {file.errors.length ? (
                    <ul className="text-warning space-y-0.5 text-xs">
                      {file.errors.slice(0, 6).map((e) => (
                        <li key={e.line}>
                          Row {e.line} — {e.reason}
                        </li>
                      ))}
                      {file.errors.length > 6 ? (
                        <li>+{file.errors.length - 6} more rows with problems</li>
                      ) : null}
                    </ul>
                  ) : null}

                  {/* Rows that parsed but name something this org doesn't have. */}
                  {resolved.problems.length ? (
                    <ul className="text-destructive space-y-0.5 text-xs">
                      {resolved.problems.slice(0, 6).map((p) => (
                        <li key={p.email}>
                          <span className="font-medium">{p.email}</span> — {p.reason}
                        </li>
                      ))}
                      {resolved.problems.length > 6 ? (
                        <li>+{resolved.problems.length - 6} more</li>
                      ) : null}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {failures.length ? (
                <ul className="text-destructive space-y-1 text-xs">
                  {failures.map((f) => (
                    <li key={f.email}>
                      <span className="font-medium">{f.email}</span> — {f.reason}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor="inv-email">Work emails</Label>
                {count ? (
                  <span
                    className={
                      overBy
                        ? "text-destructive text-xs font-medium"
                        : "text-muted-foreground text-xs"
                    }
                  >
                    {count} {count === 1 ? "person" : "people"}
                    {overBy ? ` · ${MAX_INVITES} max` : ""}
                    {parsed.duplicates
                      ? ` · ${parsed.duplicates} duplicate${parsed.duplicates === 1 ? "" : "s"} ignored`
                      : ""}
                  </span>
                ) : null}
              </div>
              <Textarea
                id="inv-email"
                rows={3}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={"jordan@acme.test, sam@acme.test\nor paste a whole list"}
                className="min-h-20"
              />
              <p className="text-muted-foreground text-xs">
                Invite one person or up to {MAX_INVITES} at a time — separate addresses
                with commas, spaces or new lines. Everyone here gets the same role,
                department, team and title.
              </p>

              {overBy ? (
                <p className="text-destructive text-xs font-medium">
                  That&apos;s {overBy} too many. Remove{" "}
                  {overBy === 1 ? "one address" : `${overBy} addresses`} and send the rest
                  as a second batch — nothing is dropped for you.
                </p>
              ) : null}

              {/* What we actually parsed. A textarea alone can't tell you that a stray character split
                an address in two, and finding that out from a failed invite is too late. */}
              {count ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {parsed.emails.map((address) => (
                    <span
                      key={address}
                      className="bg-muted inline-flex max-w-full items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-xs"
                    >
                      <span className="truncate">{address}</span>
                      <button
                        type="button"
                        onClick={() => removeEmail(address)}
                        disabled={submitting}
                        aria-label={`Remove ${address}`}
                        className="text-muted-foreground hover:bg-background hover:text-foreground rounded-full p-0.5 transition-colors disabled:pointer-events-none"
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}

              {parsed.invalid.length ? (
                <p className="text-warning pt-1 text-xs">
                  Not an email address, so {parsed.invalid.length === 1 ? "it" : "they"}{" "}
                  won&apos;t be invited: {parsed.invalid.slice(0, 5).join(", ")}
                  {parsed.invalid.length > 5 ? ` +${parsed.invalid.length - 5} more` : ""}
                </p>
              ) : null}

              {failures.length ? (
                <ul className="text-destructive space-y-1 pt-1 text-xs">
                  {failures.map((f) => (
                    <li key={f.email}>
                      <span className="font-medium">{f.email}</span> — {f.reason}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Role {fallbackHint(fileNeeds?.role)}</Label>
            {/* Base UI's Select.Value renders the RAW value (the id) in the trigger unless the
                root gets an `items` value→label map — hence these on every id-valued select. */}
            <Select
              value={roleId || null}
              onValueChange={(v) => setRoleId(v as string)}
              items={Object.fromEntries(roles.map((r) => [r.id, r.name]))}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    roles.length
                      ? "Select a role"
                      : loadFailed.roles
                        ? "Couldn't load roles"
                        : "Loading roles…"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {loadFailed.roles || loadFailed.departments ? (
            <p className="text-destructive text-xs">
              {loadFailed.roles && loadFailed.departments
                ? "Roles and departments couldn't be loaded"
                : loadFailed.roles
                  ? "Roles couldn't be loaded"
                  : "Departments couldn't be loaded"}
              , and an invite needs both.{" "}
              <button
                type="button"
                onClick={() => setLoadAttempt((n) => n + 1)}
                className="font-medium underline underline-offset-2"
              >
                Try again
              </button>
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Department {fallbackHint(fileNeeds?.department)}</Label>
              <Select
                value={departmentId || null}
                items={Object.fromEntries(departments.map((d) => [d.id, d.name]))}
                onValueChange={(v) => {
                  const dept = (v as string) ?? "";
                  setDepartmentId(dept);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      departments.length
                        ? "Select"
                        : loadFailed.departments
                          ? "Couldn't load departments"
                          : departmentsLoaded
                            ? "No departments yet"
                            : "Loading…"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* A department is required, so an org without one could invite nobody (PEOPLE-02). */}
              {departmentsLoaded && !loadFailed.departments ? (
                <NewDepartmentInline
                  noneYet={departments.length === 0}
                  onCreated={(d) => {
                    setDepartments((prev) =>
                      [...prev, d].sort((a, b) => a.name.localeCompare(b.name)),
                    );
                    setDepartmentId(d.id);
                  }}
                />
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label>
                Team{" "}
                {mode === "file" ? (
                  <span className="text-muted-foreground font-normal">
                    (for rows without this column)
                  </span>
                ) : (
                  <span className="text-muted-foreground font-normal">(optional)</span>
                )}
              </Label>
              {/* "No team" is an option, so a picked team can be taken back off (WP-457). */}
              <Select
                value={teamId || null}
                onValueChange={(v) => setTeamId(v === NO_TEAM ? "" : (v as string))}
                items={{
                  [NO_TEAM]: "No team",
                  ...Object.fromEntries(teamOptions.map((t) => [t.id, t.name])),
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={teamOptions.length ? "Select" : "No teams to pick"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {teamOptions.length ? <SelectItem value={NO_TEAM}>No team</SelectItem> : null}
                  {teamOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-title">Job title {fallbackHint(fileNeeds?.title)}</Label>
            <Input
              id="inv-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Backend Engineer"
            />
          </div>
        </div>

        {/* Said before the run, not after (UX audit PEOPLE-07): the provider's daily limit is shared
            across WorkPulse, so a big emailed batch can outrun it. Failures are marked in the
            Invited list either way. */}
        {!handout && totalToInvite > 1 ? (
          <p
            className={cn(
              "text-xs",
              totalToInvite > LARGE_EMAIL_BATCH ? "text-warning" : "text-muted-foreground",
            )}
          >
            {totalToInvite > LARGE_EMAIL_BATCH
              ? `Invite emails go through a provider with a daily sending limit, so some of these ${totalToInvite} may not go out today. Any that don't are marked "Not sent" in the Invited list, where you can resend them — or use Create + download Excel to hand the codes out yourself.`
              : `If an email can't go out (the provider has a daily limit), the Invited list marks it "Not sent" and you can resend it.`}
          </p>
        ) : null}

        <DialogFooter className="sm:justify-between">
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={submitting}
          >
            {handout ? "Done" : "Cancel"}
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            {/* Both buttons create the same invites. They differ in **how the code reaches the
                person**, which is why they are alternatives rather than one button with an extra:
                email it, or download it and hand it out. Naming both in the labels is what stops
                someone pressing the spreadsheet one and then waiting for an email that is never
                coming. */}
            <Button
              variant="outline"
              onClick={() => submit(true)}
              disabled={cannotSubmit}
              title="Creates the invites WITHOUT emailing them, and downloads a spreadsheet of the codes and join links to hand out yourself"
            >
              <Download className="size-4" />
              {submitting && handoutRun
                ? `Preparing ${progress} of ${totalToInvite}…`
                : "Create + download Excel"}
            </Button>
            <Button onClick={() => submit(false)} disabled={cannotSubmit}>
              {submitting && !handoutRun
                ? totalToInvite > 1
                  ? `Inviting ${progress} of ${totalToInvite}…`
                  : "Sending…"
                : totalToInvite > 1
                  ? `Email ${totalToInvite} invites`
                  : "Send invite"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
