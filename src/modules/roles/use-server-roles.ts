"use client";

/**
 * Pulls the org's roles from `GET /v1/roles` once per session and projects each one's server
 * permission bits onto this app's permission ids (`lib/permission-map.ts`), so the UI gate reflects
 * what the server will actually enforce.
 *
 * Mount this **once**, high in the authenticated tree — it lives in `DashboardShell`, next to the
 * appearance sync.
 *
 * ## The bug this fixes
 *
 * `useCurrentRole` resolved `user.roleId` against `SYSTEM_ROLES` + the localStorage-persisted
 * `wp-roles` store. A custom role created against the live server therefore resolved to `null`, and
 * `canAccess(null, …)` denies everything — so an admin could create a role, assign it, and the
 * member would sign in to an empty sidebar with every route blocked. The server would have let them
 * in; the UI would not.
 *
 * ## Failure behaviour
 *
 * A failed fetch is non-fatal: `useCurrentRole` falls back to the built-in system roles, which is
 * what shipped before and is correct for the three seeded roles that cover most users. A 403 is
 * expected for members without `roles:view` and is not treated as an error — they simply keep the
 * system-role fallback.
 */
import { useEffect, useRef } from "react";
import { ApiError } from "@/lib/api";
import { mapWirePermissions, unmappedWireIds } from "@/lib/permission-map";
import { useAuthStore } from "@/stores/auth.store";
import { useServerRolesStore } from "@/stores/server-roles.store";
import type { Role } from "@/types/rbac";
import { listRoles, type ApiRole } from "./services/roles.service";

export function useServerRolesSync(): void {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setRoles = useServerRolesStore((s) => s.setRoles);
  const setError = useServerRolesStore((s) => s.setError);
  const ran = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || ran.current) return;
    ran.current = true;

    let live = true;
    (async () => {
      try {
        const rows = await listRoles();
        if (!live) return;
        if (process.env.NODE_ENV !== "production") warnOnDrift(rows);
        setRoles(rows.map(toRole));
      } catch (e) {
        if (!live) return;
        // Without `roles:view` the server refuses the list. That's not a failure — it just means we
        // keep the system-role fallback for this member.
        setError(e instanceof ApiError && e.status === 403 ? null : messageOf(e));
      }
    })();

    return () => {
      live = false;
    };
  }, [isAuthenticated, setRoles, setError]);
}

function toRole(r: ApiRole): Role {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    system: r.system,
    permissions: mapWirePermissions(r.permissions, r.is_owner),
  };
}

/**
 * Shout in dev when the server grows a permission the map doesn't know. Silence here is how the two
 * vocabularies drifted apart before — a new server bit would simply never light up any UI.
 */
function warnOnDrift(rows: ApiRole[]): void {
  const unknown = new Set<string>();
  for (const r of rows) for (const id of unmappedWireIds(r.permissions)) unknown.add(id);
  if (unknown.size > 0) {
    console.warn(
      `[rbac] ${unknown.size} server permission id(s) have no entry in lib/permission-map.ts and ` +
        `will not unlock any UI: ${[...unknown].join(", ")}`,
    );
  }
}

function messageOf(e: unknown): string {
  return e instanceof ApiError ? e.message : "Couldn't load roles from the server.";
}
