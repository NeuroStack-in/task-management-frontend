"use client";

/**
 * Loads the real roles + permission catalog and exposes the write actions, each of which hits the
 * live endpoint and then reloads the list so the table reflects the server. Errors surface to the
 * caller (a toast) rather than being swallowed — a failed role write must not look like a success.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  listRoles,
  getPermissionCatalog,
  createRole,
  updateRole,
  deleteRole,
  cloneRole,
  restoreRole,
  type ApiRole,
  type ApiPermissionCatalog,
  type RolePayload,
} from "./services/roles.service";

export interface RolesState {
  roles: ApiRole[];
  catalog: ApiPermissionCatalog | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  create: (body: RolePayload) => Promise<ApiRole>;
  update: (id: string, body: RolePayload) => Promise<ApiRole>;
  remove: (id: string) => Promise<void>;
  clone: (id: string, name?: string) => Promise<ApiRole>;
  restore: (id: string) => Promise<ApiRole>;
}

export function useRoles(): RolesState {
  const [roles, setRoles] = useState<ApiRole[]>([]);
  const [catalog, setCatalog] = useState<ApiPermissionCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    Promise.all([listRoles(), catalog ? Promise.resolve(catalog) : getPermissionCatalog()])
      .then(([r, cat]) => {
        if (!live) return;
        setRoles(r);
        if (!catalog) setCatalog(cat);
      })
      .catch((e) => {
        if (live) setError(messageOf(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
    // `catalog` is intentionally not a dep — it's fetched once and reused across reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  const create = useCallback(
    async (body: RolePayload) => {
      const created = await createRole(body);
      reload();
      return created;
    },
    [reload],
  );

  const update = useCallback(
    async (id: string, body: RolePayload) => {
      const updated = await updateRole(id, body);
      reload();
      return updated;
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteRole(id);
      reload();
    },
    [reload],
  );

  const clone = useCallback(
    async (id: string, name?: string) => {
      const cloned = await cloneRole(id, name);
      reload();
      return cloned;
    },
    [reload],
  );

  const restore = useCallback(
    async (id: string) => {
      const restored = await restoreRole(id);
      reload();
      return restored;
    },
    [reload],
  );

  return { roles, catalog, loading, error, reload, create, update, remove, clone, restore };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to roles.";
    return e.message;
  }
  return "Couldn't load roles. Check your connection and retry.";
}
