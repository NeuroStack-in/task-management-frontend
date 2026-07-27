"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
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
import { isEmail } from "@/lib/validation";
import { ApiError } from "@/lib/api";
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
  }

  async function submit() {
    if (!isEmail(email)) {
      toast.error("Enter a valid work email.");
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
    try {
      // The invite email is sent server-side (Resend, via the notifications rail). The link and
      // one-time password used to be surfaced here as a manual fallback; now that delivery is real
      // they stay secret — the invitee is the only one who ever sees them.
      const invite = await createInvite({
        email: email.trim(),
        role_id: roleId,
        department_id: departmentId,
        title: title.trim(),
        ...(teamId ? { team_id: teamId } : {}),
      });
      toast.success(`Invite sent to ${invite.email}`, {
        description: "They'll get an email with a link and a one-time password.",
      });
      onCreated?.();
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't create the invite. Try again.");
    } finally {
      setSubmitting(false);
    }
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
          <DialogTitle>Invite employee</DialogTitle>
          <DialogDescription>
            Create an invite. Role, department, team and title are fixed by you — the invitee only
            fills in their personal details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="inv-email">Work email</Label>
            <Input
              id="inv-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jordan@acme.test"
            />
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
            {submitting ? "Creating…" : "Create invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
