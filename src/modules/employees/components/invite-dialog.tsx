"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Link2, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
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

/** WhatsApp glyph (lucide has no brand mark). */
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35M12.05 21.79h-.01a9.87 9.87 0 01-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 01-1.51-5.26C2.16 6.99 6.6 2.56 12.05 2.56c2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 012.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.81 11.81 0 0012.05.5C5.5.5.16 5.83.16 12.39c0 2.1.55 4.14 1.59 5.95L.06 24.5l6.3-1.65a11.88 11.88 0 005.69 1.45h.01c6.55 0 11.89-5.34 11.89-11.9 0-3.18-1.24-6.17-3.49-8.41z" />
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

  const shareWhatsApp = () =>
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");

  const shareEmail = () =>
    window.open(
      `mailto:${encodeURIComponent(form.email.trim())}?subject=${encodeURIComponent(
        `Join ${organization.name} on WorkPulse`,
      )}&body=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite an employee</DialogTitle>
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
          <span className="text-xs text-muted-foreground">Send invite</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        {/* 2 — Invite channels */}
        <div className="grid grid-cols-3 gap-2.5">
          <Channel
            onClick={shareWhatsApp}
            icon={<WhatsAppIcon className="size-5" />}
            label="WhatsApp"
            tint="color-mix(in srgb, #25D366 16%, transparent)"
            color="#128C3E"
          />
          <Channel
            onClick={shareEmail}
            icon={<Mail className="size-5" />}
            label="Email"
            tint="var(--feature-tint)"
            color="var(--primary)"
          />
          <Channel
            onClick={copyLink}
            icon={<Link2 className="size-5" />}
            label="Share link"
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
