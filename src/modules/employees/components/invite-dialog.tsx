"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
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
import { listRoles, type ApiRole } from "@/modules/roles/services/roles.service";
import {
  createInvite,
  listDepartments,
  listTeams,
  type ApiDepartment,
  type ApiTeam,
} from "../services/employees.service";

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

  // Parsed on every keystroke: the chips below the box are the honest answer to "who am I about to
  // invite", which a raw textarea can't give.
  const parsed = useMemo(() => parseEmails(email), [email]);
  const count = parsed.emails.length;

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

  function reset() {
    setEmail("");
    setDepartmentId("");
    setTeamId("");
    setTitle("");
    setSubmitting(false);
    setProgress(0);
    setFailures([]);
  }

  /** Drop one address from the pending list — the chips are editable, not just a preview. */
  function removeEmail(target: string) {
    setEmail(parsed.emails.filter((e) => e !== target).join(", "));
  }

  async function submit() {
    if (!count) {
      toast.error(
        parsed.invalid.length
          ? "None of those look like email addresses. Check them and try again."
          : "Enter at least one work email.",
      );
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

    // The invite email is sent server-side (Resend, via the notifications rail). The link and
    // one-time password stay secret — the invitee is the only one who ever sees them.
    //
    // Bounded concurrency, not `Promise.all`: firing twenty POSTs at once bursts the Lambda into
    // throttling, and writes are never retried (lib/api), so a throttled invite would simply be
    // lost. Four at a time keeps a bulk run flat and quick.
    const results = await mapWithConcurrency(parsed.emails, 4, async (address) => {
      try {
        await createInvite({
          email: address,
          role_id: roleId,
          department_id: departmentId,
          title: title.trim(),
          ...(teamId ? { team_id: teamId } : {}),
        });
        return { email: address, ok: true as const };
      } catch (e) {
        // One bad address must not abandon the other nineteen — collect and report.
        return {
          email: address,
          ok: false as const,
          reason: friendlyError(e, "Couldn't create this invite."),
        };
      } finally {
        setProgress((n) => n + 1);
      }
    });

    const failed = results.filter((r) => !r.ok) as {
      email: string;
      reason: string;
    }[];
    const sent = results.length - failed.length;

    if (sent) {
      toast.success(
        sent === 1 ? `Invite sent to ${results.find((r) => r.ok)?.email}` : `${sent} invites sent`,
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
            {count > 1 ? `Invite ${count} employees` : "Invite employee"}
          </DialogTitle>
          <DialogDescription>
            Role, department, team and title are fixed by you — each invitee only fills in their
            personal details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor="inv-email">Work emails</Label>
              {count ? (
                <span className="text-xs text-muted-foreground">
                  {count} {count === 1 ? "person" : "people"}
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
              Invite one person or many — separate addresses with commas, spaces or new lines.
              Everyone here gets the same role, department, team and title.
            </p>

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
          <div className="space-y-1.5">
            <Label>Role</Label>
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
            <Label htmlFor="inv-title">Job title</Label>
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
          <Button onClick={submit} disabled={submitting || !roles.length}>
            {submitting
              ? count > 1
                ? `Inviting ${progress} of ${count}…`
                : "Creating…"
              : count > 1
                ? `Invite ${count} people`
                : "Create invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
