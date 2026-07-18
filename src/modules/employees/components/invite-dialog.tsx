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
  type ApiInviteCreated,
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
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<ApiInviteCreated | null>(null);
  // The admin's own tenant, from their ID-token claims — the invitee joins the same org.
  const tenantId = useAuthStore((s) => s.user?.organizationId ?? "");

  // Load assignable roles (never the Owner) when the dialog opens.
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
    return () => {
      live = false;
    };
  }, [open]);

  function reset() {
    setEmail("");
    setCreated(null);
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
    setSubmitting(true);
    try {
      const invite = await createInvite({ email: email.trim(), role_id: roleId });
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
                Create an invite. Department and team are assigned after they join.
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
                <Select value={roleId || undefined} onValueChange={(v) => setRoleId(v as string)}>
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
                Automated email isn&apos;t enabled here — share the invite link and one-time password
                with <span className="font-medium text-foreground">{created.email}</span> yourself.
                They won&apos;t be shown again.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Employee ID</span>
                <span className="font-mono font-medium">{created.emp_id}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Role</span>
                <span className="font-medium">{roleName(created.role_id)}</span>
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
