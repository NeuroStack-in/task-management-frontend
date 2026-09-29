"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Download, FileUp, X } from "lucide-react";
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
import { friendlyError } from "@/lib/errors";
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
import { listRoles, type ApiRole } from "@/modules/roles/services/roles.service";
import {
  createInvite,
  listDepartments,
  listTeams,
  type ApiDepartment,
  type ApiTeam,
} from "../services/employees.service";

/**
 * Most addresses one bulk invite may carry.
 *
 * Not a technical ceiling — nothing breaks at 51. It bounds the failure modes a single run can
 * produce: at four requests in flight a larger batch is a long run with no resumability, and closing
 * the tab halfway leaves the rest unsent with no record of which. Fifty is also the point past which
 * a paste is usually a mistake — a whole spreadsheet column rather than a team.
 *
 * The dialog **refuses** above this rather than truncating: silently dropping people from a paste
 * is worse than making someone split it, because nothing on screen would say who was left out.
 */
const MAX_INVITES = 50;

/**
 * Most rows one imported file may carry.
 *
 * Higher than the paste ceiling because the inputs differ in kind: fifty pasted addresses is usually
 * a mistake, whereas a two-hundred-row export is the ordinary case — that is the whole reason to
 * import a file rather than paste. The resumability concern behind [`MAX_INVITES`] still applies, so
 * this is bounded rather than unlimited, and the run reports every failure with its address so a
 * second attempt sends exactly what is missing.
 */
const MAX_IMPORT_ROWS = 200;

