"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Link2, Mail } from "lucide-react";
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
import { organization } from "@/lib/data";
import { isEmail } from "@/lib/validation";
import { cn } from "@/lib/utils";

const ROLES = ["Member", "Manager", "Admin"];

/** Stable workspace slug + invite code (deterministic — no Date/random). */
const SLUG = organization.name
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "");
const INVITE_CODE = (() => {
  let h = 0;
  for (const c of organization.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h.toString(36).toUpperCase().padStart(6, "0").slice(0, 6);
})();
const INVITE_LINK = `https://app.workpulse.io/join/${SLUG}?code=${INVITE_CODE}`;

/** Slack glyph (lucide has no brand mark). */
function SlackIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
    </svg>
  );
}

export function InviteDialog({
  open,
  onOpenChange,
  departments,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: string[];
}) {
  // No empId here: it's server-generated on invite acceptance — an org-configurable
  // prefix plus an atomic per-tenant sequence (COUNTER#emp_id) → "NS-0042". Never typed.
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "Member",
    department: "",
  });
  const set = (k: keyof typeof form) => (v: string) =>
    setForm((s) => ({ ...s, [k]: v }));

  // The invite message is personalised with whatever details are filled in.
  const greet = form.name.trim() ? `Hi ${form.name.trim().split(" ")[0]}, ` : "";
  const asRole = form.role ? ` as a ${form.role}` : "";
  const message = `${greet}you're invited to join ${organization.name} on WorkPulse${asRole}. Set up your account here: ${INVITE_LINK}`;

  const copyLink = () =>
    navigator.clipboard?.writeText(INVITE_LINK).then(
      () => toast.success("Invite link copied to clipboard"),
      () => toast.error("Couldn't copy the link"),
    );

  const shareSlack = () => {
    // Slack has no prefilled-share URL, so copy the message first, then deep-link
    // into the Slack app so the invite is ready to paste.
    navigator.clipboard?.writeText(message).catch(() => {});
    toast.success("Invite copied — opening Slack, just paste it in");
    window.open("slack://open", "_blank", "noopener,noreferrer");
  };

  const shareEmail = () => {
    if (!isEmail(form.email)) {
      toast.error("Enter a valid work email to send the invite.");
      return;
    }
    window.open(
      `mailto:${encodeURIComponent(form.email.trim())}?subject=${encodeURIComponent(
        `Join ${organization.name} on WorkPulse`,
      )}&body=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add employee</DialogTitle>
          <DialogDescription>
            Add their details, then invite them to {organization.name}.
          </DialogDescription>
        </DialogHeader>

        {/* 1 — Employee details */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name">
            <Input value={form.name} onChange={(e) => set("name")(e.target.value)} placeholder="Jordan Lee" />
          </Field>
          <Field label="Work email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email")(e.target.value)}
              placeholder="jordan@acme.test"
            />
          </Field>
          <Field label="Role">
            <Select value={form.role} onValueChange={(v) => set("role")(v as string)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Department">
              <Select value={form.department} onValueChange={(v) => set("department")(v as string)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">invite this employee</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        {/* 2 — Invite channels */}
        <div className="grid grid-cols-3 gap-2.5">
          <Channel
            onClick={shareEmail}
            icon={<Mail className="size-5" />}
            label="Email"
            tint="var(--feature-tint)"
            color="var(--primary)"
          />
          <Channel
            onClick={shareSlack}
            icon={<SlackIcon className="size-5" />}
            label="Slack"
            tint="color-mix(in srgb, #4A154B 16%, transparent)"
            color="#4A154B"
          />
          <Channel
            onClick={copyLink}
            icon={<Link2 className="size-5" />}
            label="Copy link"
            tint="var(--muted)"
            color="var(--foreground)"
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}

function Channel({
  onClick,
  icon,
  label,
  tint,
  color,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tint: string;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition-colors hover:bg-muted/50",
      )}
    >
      <span
        className="flex size-10 items-center justify-center rounded-full"
        style={{ background: tint, color }}
      >
        {icon}
      </span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
