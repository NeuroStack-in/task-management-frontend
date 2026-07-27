"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import type {
  ApiRole,
  ApiPermissionCatalog,
  RolePayload,
} from "../services/roles.service";

interface RoleEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the dialog edits this role; otherwise it creates a new one. */
  role?: ApiRole | null;
  /** The server permission catalog (groups). Null while still loading. */
  catalog: ApiPermissionCatalog | null;
  /** For a client-side name-collision hint; the server is the real uniqueness guard. */
  existingRoles: ApiRole[];
  onCreate: (body: RolePayload) => Promise<ApiRole>;
  onUpdate: (id: string, body: RolePayload) => Promise<ApiRole>;
}

const SCOPES = [
  { value: "self", label: "Self — only their own data" },
  { value: "team", label: "Team — their team's data" },
  { value: "org", label: "Organization — everyone's data" },
];

export function RoleEditorDialog({
  open,
  onOpenChange,
  role,
  catalog,
  existingRoles,
  onCreate,
  onUpdate,
}: RoleEditorDialogProps) {
  const isEdit = Boolean(role);
  // A default role (Admin/Employee) — its name/scope are canonical; only permissions are editable.
  const isSystem = Boolean(role?.system && !role?.is_owner);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scope, setScope] = useState("self");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Reset form whenever the dialog opens or the target role changes.
  useEffect(() => {
    if (!open) return;
    setName(role?.name ?? "");
    setDescription(role?.description ?? "");
    setScope(role?.scope ?? "self");
    setSelected(new Set(role?.permissions ?? []));
  }, [open, role]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleGroup = (ids: string[], allOn: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
      return next;
    });

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Role name is required.");
      return;
    }
    if (trimmedName.length > 40) {
      toast.error("Role name must be 40 characters or fewer.");
      return;
    }
    if (description.trim().length > 200) {
      toast.error("Description must be 200 characters or fewer.");
      return;
    }
    const nameTaken = existingRoles.some(
      (r) => r.id !== role?.id && r.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    );
    if (nameTaken) {
      toast.error(`A role named “${trimmedName}” already exists.`);
      return;
    }
    if (selected.size === 0) {
      toast.error("Select at least one permission for this role.");
      return;
    }

    const body: RolePayload = {
      name: trimmedName,
      description: description.trim(),
      scope,
      permissions: [...selected],
    };
    setSaving(true);
    try {
      if (isEdit && role) {
        await onUpdate(role.id, body);
        toast.success(`Role “${trimmedName}” updated.`);
      } else {
        await onCreate(body);
        toast.success(`Role “${trimmedName}” created.`);
      }
      onOpenChange(false);
    } catch (e) {
      // The server enforces the real rules (name uniqueness, valid ids, no privilege escalation) —
      // surface its message rather than claiming success.
      toast.error(e instanceof ApiError ? e.message : "Couldn't save the role. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b p-6">
          <DialogTitle>
            {isSystem ? `Edit ${role?.name} role` : isEdit ? "Edit role" : "Create role"}
          </DialogTitle>
          <DialogDescription>
            {isSystem
              ? "This is a default role — its name and scope are fixed. Adjust which permissions it grants; use “Restore to default” to reset."
              : "Define a name, data scope, and the permissions this role grants."}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable body: form fields + permission groups. Header and footer
            stay pinned so the action buttons are always visible. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Team Lead"
                disabled={isSystem}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-desc">Description</Label>
              <Input
                id="role-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short summary"
                disabled={isSystem}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Data scope</Label>
            <Select
              value={scope}
              onValueChange={(v) => setScope(v as string)}
              items={Object.fromEntries(SCOPES.map((s) => [s.value, s.label]))}
              disabled={isSystem}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label>Permissions</Label>
            <Badge variant="secondary">{selected.size} selected</Badge>
          </div>
        </div>

          {!catalog ? (
            <p className="border-t p-6 text-sm text-muted-foreground">Loading permissions…</p>
          ) : (
            <div className="divide-y border-t">
              {catalog.groups.map((group) => {
                const ids = group.permissions.map((p) => p.id);
                const allOn = ids.length > 0 && ids.every((id) => selected.has(id));
                return (
                  <div key={group.module} className="p-6">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-medium">{group.label}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => toggleGroup(ids, allOn)}
                      >
                        {allOn ? "Clear all" : "Select all"}
                      </Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {group.permissions.map((perm) => (
                        <label
                          key={perm.id}
                          className="flex items-center justify-between gap-2 rounded-md border p-2.5"
                        >
                          <span className="min-w-0">
                            <span className="block text-sm">{perm.label}</span>
                            <span className="block truncate font-mono text-[11px] text-muted-foreground">
                              {perm.id}
                            </span>
                          </span>
                          <Switch
                            checked={selected.has(perm.id)}
                            onCheckedChange={() => toggle(perm.id)}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t p-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !catalog}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
