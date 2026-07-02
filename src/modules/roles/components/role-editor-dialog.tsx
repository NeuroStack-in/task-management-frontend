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
import { ScrollArea } from "@/components/ui/scroll-area";
import { PERMISSION_CATEGORIES } from "@/constants/permissions";
import { SYSTEM_ROLES } from "@/constants/roles";
import { useRolesStore } from "@/stores/roles.store";
import type { PermissionId, Role } from "@/types/rbac";

interface RoleEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the dialog edits this role; otherwise it creates a new one. */
  role?: Role | null;
}

export function RoleEditorDialog({
  open,
  onOpenChange,
  role,
}: RoleEditorDialogProps) {
  const createRole = useRolesStore((s) => s.createRole);
  const updateRole = useRolesStore((s) => s.updateRole);
  const customRoles = useRolesStore((s) => s.customRoles);

  const isEdit = Boolean(role);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<PermissionId>>(new Set());

  // Reset form whenever the dialog opens or the target role changes.
  useEffect(() => {
    if (!open) return;
    setName(role?.name ?? "");
    setDescription(role?.description ?? "");
    setSelected(new Set(role?.permissions ?? []));
  }, [open, role]);

  const toggle = (id: PermissionId) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleCategory = (ids: PermissionId[], allOn: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
      return next;
    });

  const handleSave = () => {
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
    // No two roles (system or custom) may share a name — case-insensitive,
    // excluding the role currently being edited.
    const nameTaken = [...SYSTEM_ROLES, ...customRoles].some(
      (r) =>
        r.id !== role?.id &&
        r.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    );
    if (nameTaken) {
      toast.error(`A role named “${trimmedName}” already exists.`);
      return;
    }
    if (selected.size === 0) {
      toast.error("Select at least one permission for this role.");
      return;
    }
    const permissions = [...selected];
    const desc = description.trim();
    if (isEdit && role) {
      updateRole(role.id, { name: trimmedName, description: desc, permissions });
      toast.success(`Role “${trimmedName}” updated.`);
    } else {
      createRole({ name: trimmedName, description: desc, permissions });
      toast.success(`Role “${trimmedName}” created.`);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b p-6">
          <DialogTitle>{isEdit ? "Edit role" : "Create role"}</DialogTitle>
          <DialogDescription>
            Define a name and the permissions this role grants.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Team Lead"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-desc">Description</Label>
              <Input
                id="role-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short summary"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label>Permissions</Label>
            <Badge variant="secondary">{selected.size} selected</Badge>
          </div>
        </div>

        <ScrollArea className="max-h-[42vh] border-t">
          <div className="divide-y">
            {PERMISSION_CATEGORIES.map((cat) => {
              const ids = cat.permissions.map((p) => p.id);
              const allOn = ids.every((id) => selected.has(id));
              return (
                <div key={cat.module} className="p-6">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium">{cat.label}</p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => toggleCategory(ids, allOn)}
                    >
                      {allOn ? "Clear all" : "Select all"}
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {cat.permissions.map((perm) => (
                      <label
                        key={perm.id}
                        className="flex items-center justify-between gap-2 rounded-md border p-2.5"
                      >
                        <span className="text-sm">{perm.label}</span>
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
        </ScrollArea>

        <DialogFooter className="border-t p-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {isEdit ? "Save changes" : "Create role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