/** How many bytes of spreadsheet to accept. A file much larger than this is not a staff list. */
const MAX_FILE_BYTES = 2 * 1024 * 1024;

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
  const [file, setFile] = useState<(ParsedInviteFile & { fileName: string }) | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // Parsed on every keystroke: the chips below the box are the honest answer to "who am I about to
  // invite", which a raw textarea can't give.
  const parsed = useMemo(() => parseEmails(email), [email]);
  const count = parsed.emails.length;
  const overBy = Math.max(0, count - MAX_INVITES);

  // Load assignable roles (never the Owner) + the org structure when the dialog opens. Departments/
  // teams are best-effort: if either read fails the selects just stay empty and the invite still
  // works (the fields are optional server-side).
  useEffect(() => {
    if (!open) return;
    let live = true;
    listRoles()
      .then((r) => {
        if (!live) return;
        const assignable = r.filter((role) => !role.is_owner);
        setRoles(assignable);
        // Default to Employee if present.
        const emp = assignable.find((role) => /employee/i.test(role.name));
        setRoleId((cur) => cur || emp?.id || assignable[0]?.id || "");
      })
      .catch(() => {});
    listDepartments()
      .then((d) => live && setDepartments(d))
      .catch(() => {});
    listTeams()
      .then((t) => live && setTeams(t))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [open]);

  // Teams belong to a department — offer only the picked department's teams (all teams when no
  // department is picked yet), and drop a team pick that no longer matches the department.
  const teamOptions = departmentId
    ? teams.filter((t) => t.department_id === departmentId)
    : teams;

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
      if (team && team.department_id !== department.id) {
        problems.push({
          email: row.email,
          reason: `Team "${team.name}" isn't in ${department.name}`,
        });
        continue;
      }
      // Only inherit the picked team when the row named no department of its own — a team from the
      // picker belongs to the picked department and would be wrong under a different one.
      if (!row.team && !row.department && teamId) {
        team = teams.find((t) => t.id === teamId);
      }
      const rowTitle = row.title || title.trim();
      if (!rowTitle) {
        problems.push({ email: row.email, reason: "No job title — add a title column or one below" });
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
      toast.error("That file is too large", { description: "Imports are limited to 2 MB." });
      return;
    }
    setFailures([]);
    parseInviteFile(chosen)
      .then((parsedFile) => setFile({ ...parsedFile, fileName: chosen.name }))
      .catch(() => toast.error("Couldn't read that file"));
  }, []);

  function reset() {
    setEmail("");
    setDepartmentId("");
    setTeamId("");
    setTitle("");
    setSubmitting(false);
    setProgress(0);
    setFailures([]);
    setFile(null);
    setMode("paste");
    if (fileInput.current) fileInput.current.value = "";
  }

  /** Drop one address from the pending list — the chips are editable, not just a preview. */
  function removeEmail(target: string) {
    setEmail(parsed.emails.filter((e) => e !== target).join(", "));
  }

  /**
   * Send a batch of prepared invite bodies, reporting each one's outcome.
   *
   * The invite email is sent server-side (Resend, via the notifications rail); the link and one-time
   * password stay secret — the invitee is the only one who ever sees them.
   *
   * Bounded concurrency, not `Promise.all`: firing two hundred POSTs at once bursts the Lambda into
   * throttling, and writes are never retried (lib/api), so a throttled invite would simply be lost.
   * Four at a time keeps a bulk run flat and quick. One bad address never abandons the rest.
   */
  async function runInvites(bodies: ResolvedInvite[]) {
    const results = await mapWithConcurrency(bodies, 4, async (body) => {
      try {
        await createInvite(body);
        return { email: body.email, ok: true as const };
      } catch (e) {
        return {
          email: body.email,
          ok: false as const,
          reason: friendlyError(e, "Couldn't create this invite."),
        };
      } finally {
        setProgress((n) => n + 1);
      }
    });
    const failed = results.filter((r) => !r.ok) as { email: string; reason: string }[];
    return { failed, sent: results.length - failed.length };
  }

  /** The file path: every row carries its own role, department, team and title. */
  async function submitFile() {
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

    const { failed, sent } = await runInvites(resolved.ready);

    if (sent) {
      toast.success(sent === 1 ? "1 invite sent" : `${sent} invites sent`, {
        description: "They'll each get an email with a link and a one-time password.",
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
        failed.length === 1 ? "1 invite couldn't be created" : `${failed.length} invites couldn't be created`,
        { description: "The reason for each is listed below." },
      );
      return;
    }

    reset();
    onOpenChange(false);
  }

  async function submit() {
    if (mode === "file") return submitFile();
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
    );

    if (sent) {
      toast.success(
        sent === 1
          ? `Invite sent to ${parsed.emails.find((e) => !failed.some((f) => f.email === e))}`
          : `${sent} invites sent`,
        { description: "They'll each get an email with a link and a one-time password." },
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

    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
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

        <div className="space-y-4">
          <div className="flex gap-1 rounded-lg bg-muted p-1">
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
                onChange={(e) => onFile(e.target.files?.[0])}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => fileInput.current?.click()}
                  disabled={submitting}
                >
                  <FileUp className="size-4" /> {file ? "Choose another file" : "Choose file"}
                </Button>
                <span className="text-sm text-muted-foreground">Template:</span>
                <Button variant="ghost" onClick={downloadInviteCsvTemplate} disabled={submitting}>
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

              <p className="text-xs text-muted-foreground">
                A <strong>.csv</strong> or <strong>.xlsx</strong> with an <strong>email</strong>{" "}
                column. Add <em>role</em>, <em>department</em>, <em>team</em> or <em>title</em>{" "}
                columns to set them per person — anything a row leaves blank uses the selections
                below. A name column is ignored: each invitee enters their own name when they sign
                up.
              </p>

              {file?.fatal ? (
                <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                  {file.fatal}
                </p>
              ) : null}

              {file && !file.fatal && resolved ? (
                <div className="space-y-2 rounded-lg border p-3">
                  <p className="text-sm">
                    <span className="font-medium">{file.fileName}</span> —{" "}
                    {resolved.ready.length} ready
                    {resolved.problems.length ? `, ${resolved.problems.length} need attention` : ""}
                    {file.duplicates
                      ? `, ${file.duplicates} duplicate${file.duplicates === 1 ? "" : "s"} ignored`
                      : ""}
                  </p>

                  {resolved.ready.length > MAX_IMPORT_ROWS ? (
                    <p className="text-xs font-medium text-destructive">
                      That&apos;s {resolved.ready.length - MAX_IMPORT_ROWS} over the{" "}
                      {MAX_IMPORT_ROWS}-row limit. Split the file — nothing is dropped for you.
                    </p>
                  ) : null}

                  {/* Rows the file itself couldn't produce: a bad address, a missing header. The
                      line number is what makes this actionable — it matches the spreadsheet. */}
                  {file.errors.length ? (
                    <ul className="space-y-0.5 text-xs text-warning">
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
                    <ul className="space-y-0.5 text-xs text-destructive">
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
                <ul className="space-y-1 text-xs text-destructive">
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
                    overBy ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"
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
            <p className="text-xs text-muted-foreground">
              Invite one person or up to {MAX_INVITES} at a time — separate addresses with commas,
              spaces or new lines. Everyone here gets the same role, department, team and title.
            </p>

            {overBy ? (
              <p className="text-xs font-medium text-destructive">
                That&apos;s {overBy} too many. Remove{" "}
                {overBy === 1 ? "one address" : `${overBy} addresses`} and send the rest as a second
                batch — nothing is dropped for you.
              </p>
            ) : null}

            {/* What we actually parsed. A textarea alone can't tell you that a stray character split
                an address in two, and finding that out from a failed invite is too late. */}
            {count ? (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {parsed.emails.map((address) => (
                  <span
                    key={address}
                    className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-2.5 text-xs"
                  >
                    <span className="truncate">{address}</span>
                    <button
                      type="button"
                      onClick={() => removeEmail(address)}
                      disabled={submitting}
                      aria-label={`Remove ${address}`}
                      className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:pointer-events-none"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            {parsed.invalid.length ? (
              <p className="pt-1 text-xs text-warning">
                Not an email address, so {parsed.invalid.length === 1 ? "it" : "they"} won&apos;t be
                invited: {parsed.invalid.slice(0, 5).join(", ")}
                {parsed.invalid.length > 5 ? ` +${parsed.invalid.length - 5} more` : ""}
              </p>
            ) : null}

            {failures.length ? (
              <ul className="space-y-1 pt-1 text-xs text-destructive">
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
            <Label>
              Role{" "}
              {mode === "file" ? (
                <span className="font-normal text-muted-foreground">
                  (for rows without a role column)
                </span>
              ) : null}
            </Label>
            {/* Base UI's Select.Value renders the RAW value (the id) in the trigger unless the
                root gets an `items` value→label map — hence these on every id-valued select. */}
            <Select
              value={roleId || null}
              onValueChange={(v) => setRoleId(v as string)}
              items={Object.fromEntries(roles.map((r) => [r.id, r.name]))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={roles.length ? "Select a role" : "Loading roles…"} />
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Select
                value={departmentId || null}
                items={Object.fromEntries(departments.map((d) => [d.id, d.name]))}
                onValueChange={(v) => {
                  const dept = (v as string) ?? "";
                  setDepartmentId(dept);
                  // A picked team from another department no longer applies.
                  setTeamId((cur) =>
                    teams.find((t) => t.id === cur)?.department_id === dept ? cur : "",
                  );
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={departments.length ? "Select" : "No departments yet"} />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                Team <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Select
                value={teamId || null}
                onValueChange={(v) => setTeamId(v as string)}
                items={Object.fromEntries(teamOptions.map((t) => [t.id, t.name]))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={teamOptions.length ? "Select" : "No teams to pick"} />
                </SelectTrigger>
                <SelectContent>
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
            <Label htmlFor="inv-title">
              Job title{" "}
              {mode === "file" ? (
                <span className="font-normal text-muted-foreground">
                  (for rows without a title column)
                </span>
              ) : null}
            </Label>
            <Input
              id="inv-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Backend Engineer"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={
              submitting ||
              !roles.length ||
              (mode === "paste"
                ? overBy > 0
                : !resolved?.ready.length || resolved.ready.length > MAX_IMPORT_ROWS)
            }
          >
            {(() => {
              const total = mode === "file" ? (resolved?.ready.length ?? 0) : count;
              if (submitting) {
                return total > 1 ? `Inviting ${progress} of ${total}…` : "Creating…";
              }
              return total > 1 ? `Invite ${total} people` : "Create invite";
            })()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
