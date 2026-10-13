"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Lock, TriangleAlert } from "lucide-react";
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
import { serverIdsFromBitset } from "@/lib/permission-bits";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth.store";
import { useCurrentRole } from "@/hooks/use-permissions";
import type {
  ApiRole,
  ApiPermissionCatalog,
  RolePayload,
} from "../services/roles.service";
import { ROLE_NAME_MAX } from "../lib/role-names";

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

/** "Team" reach is the member's own department server-side (`attendance_oversight::reach`). */
const SCOPES = [
  { value: "self", label: "Self — only their own data", rank: 0 },
  { value: "team", label: "Team — their own department's data", rank: 1 },
  { value: "org", label: "Organization — everyone's data", rank: 2 },
];
const SCOPE_RANK: Record<string, number> = Object.fromEntries(SCOPES.map((s) => [s.value, s.rank]));

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

  // ── What the server will store, and what this caller may grant (WP-320) ──

  const user = useAuthStore((s) => s.user);
  const callerRole = useCurrentRole();
  const isOwner = user?.isOwner === true;

  /** id → the ids the server ORs in on save (the catalog's `implies`). */
  const impliesOf = useMemo(
    () =>
      new Map(
        (catalog?.groups ?? []).flatMap((g) => g.permissions.map((p) => [p.id, p.implies] as const)),
      ),
    [catalog],
  );
  const labelOf = useMemo(
    () =>
      new Map(
        (catalog?.groups ?? []).flatMap((g) => g.permissions.map((p) => [p.id, p.label] as const)),
      ),
    [catalog],
  );
  /** A set closed over `implies` — `PermSet::with_implied`, which the server applies on save. */
  const closure = useCallback(
    (ids: Iterable<string>) => {
      const out = new Set(ids);
      const queue = [...out];
      while (queue.length) {
        for (const imp of impliesOf.get(queue.pop() as string) ?? []) {
          if (!out.has(imp)) {
            out.add(imp);
            queue.push(imp);
          }
        }
      }
      return out;
    },
    [impliesOf],
  );

  /**
   * The escalation guard, client-side (`AuthContext::can_grant`): an owner may grant anything; anyone
   * else only privileges they hold — their token's bits, closed over `implies` as `AuthContext` does.
   * Contributor-only ids aren't privileges, so anyone may grant them. `null` = no verdict (a session
   * without the `perm` claim): offer everything and let the server decide.
   *
   * The editor used to offer every switch and a master "Select all" that was bound to 403 for every
   * non-owner, then answer with the generic permission sentence.
   */
  const grantable = useMemo(() => {
    if (isOwner) return null;
    const held = serverIdsFromBitset(user?.perm);
    if (!held) return null;
    const out = closure(held);
    for (const id of catalog?.contributorOnly ?? []) out.add(id);
    return out;
  }, [isOwner, user?.perm, closure, catalog]);
  const canGrant = (id: string) => grantable === null || grantable.has(id);

  /** What saving would store — the selection plus every prerequisite it brings along. */
  const effective = closure(selected);
  /** The selected permission that brings `id` along, if any — that switch is then fixed on. */
  const requiredBy = (id: string): string | null => {
    for (const s of selected) if (s !== id && closure([s]).has(id)) return s;
    return null;
  };

  /**
   * The server re-checks a role's **current** set before any edit (`update_role` → `may_manage`), so
   * a role carrying a permission this caller lacks can't be changed by them at all — rename included.
   */
  const cannotEdit = isEdit && (role?.permissions ?? []).some((id) => !canGrant(id));

  // The single master "Select all" that spans every section — distinct from each group's own
  // Select-all. Only over what this caller can grant; `allSelected` drives the label.
  const allPermissionIds = catalog?.groups.flatMap((g) => g.permissions.map((p) => p.id)) ?? [];
  const allGrantableIds = allPermissionIds.filter(canGrant);
  const allSelected =
    allGrantableIds.length > 0 && allGrantableIds.every((id) => effective.has(id));
  const toggleAll = () =>
    setSelected((prev) => {
      // Mirror `toggleGroup`: add/remove exactly these ids, leaving anything else untouched.
      const on = allGrantableIds.length > 0 && allGrantableIds.every((id) => closure(prev).has(id));
      const next = new Set(prev);
      allGrantableIds.forEach((id) => (on ? next.delete(id) : next.add(id)));
      return next;
    });

  /**
   * Scope is checked by no server guard yet, so the editor at least won't offer one wider than the
   * caller's own (WP-323). Owners have the whole organization.
   */
  const callerScopeRank = isOwner ? 2 : (SCOPE_RANK[callerRole?.scope ?? "org"] ?? 2);

  /**
   * Saving the caller's OWN role without "Manage roles & permissions" locks them — and everyone else
   * holding it — out of this page at their next sign-in, and only an owner can put it back (WP-510).
   */
  const losesRoleManagement =
    !isOwner &&
    Boolean(role && user && role.id === user.roleId) &&
    (role?.permissions ?? []).includes("roles:manage") &&
    !effective.has("roles:manage");

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Role name is required.");
      return;
    }
    if (trimmedName.length > ROLE_NAME_MAX) {
      toast.error(`Role name must be ${ROLE_NAME_MAX} characters or fewer.`);
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
    if (effective.size === 0) {
      toast.error("Select at least one permission for this role.");
      return;
    }

    const body: RolePayload = {
      name: trimmedName,
      description: description.trim(),
      scope,
      // The closed set — exactly what the server stores, and what the count above showed.
      permissions: [...effective],
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
      // surface its message rather than claiming success. Its 403 is a bare `forbidden`, which the
      // shared copy turns into "You don't have permission… Ask an admin" — to an admin. The only
      // thing that refuses a role save is the escalation guard, so name it.
      toast.error(
        e instanceof ApiError && e.status === 403
          ? "You can only grant permissions you hold yourself — and only change a role that carries none you don't."
          : e instanceof ApiError
            ? e.message
            : "Couldn't save the role. Try again.",
      );
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
              disabled={isSystem || cannotEdit}
            >
              <SelectTrigger className="w-full" aria-label="Data scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCOPES.map((s) => (
                  <SelectItem key={s.value} value={s.value} disabled={s.rank > callerScopeRank}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {callerScopeRank < 2 && !isSystem ? (
              <p className="text-xs text-muted-foreground">
                You can&apos;t give a role a wider data scope than your own.
              </p>
            ) : null}
          </div>

          {cannotEdit ? (
            <p className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              <Lock className="mt-px size-3.5 shrink-0" />
              This role carries permissions you don&apos;t hold yourself, so you can&apos;t change
              it. An owner can.
            </p>
          ) : null}

          <div className="flex items-center justify-between">
            <Label>Permissions</Label>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{effective.size} selected</Badge>
              {allGrantableIds.length > 0 && !cannotEdit && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={toggleAll}
                >
                  {allSelected ? "Clear all" : "Select all"}
                </Button>
              )}
            </div>
          </div>
        </div>

          {!catalog ? (
            <p className="border-t p-6 text-sm text-muted-foreground">Loading permissions…</p>
          ) : (
            <div className="divide-y border-t">
              {catalog.groups.map((group) => {
                const ids = group.permissions.map((p) => p.id).filter(canGrant);
                const allOn = ids.length > 0 && ids.every((id) => effective.has(id));
                return (
                  <div key={group.module} className="p-6">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-medium">{group.label}</p>
                      {ids.length > 0 && !cannotEdit ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => toggleGroup(ids, allOn)}
                        >
                          {allOn ? "Clear all" : "Select all"}
                        </Button>
                      ) : null}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {group.permissions.map((perm) => {
                        const by = requiredBy(perm.id);
                        const ungrantable = !canGrant(perm.id);
                        return (
                          <label
                            key={perm.id}
                            className={cn(
                              "flex items-center justify-between gap-2 rounded-md border p-2.5",
                              (ungrantable || by) && "opacity-70",
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block text-sm">{perm.label}</span>
                              <span className="block truncate font-mono text-[11px] text-muted-foreground">
                                {perm.id}
                              </span>
                              {by ? (
                                <span className="block text-[11px] text-muted-foreground">
                                  Included with “{labelOf.get(by) ?? by}”
                                </span>
                              ) : ungrantable ? (
                                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <Lock className="size-3" /> You don&apos;t hold this, so you
                                  can&apos;t grant it
                                </span>
                              ) : null}
                            </span>
                            <Switch
                              checked={effective.has(perm.id)}
                              disabled={cannotEdit || ungrantable || Boolean(by)}
                              onCheckedChange={() => toggle(perm.id)}
                              aria-label={perm.label}
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t p-6">
          {losesRoleManagement ? (
            <p className="flex items-start gap-2 text-xs text-warning sm:mr-auto sm:max-w-sm">
              <TriangleAlert className="mt-px size-3.5 shrink-0" />
              You hold this role. Without “Manage roles &amp; permissions” you — and everyone else
              with it — lose access to this page at your next sign-in, and only an owner can restore
              it.
            </p>
          ) : null}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !catalog || cannotEdit}
            variant={losesRoleManagement ? "destructive" : "default"}
          >
            {saving
              ? "Saving…"
              : losesRoleManagement
                ? "Save and lose access"
                : isEdit
                  ? "Save changes"
                  : "Create role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
