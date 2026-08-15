"use client";

import { Fragment, useMemo, useState } from "react";
import {
  Copy,
  KeyRound,
  Lock,
  ChevronDown,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/use-permissions";
import { invalidateDirectory, useDirectory } from "@/hooks/use-directory";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/shared/loader";
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
  DropdownMenuSeparator,
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
import { RoleMembers } from "./role-members";
import { useRoles } from "../use-roles";
import type { ApiRole } from "../services/roles.service";
import type { ApiEmployee } from "@/modules/employees/services/employees.service";

/** Owner grants everything via `is_owner`, not a counted bitset — show "All", not a number. */
function permissionLabel(role: ApiRole): string {
  if (role.is_owner) return "All";
  return String(role.permissions.length);
}

export function RolesManager() {
  const { roles, catalog, loading, error, reload, create, update, remove, clone, restore } =
    useRoles();
  const { can } = usePermissions();
  const canManage = can("roles:manage");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ApiRole | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiRole | null>(null);
  const [busy, setBusy] = useState(false);
  /** Which role's member list is expanded — one at a time; this is a table, not an accordion set. */
  const [openRole, setOpenRole] = useState<string | null>(null);

  /**
   * Membership comes from the directory, not a new endpoint: `GET /v1/employees` already returns
   * `role_id` per person and `useDirectory` caches it, so the count costs nothing extra.
   *
   * Bumping `dirVersion` after an assignment re-mounts the hook against the invalidated cache —
   * the roster has to be re-read, or the counts would contradict the move just made.
   */
  const [dirVersion, setDirVersion] = useState(0);
  const { employees } = useDirectory(canManage || can("employees:view"), dirVersion);
  const membersByRole = useMemo(() => {
    const m = new Map<string, ApiEmployee[]>();
    for (const e of employees) {
      // Only people who can actually hold a role; a row with no `role_id` is not "unassigned",
      // it is a record the directory could not resolve, and guessing would inflate a count.
      if (!e.role_id) continue;
      const list = m.get(e.role_id);
      if (list) list.push(e);
      else m.set(e.role_id, [e]);
    }
    for (const list of m.values()) list.sort((a, b) => a.name.localeCompare(b.name));
    return m;
  }, [employees]);

  const refreshMembers = () => {
    invalidateDirectory();
    setDirVersion((v) => v + 1);
  };

  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const openEdit = (role: ApiRole) => {
    setEditing(role);
    setEditorOpen(true);
  };

  const handleClone = async (role: ApiRole) => {
    try {
      const created = await clone(role.id, `Copy of ${role.name}`);
      toast.success(`Cloned “${role.name}”.`);
      openEdit(created);
    } catch {
      toast.error("Couldn't clone the role. Try again.");
    }
  };

  const handleRestore = async (role: ApiRole) => {
    try {
      await restore(role.id);
      toast.success(`“${role.name}” restored to its default permissions.`);
    } catch {
      toast.error("Couldn't restore the role. Try again.");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await remove(deleteTarget.id);
      toast.success(`Role “${deleteTarget.name}” deleted.`);
      setDeleteTarget(null);
    } catch {
      toast.error("Couldn't delete the role. It may still be assigned to someone.");
    } finally {
      setBusy(false);
    }
  };

  if (loading && roles.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader label="Loading roles…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Roles & Permissions" description="Roles and what each can access." />
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description="Create roles and control what each can access. Changes take effect on the server; a member's own view updates at their next sign-in."
        actions={
          canManage ? (
            <Button onClick={openCreate}>
              <Plus className="size-4" /> Create role
            </Button>
          ) : undefined
        }
      />

      <div
        data-tour="roles:list"
        className="overflow-hidden rounded-[1.4rem] bg-card shadow-soft"
      >
        <table className="w-full caption-bottom text-sm">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="py-3 pl-6">Role</TableHead>
              <TableHead className="hidden py-3 md:table-cell">Description</TableHead>
              <TableHead className="py-3">Scope</TableHead>
              <TableHead className="py-3">Members</TableHead>
              <TableHead className="py-3 pr-6 md:pr-2">Permissions</TableHead>
              {canManage && <TableHead className="w-12 py-3 pr-4" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => {
              const members = membersByRole.get(role.id) ?? [];
              const expanded = openRole === role.id;
              return (
              <Fragment key={role.id}>
              <TableRow>
                <TableCell className="py-3 pl-6">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <KeyRound className="size-4.5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{role.name}</span>
                        <Badge variant={role.system ? "secondary" : "outline"} className="font-normal">
                          {role.system ? (
                            <>
                              <Lock className="size-3" /> Default
                            </>
                          ) : (
                            "Custom"
                          )}
                        </Badge>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground md:hidden">
                        {role.description}
                      </p>
                    </div>
                  </div>
                </TableCell>

                <TableCell className="hidden max-w-md py-3 whitespace-normal text-muted-foreground md:table-cell">
                  <span className="line-clamp-2">{role.description}</span>
                </TableCell>

                <TableCell className="py-3">
                  <Badge variant="outline" className="font-normal capitalize">
                    {role.scope}
                  </Badge>
                </TableCell>

                <TableCell className="py-3">
                  {/* A count that opens the list. Knowing a role is held by four people is useful;
                      knowing *which* four is what saves the trip to Employees — and it is what tells
                      you whether a role can be deleted before the delete fails. */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="-ml-2 h-7 gap-1.5 px-2 font-medium tabular-nums"
                    aria-expanded={expanded}
                    onClick={() => setOpenRole(expanded ? null : role.id)}
                  >
                    {members.length}
                    <ChevronDown
                      className={cn(
                        "size-3.5 transition-transform",
                        expanded && "rotate-180",
                      )}
                    />
                  </Button>
                </TableCell>

                <TableCell className="py-3 pr-6 font-medium tabular-nums md:pr-2">
                  {permissionLabel(role)}
                </TableCell>

                {canManage && (
                  <TableCell className="py-3 pr-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={<Button variant="ghost" size="icon" className="size-8" />}
                      >
                        <MoreVertical className="size-4" />
                      </DropdownMenuTrigger>
                      {/* `w-auto` overrides the primitive's default `w-(--anchor-width)`, which pins the
                          menu to the 32px icon trigger and made "Restore to default" wrap onto two
                          lines. Let it size to its widest item instead, with a sane floor. */}
                      <DropdownMenuContent align="end" className="w-auto min-w-[10rem]">
                        <DropdownMenuItem onClick={() => handleClone(role)}>
                          <Copy className="size-4" /> Clone
                        </DropdownMenuItem>
                        {/* Owner isn't editable — it bypasses every permission check. Admin/Employee
                            (and custom roles) are. */}
                        <DropdownMenuItem
                          disabled={role.is_owner}
                          onClick={() => openEdit(role)}
                        >
                          <Pencil className="size-4" /> Edit
                        </DropdownMenuItem>
                        {role.system && !role.is_owner ? (
                          <DropdownMenuItem onClick={() => handleRestore(role)}>
                            <RotateCcw className="size-4" /> Restore to default
                          </DropdownMenuItem>
                        ) : null}
                        {/* Set the destructive action apart from the routine ones. */}
                        <DropdownMenuSeparator />
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

              {expanded ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={canManage ? 6 : 5} className="p-0">
                    <RoleMembers
                      role={role}
                      members={members}
                      roles={roles}
                      canManage={canManage}
                      onChanged={refreshMembers}
                    />
                  </TableCell>
                </TableRow>
              ) : null}
              </Fragment>
              );
            })}
          </TableBody>
        </table>
      </div>

      <RoleEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        role={editing}
        catalog={catalog}
        existingRoles={roles}
        onCreate={create}
        onUpdate={update}
      />

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete “{deleteTarget?.name}”? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={busy} onClick={confirmDelete}>
              {busy ? "Deleting…" : "Delete role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
