"use client";

import { useState } from "react";
import {
  Copy,
  Eye,
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
      />

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
          <span className="text-sm font-medium text-muted-foreground">
            {roles.length} role{roles.length === 1 ? "" : "s"}
          </span>
          {canManage ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" /> Create role
            </Button>
          ) : null}
        </div>
        <table className="w-full caption-bottom text-sm">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="py-2.5 pl-5">Role</TableHead>
              <TableHead className="hidden py-2.5 md:table-cell">
                Description
              </TableHead>
              <TableHead className="py-2.5 text-right">Members</TableHead>
              <TableHead className="py-2.5 pr-5 text-right md:pr-2">
                Permissions
              </TableHead>
              <TableHead className="w-10 py-2.5 pr-3" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow key={role.id}>
                {/* Role identity */}
                <TableCell className="py-2.5 pl-5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <KeyRound className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{role.name}</span>
                        <Badge
                          variant={role.system ? "secondary" : "outline"}
                          className="font-normal"
                        >
                          {role.system ? (
                            <>
                              <Lock className="size-3" /> System
                            </>
                          ) : (
                            "Custom"
                          )}
                        </Badge>
                      </div>
                      {/* Description shown inline on small screens */}
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground md:hidden">
                        {role.description}
                      </p>
                    </div>
                  </div>
                </TableCell>

                {/* Description */}
                <TableCell className="hidden max-w-md py-2.5 whitespace-normal text-muted-foreground md:table-cell">
                  <span className="line-clamp-2">{role.description}</span>
                </TableCell>

                {/* Members */}
                <TableCell className="py-2.5 text-right">
                  <span className="inline-flex items-center justify-end gap-1.5 tabular-nums text-muted-foreground">
                    <Users className="size-3.5" />
                    {userCountFor(role.id)}
                  </span>
                </TableCell>

                {/* Permissions */}
                <TableCell className="py-2.5 pr-5 text-right font-medium tabular-nums md:pr-2">
                  {role.permissions.includes(WILDCARD)
                    ? "All"
                    : permissionCount(role)}
                </TableCell>

                {/* Actions */}
                <TableCell className="py-2.5 pr-3 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={`Actions for ${role.name}`}
                        />
                      }
                    >
                      <MoreVertical className="size-4" aria-hidden />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {/* System roles are read-only: view their permissions. */}
                      {role.system ? (
                        <DropdownMenuItem onClick={() => openEdit(role)}>
                          <Eye className="size-4" /> View permissions
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          disabled={!canManage}
                          onClick={() => openEdit(role)}
                        >
                          <Pencil className="size-4" /> Edit
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        disabled={!canManage}
                        onClick={() => handleClone(role)}
                      >
                        <Copy className="size-4" /> Clone
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={!canManage || role.system}
                        onClick={() => setDeleteTarget(role)}
                      >
                        <Trash2 className="size-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
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
