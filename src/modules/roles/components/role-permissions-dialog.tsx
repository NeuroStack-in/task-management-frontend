"use client";

/**
 * A role's permissions, read-only (UX audit PEOPLE-17).
 *
 * The Roles list showed "Permissions 43" as a bare number, and the only way to see the 43 was the
 * editor — which a viewer without "Manage roles" cannot open, and which an admin opens at the risk
 * of changing something. This lists what the role grants, grouped as the editor groups them, with
 * the same plain-English line and sensitivity tag per permission.
 */
import Link from "next/link";
import { Lock, Pencil, ShieldAlert } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ApiPermissionCatalog, ApiRole } from "../services/roles.service";
import { SENSITIVITY_LABEL, helpFor } from "../lib/permission-help";
import { scopeLabel } from "../lib/role-change";

export function RolePermissionsDialog({
  role,
  catalog,
  memberCount,
  onOpenChange,
  onEdit,
}: {
  /** Open while set. */
  role: ApiRole | null;
  catalog: ApiPermissionCatalog | null;
  /** `null` when the directory couldn't be read. */
  memberCount: number | null;
  onOpenChange: (open: boolean) => void;
  /** Offered only to someone who may edit this role. */
  onEdit?: (role: ApiRole) => void;
}) {
  // Linked only for someone who can open it (UX audit SET-15) — the rail gates it on this.
  const canOpenOwnership = usePermissions().can("settings:manage");
  const granted = new Set(role?.permissions ?? []);
  const groups = (catalog?.groups ?? [])
    .map((g) => ({ ...g, permissions: g.permissions.filter((p) => granted.has(p.id)) }))
    .filter((g) => g.permissions.length > 0);
  // Ids the catalog doesn't list (a bit newer than this page) still show, by id.
  const known = new Set(groups.flatMap((g) => g.permissions.map((p) => p.id)));
  const unlisted = catalog ? [...granted].filter((id) => !known.has(id)) : [];

  return (
    <Dialog open={role !== null} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 border-b p-6">
          <DialogTitle>{role?.name} — permissions</DialogTitle>
          <DialogDescription>
            {role?.is_owner
              ? "Owners have every permission, including ones no role can hold: billing, transferring ownership and closing the organization."
              : `${granted.size} ${granted.size === 1 ? "permission" : "permissions"} · ${scopeLabel(role?.scope ?? "")}${
                  memberCount === null
                    ? ""
                    : ` · held by ${memberCount === 1 ? "1 person" : `${memberCount} people`}`
                }`}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {role?.is_owner ? (
            <p className="flex items-start gap-2 p-6 text-sm text-muted-foreground">
              <Lock className="mt-0.5 size-4 shrink-0" />
              <span>
                Ownership isn&apos;t a list of permissions, so there is nothing to edit here. Owners
                are added and removed under{" "}
                {canOpenOwnership ? (
                  <Link
                    href="/settings/ownership"
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    Settings → Ownership
                  </Link>
                ) : (
                  "Settings → Ownership"
                )}
                .
              </span>
            </p>
          ) : !catalog ? (
            <p className="p-6 text-sm text-muted-foreground">Loading permissions…</p>
          ) : granted.size === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">This role grants no permissions.</p>
          ) : (
            <div className="divide-y">
              {groups.map((g) => (
                <section key={g.module} className="p-6 py-4">
                  <h3 className="mb-2 text-sm font-medium">{g.label}</h3>
                  <ul className="space-y-2">
                    {g.permissions.map((p) => {
                      const help = helpFor(p.id);
                      return (
                        <li key={p.id} className="text-sm" title={p.id}>
                          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                            {p.label}
                            {help?.sensitive ? (
                              <span
                                className="inline-flex items-center gap-1 rounded-full bg-warning/12 px-1.5 py-px text-[10px] font-medium text-warning"
                                title={help.sensitive.reason}
                              >
                                <ShieldAlert className="size-3" aria-hidden />
                                {SENSITIVITY_LABEL[help.sensitive.kind]}
                              </span>
                            ) : null}
                          </span>
                          {help ? (
                            <span className="block text-xs leading-snug text-muted-foreground">
                              {help.description}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
              {unlisted.length ? (
                <section className="p-6 py-4">
                  <h3 className="mb-2 text-sm font-medium">Other</h3>
                  <p className="font-mono text-xs text-muted-foreground">{unlisted.join(" · ")}</p>
                </section>
              ) : null}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t p-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {role && onEdit && !role.is_owner ? (
            <Button onClick={() => onEdit(role)}>
              <Pencil className="size-4" /> Edit role
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
