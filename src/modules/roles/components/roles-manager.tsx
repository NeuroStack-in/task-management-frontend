"use client";

import { Fragment, useMemo, useState } from "react";
import {
  Copy,
  Eye,
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
import { ApiError } from "@/lib/api";
import { friendlyError } from "@/lib/errors";
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { RoleMembers } from "./role-members";
import { RolePermissionsDialog } from "./role-permissions-dialog";
import { useRoles } from "../use-roles";
import { cloneName } from "../lib/role-names";
import type { ApiRole } from "../services/roles.service";
import type { ApiEmployee } from "@/modules/employees/services/employees.service";

/** Owner grants everything via `is_owner`, not a counted bitset — show "All", not a number. */
function permissionLabel(role: ApiRole): string {
  if (role.is_owner) return "All";
  return String(role.permissions.length);
}

/**
 * The permission count, as the way into the role's read-only permission list (UX audit PEOPLE-17).
 * It was a bare number — the only way to see what "43" meant was the editor, which a viewer without
 * "Manage roles" can't open.
 */
function PermissionsButton({ role, onView }: { role: ApiRole; onView: (role: ApiRole) => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 h-7 gap-1.5 px-2 font-medium tabular-nums"
      aria-label={
        role.is_owner
          ? `${role.name}: every permission — view`
          : `${role.name}: view its ${role.permissions.length} permissions`
      }
      onClick={() => onView(role)}
    >
      {permissionLabel(role)}
      <Eye className="size-3.5 text-muted-foreground" aria-hidden />
    </Button>
  );
}

/** "Couldn't <verb> “X”" in the terms the server actually refused for (WP-327). */
function roleActionError(e: unknown, role: ApiRole, verb: "clone" | "restore" | "delete"): string {
  const name = `“${role.name}”`;
  if (e instanceof ApiError) {
    if (e.status === 403) {
      return verb === "restore"
        ? `You can't restore ${name}: its default permissions include some you don't hold yourself.`
        : `You can't ${verb} ${name}: it carries permissions you don't hold yourself.`;
    }
    if (e.status === 409 && e.code === "role_in_use") {
      return `${name} is still held by someone. Move its members to another role first.`;
    }
    // Restoring a built-in role: a 404 here is the route, not the role — the role is right there.
    if (e.status === 404) {
      return verb === "restore"
        ? "Restoring defaults isn't available right now. Try again later."
        : `${name} no longer exists — it may have been deleted elsewhere.`;
    }
  }
  return friendlyError(e, `Couldn't ${verb} ${name}. Try again.`);
}

export function RolesManager() {
  const { roles, catalog, loading, error, reload, create, update, remove, clone, restore } =
    useRoles();
  const { can } = usePermissions();
  const canManage = can("roles:manage");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ApiRole | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApiRole | null>(null);
  /** Restoring overwrites every edit to a system role, for everyone holding it — confirmed (XC-07). */
  const [restoreTarget, setRestoreTarget] = useState<ApiRole | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [busy, setBusy] = useState(false);
  /** Which role's member list is expanded — one at a time; this is a table, not an accordion set. */
  const [openRole, setOpenRole] = useState<string | null>(null);
  /** The role whose permissions are open read-only (PEOPLE-17). */
  const [viewing, setViewing] = useState<ApiRole | null>(null);

  /** Permission id → the catalog's label, for the role-change summary (PEOPLE-09). */
  const labelById = useMemo(
    () =>
      new Map(
        (catalog?.groups ?? []).flatMap((g) => g.permissions.map((p) => [p.id, p.label] as const)),
      ),
    [catalog],
  );
  const labelOf = (id: string) => labelById.get(id) ?? id;

  /**
   * Membership comes from the directory, not a new endpoint: `GET /v1/employees` already returns
   * `role_id` per person and `useDirectory` caches it, so the count costs nothing extra.
   *
   * Bumping `dirVersion` after an assignment re-mounts the hook against the invalidated cache —
   * the roster has to be re-read, or the counts would contradict the move just made.
   */
  const [dirVersion, setDirVersion] = useState(0);
  const {
    employees,
    loading: dirLoading,
    error: dirError,
  } = useDirectory(canManage || can("employees:view"), dirVersion);
  /** The roster was read, so a member count is a fact — not a "0" standing in for "unknown". */
  const membersKnown = !dirLoading && !dirError && employees.length > 0;
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

  /** How many hold the role being deleted — `null` when the roster couldn't be read (PEOPLE-17). */
  const deleteHolders =
    deleteTarget && membersKnown ? (membersByRole.get(deleteTarget.id)?.length ?? 0) : null;

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
    const name = cloneName(role.name, roles);
    try {
      // A built-in role is copied from what this row shows — the org's own version of it. The clone
      // route copies the built-in *code default* instead, so an org that had trimmed Admin got the
      // full default set (or a 403) under a row reading 12 (WP-321). A custom role's stored set is
      // what the row shows, so it keeps the clone route.
      const created = role.system
        ? await create({
            name,
            description: role.description,
            scope: role.scope,
            permissions: role.permissions,
          })
        : await clone(role.id, name);
      toast.success(`Cloned “${role.name}” as “${created.name}”.`);
      openEdit(created);
    } catch (e) {
      toast.error(roleActionError(e, role, "clone"));
    }
  };

  const handleRestore = async (role: ApiRole) => {
    setRestoring(true);
    try {
      await restore(role.id);
      toast.success(`“${role.name}” restored to its default permissions.`);
      setRestoreTarget(null);
    } catch (e) {
      toast.error(roleActionError(e, role, "restore"));
    } finally {
      setRestoring(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await remove(deleteTarget.id);
      toast.success(`Role “${deleteTarget.name}” deleted.`);
      setDeleteTarget(null);
    } catch (e) {
      // It said "It may still be assigned to someone" whatever happened — including a 403 for a role
      // richer than the caller, right under a member list reading "No one holds this role" (WP-327).
      toast.error(roleActionError(e, deleteTarget, "delete"));
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
            // From `sm` up only: on a phone the top bar never wraps, and this squeezed its title to
            // "S…" (UX audit XC-04). The phone gets the same button in the page, just below.
            <Button onClick={openCreate} className="hidden sm:inline-flex">
              <Plus className="size-4" /> Create role
            </Button>
          ) : undefined
        }
      />
      {canManage ? (
        <Button onClick={openCreate} className="w-full sm:hidden">
          <Plus className="size-4" /> Create role
        </Button>
      ) : null}

      {/* Below `sm` a card per role, with its menu inside: the table was clipped by `overflow-hidden`,
          so on a phone Scope, Members, Permissions and the ⋮ menu were off-screen and unreachable
          (UX audit PEOPLE-03). The table keeps a scrolling wrapper as a backstop at every width. */}
      <ul data-tour="roles:list" className="space-y-3 sm:hidden">
        {roles.map((role) => {
          const members = membersByRole.get(role.id) ?? [];
          const expanded = openRole === role.id;
          return (
            <li key={role.id} className="overflow-hidden rounded-[1.4rem] bg-card shadow-soft">
              <div className="flex items-start gap-3 p-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <KeyRound className="size-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{role.name}</span>
                    <RoleKindBadge role={role} />
                  </div>
                  {role.description ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">{role.description}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Scope</span>
                      <Badge variant="outline" className="font-normal capitalize">
                        {role.scope}
                      </Badge>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Permissions</span>
                      <PermissionsButton role={role} onView={setViewing} />
                    </span>
                  </div>
                </div>
                {canManage ? (
                  <RoleActionsMenu
                    role={role}
                    onView={setViewing}
                    onClone={handleClone}
                    onEdit={openEdit}
                    onRestore={setRestoreTarget}
                    onDelete={setDeleteTarget}
                  />
                ) : null}
              </div>
              <button
                type="button"
                className="flex w-full items-center justify-between border-t px-4 py-2.5 text-sm font-medium"
                aria-expanded={expanded}
                onClick={() => setOpenRole(expanded ? null : role.id)}
              >
                <span>
                  {members.length} {members.length === 1 ? "member" : "members"}
                </span>
                <ChevronDown
                  className={cn("size-4 text-muted-foreground transition-transform", expanded && "rotate-180")}
                />
              </button>
              {expanded ? (
                <div className="border-t">
                  <RoleMembers
                    role={role}
                    members={members}
                    roles={roles}
                    canManage={canManage}
                    onChanged={refreshMembers}
                    labelOf={labelOf}
                  />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>

      {/* A named, focusable scroll region, so the columns past the edge are reachable without a
          swipe (UX audit PEOPLE-14, axe `scrollable-region-focusable`). */}
      <div
        data-tour="roles:list"
        role="region"
        aria-label="Roles"
        tabIndex={0}
        className="hidden overflow-x-auto rounded-[1.4rem] bg-card shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:block"
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
                        <RoleKindBadge role={role} />
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
                    // The count alone was the name ("3, collapsed") — say whose (WP-513).
                    aria-label={`${role.name}: ${members.length} ${members.length === 1 ? "member" : "members"}`}
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

                <TableCell className="py-3 pr-6 md:pr-2">
                  <PermissionsButton role={role} onView={setViewing} />
                </TableCell>

                {canManage && (
                  <TableCell className="py-3 pr-4 text-right">
                    <RoleActionsMenu
                      role={role}
                      onView={setViewing}
                      onClone={handleClone}
                      onEdit={openEdit}
                      onRestore={setRestoreTarget}
                      onDelete={setDeleteTarget}
                    />
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
                      labelOf={labelOf}
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
        // Who a save would change access for (PEOPLE-06). `null` when the directory can't be read,
        // so the editor says nothing rather than "0 people".
        memberCount={
          editing && membersKnown ? (membersByRole.get(editing.id)?.length ?? 0) : null
        }
        onCreate={create}
        onUpdate={update}
      />

      {/* The delete dialog says who holds the role (UX audit PEOPLE-17). It asked "Are you sure?"
          whatever the member count, and a held role then failed with a toast — the server refuses
          to delete a role anyone holds (`role_in_use`), because they would be left with no access
          at all. Now a held role can't be confirmed, and the dialog leads to its member list. */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{deleteTarget?.name}”?</DialogTitle>
            <DialogDescription>
              {deleteHolders === null
                ? "Who holds this role couldn't be checked. If anyone still does, the delete is refused and nothing changes. Deleting a role can't be undone."
                : deleteHolders > 0
                  ? `${deleteHolders === 1 ? "1 person holds" : `${deleteHolders} people hold`} this role, so it can't be deleted — they would be left with no access at all. Change their role first; deactivated people count too.`
                  : "No one holds this role, so no one loses access. Deleting it can't be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            {deleteHolders !== null && deleteHolders > 0 ? (
              <Button
                onClick={() => {
                  if (deleteTarget) setOpenRole(deleteTarget.id);
                  setDeleteTarget(null);
                }}
              >
                Show who holds it
              </Button>
            ) : (
              <Button variant="destructive" disabled={busy} onClick={confirmDelete}>
                {busy ? "Deleting…" : "Delete role"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RolePermissionsDialog
        role={viewing}
        catalog={catalog}
        memberCount={
          viewing && membersKnown ? (membersByRole.get(viewing.id)?.length ?? 0) : null
        }
        onOpenChange={(o) => !o && setViewing(null)}
        onEdit={
          canManage
            ? (role) => {
                setViewing(null);
                openEdit(role);
              }
            : undefined
        }
      />

      <ConfirmDialog
        open={restoreTarget !== null}
        onOpenChange={(o) => !o && setRestoreTarget(null)}
        title={`Restore “${restoreTarget?.name ?? ""}” to its defaults?`}
        description="Every change made to this role's permissions is undone, and it applies at once to everyone who has the role — they may gain or lose access to pages and actions."
        confirmLabel="Restore defaults"
        busy={restoring}
        onConfirm={() => restoreTarget && void handleRestore(restoreTarget)}
      />
    </div>
  );
}

function RoleKindBadge({ role }: { role: ApiRole }) {
  return (
    <Badge variant={role.system ? "secondary" : "outline"} className="font-normal">
      {role.system ? (
        <>
          <Lock className="size-3" /> Default
        </>
      ) : (
        "Custom"
      )}
    </Badge>
  );
}

/** One role's ⋮ menu — the same actions in the desktop table row and the phone card. */
function RoleActionsMenu({
  role,
  onView,
  onClone,
  onEdit,
  onRestore,
  onDelete,
}: {
  role: ApiRole;
  onView: (role: ApiRole) => void;
  onClone: (role: ApiRole) => void;
  onEdit: (role: ApiRole) => void;
  onRestore: (role: ApiRole) => void;
  onDelete: (role: ApiRole) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label={`Actions for ${role.name}`}
          />
        }
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      {/* `w-auto` overrides the primitive's default `w-(--anchor-width)`, which pins the
          menu to the 32px icon trigger and made "Restore to default" wrap onto two
          lines. Let it size to its widest item instead, with a sane floor. */}
      <DropdownMenuContent align="end" className="w-auto min-w-[10rem]">
        <DropdownMenuItem onClick={() => onView(role)}>
          <Eye className="size-4" /> View permissions
        </DropdownMenuItem>
        {/* Not for Owner: its access is `is_owner`, outside the bitset, so a copy
            holds one inert permission and nothing else (WP-321). */}
        <DropdownMenuItem disabled={role.is_owner} onClick={() => onClone(role)}>
          <Copy className="size-4" /> Clone
        </DropdownMenuItem>
        {/* Owner isn't editable — it bypasses every permission check. Admin/Employee
            (and custom roles) are. */}
        <DropdownMenuItem disabled={role.is_owner} onClick={() => onEdit(role)}>
          <Pencil className="size-4" /> Edit
        </DropdownMenuItem>
        {role.system && !role.is_owner ? (
          <DropdownMenuItem onClick={() => onRestore(role)}>
            <RotateCcw className="size-4" /> Restore to default
          </DropdownMenuItem>
        ) : null}
        {/* Set the destructive action apart from the routine ones. */}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={role.system}
          onClick={() => onDelete(role)}
        >
          <Trash2 className="size-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
