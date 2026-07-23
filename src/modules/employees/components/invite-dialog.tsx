"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Check, Mail, RotateCcw, Trash2 } from "lucide-react";
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
  revokeInvite,
  resendInvite,
  listDepartments,
  listTeams,
  type ApiDepartment,
  type ApiInviteCreated,
  type ApiTeam,
} from "../services/employees.service";
import { useAuthStore } from "@/stores/auth.store";

/** The accept-page URL the invitee opens — carries tenant + invite + token (the OTP stays separate,
 *  shared out-of-band, since it's the second factor). Mirrors the link the invite email builds. */
function acceptLink(tenantId: string, invite: ApiInviteCreated): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const q = new URLSearchParams({
    tenant_id: tenantId,
    invite_id: invite.invite_id,
    token: invite.token,
  });
  return `${origin}/invite/accept?${q.toString()}`;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border bg-muted/40 px-2.5 py-1.5 font-mono text-xs">
          {value}
        </code>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          aria-label={`Copy ${label}`}
          onClick={() => {
            void navigator.clipboard?.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  );
}

export function InviteDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  const [created, setCreated] = useState<ApiInviteCreated | null>(null);
  // The admin's own tenant, from their ID-token claims — the invitee joins the same org.
  const tenantId = useAuthStore((s) => s.user?.organizationId ?? "");

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

  // The role name captured at submit — computed when `roles` is loaded and `roleId` is set, so the
  // result always shows the role that was actually picked. Relying on `created.role_id` (the response
  // returns it empty) or on re-resolving `roleId` at render (fragile) left the row blank.
  const [submittedRole, setSubmittedRole] = useState("");

  function reset() {
    setEmail("");
    setDepartmentId("");
    setTeamId("");
    setTitle("");
    setCreated(null);
    setSubmittedRole("");
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
    // Capture the picked role's name now, while `roles` is loaded and `roleId` is set.
    const picked = roles.find((r) => r.id === roleId)?.name ?? "";
    try {
      const invite = await createInvite({
        email: email.trim(),
        role_id: roleId,
        department_id: departmentId,
        title: title.trim(),
        ...(teamId ? { team_id: teamId } : {}),
      });
      setSubmittedRole(picked);
      setCreated(invite);
      toast.success(`Invite created for ${invite.email}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't create the invite. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke() {
    if (!created) return;
    try {
      await revokeInvite(created.invite_id);
      toast.success("Invite revoked.");
      reset();
    } catch {
      toast.error("Couldn't revoke the invite.");
    }
  }

  async function handleResend() {
    if (!created) return;
    try {
      await resendInvite(created.invite_id);
      toast.success("Delivery re-attempted (email isn't enabled in this environment).");
    } catch {
      toast.error("Couldn't resend the invite.");
    }
  }

  const roleName = (id: string) => roles.find((r) => r.id === id)?.name ?? id;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {!created ? (
          <>
            <DialogHeader>
              <DialogTitle>Invite employee</DialogTitle>
              <DialogDescription>
                Create an invite. Role, department, team and title are fixed by you — the invitee
                only fills in their personal details.
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
                      <SelectValue
                        placeholder={departments.length ? "Select" : "No departments yet"}
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
                      <SelectValue
                        placeholder={teamOptions.length ? "Select" : "No teams to pick"}
                      />
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
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Invite created</DialogTitle>
              <DialogDescription>
                {/* The invite email sends automatically (best-effort, via the notifications rail).
                    The link + OTP stay here as the reliable fallback — delivery can fail without
                    the server ever knowing (spam filters, SES sandbox), so don't overclaim it. */}
                An invite email is on its way to{" "}
                <span className="font-medium text-foreground">{created.email}</span>. If it
                doesn&apos;t arrive, share the link and one-time password below yourself — they
                won&apos;t be shown again.
              </DialogDescription>
            </DialogHeader>

            {/* min-w-0: this is a grid item of DialogContent (a `grid`). Without it the item's
                min-width is its content's min-content — and the invite-link `<code>` is nowrap, so
                that's the whole URL, which blows the dialog past its max-width. min-w-0 lets the
                column shrink to the dialog and the `truncate` on the URL finally engages. */}
            <div className="min-w-0 space-y-3">
              {/*
                No "Employee ID" here: empId is server-generated only when the invite is ACCEPTED
                (the atomic COUNTER#emp_id sequence, LLD §2), so it does not exist yet — showing an
                empty row implied a value that can't be assigned until the person joins.

                Role is shown from what we submitted (`roleId`), falling back to the response — the
                invite-create response returns an empty `role_id`, so relying on it left this blank.
              */}
              <div className="divide-y rounded-lg border bg-muted/30 text-sm">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-muted-foreground">Role</span>
                  <span className="font-medium">
                    {submittedRole || roleName(created.role_id) || "—"}
                  </span>
                </div>
                {created.department_id ? (
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-muted-foreground">Department</span>
                    <span className="font-medium">
                      {departments.find((d) => d.id === created.department_id)?.name ??
                        created.department_id}
                    </span>
                  </div>
                ) : null}
                {created.team_id ? (
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-muted-foreground">Team</span>
                    <span className="font-medium">
                      {teams.find((t) => t.id === created.team_id)?.name ?? created.team_id}
                    </span>
                  </div>
                ) : null}
                {created.title ? (
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-muted-foreground">Job title</span>
                    <span className="font-medium">{created.title}</span>
                  </div>
                ) : null}
              </div>
              <CopyRow label="Invite link" value={acceptLink(tenantId, created)} />
              <CopyRow label="One-time password" value={created.otp} />
              <p className="text-xs text-muted-foreground">
                Expires {new Date(created.expires_at * 1000).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                .
              </p>
            </div>

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleResend}>
                  <RotateCcw className="size-4" /> Resend
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={handleRevoke}
                >
                  <Trash2 className="size-4" /> Revoke
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={reset}>
                  <Mail className="size-4" /> Invite another
                </Button>
                <Button size="sm" onClick={() => onOpenChange(false)}>
                  Done
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
