"use client";

import { useState } from "react";
import {
  Copy,
  KeyRound,
  Lock,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useRolesStore } from "@/stores/roles.store";
import { usePermissions } from "@/hooks/use-permissions";
import { users } from "@/lib/data";
import { WILDCARD, ALL_PERMISSIONS } from "@/constants/permissions";
import type { Role } from "@/types/rbac";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RoleEditorDialog } from "./role-editor-dialog";

function userCountFor(roleId: string): number {
  return users.filter((u) => u.roleId === roleId).length;
}

function permissionCount(role: Role): number {
  return role.permissions.includes(WILDCARD)
    ? ALL_PERMISSIONS.length
    : role.permissions.length;
}

export function RolesManager() {
  const customRoles = useRolesStore((s) => s.customRoles);
  const cloneRole = useRolesStore((s) => s.cloneRole);
  const deleteRole = useRolesStore((s) => s.deleteRole);
  const roles = useRolesStore((s) => s.getAllRoles)();
  const { can } = usePermissions();
  const canManage = can("roles:manage");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);

  // Re-subscribe so cards update on custom-role changes.
  void customRoles;

  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (role: Role) => {
    setEditing(role);
    setEditorOpen(true);
  };

  const handleClone = (role: Role) => {
    const created = cloneRole(role.id, `Copy of ${role.name}`);
    if (created) {
      toast.success(`Cloned “${role.name}”.`);
      openEdit(created);
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteRole(deleteTarget.id);
    toast.success(`Role “${deleteTarget.name}” deleted.`);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description="Create roles and control what each can access. The sidebar and routes adapt to these permissions."
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" /> Create role
            </Button>
          ) : undefined
        }
      />

      <div className="overflow-hidden rounded-[1.4rem] bg-card shadow-soft">
        <table className="w-full caption-bottom text-sm">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="py-3 pl-6">Role</TableHead>
              <TableHead className="hidden py-3 md:table-cell">
                Description
              </TableHead>
              <TableHead className="py-3">Members</TableHead>
              <TableHead className="py-3 pr-6 md:pr-2">Permissions</TableHead>
              {canManage && <TableHead className="w-12 py-3 pr-4" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                {/* Role identity */}
                <TableCell className="py-3 pl-6">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <KeyRound className="size-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{role.name}</span>
                        {role.system ? (
                          <Lock
                            className="size-3.5 shrink-0 text-muted-foreground"
                            aria-label="System role"
                          />
                        ) : (
                          <Badge variant="outline" className="font-normal">
                            Custom
                          </Badge>
                        )}
                      </div>
                      {/* Description shown inline on small screens */}
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground md:hidden">
                        {role.description}
                      </p>
                    </div>
                  </div>
                </TableCell>

                {/* Description */}
                <TableCell className="hidden max-w-md py-3 whitespace-normal text-muted-foreground md:table-cell">
                  <span className="line-clamp-2">{role.description}</span>
                </TableCell>

                {/* Members */}
                <TableCell className="py-3">
                  <span className="inline-flex items-center gap-1.5 tabular-nums text-muted-foreground">
                    <Users className="size-4" />
                    {userCountFor(role.id)}
                  </span>
                </TableCell>

                {/* Permissions */}
                <TableCell className="py-3 pr-6 font-medium tabular-nums md:pr-2">
                  {role.permissions.includes(WILDCARD)
                    ? "All"
                    : permissionCount(role)}
                </TableCell>

                {/* Actions */}
                {canManage && (
                  <TableCell className="py-3 pr-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="ghost" size="icon" className="size-8" />
                        }
                      >
                        <MoreVertical className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleClone(role)}>
                          <Copy className="size-4" /> Clone
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={role.system}
                          onClick={() => openEdit(role)}
                        >
                          <Pencil className="size-4" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={role.system}
                          onClick={() => setDeleteTarget(role)}
                        >
                          <Trash2 className="size-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </table>
      </div>

      <RoleEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        role={editing}
      />

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete “{deleteTarget?.name}”? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
