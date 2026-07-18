"use client";

/**
 * The org's departments and teams, from the real backend (`workforce` context, LLD §6).
 *
 * Reads `/v1/departments` and `/v1/teams` together (both gated on `employees:read`) so a team can be
 * shown under the department it belongs to. Mutations are thin pass-throughs that reload on success;
 * they throw `ApiError` so callers can surface the server's own message (e.g. the 409 raised when a
 * department still has teams).
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  listDepartments,
  listTeams,
  renameDepartment,
  deleteDepartment,
  renameTeam,
  deleteTeam,
  type ApiDepartment,
  type ApiTeam,
} from "./services/employees.service";

export interface OrgStructureData {
  departments: ApiDepartment[];
  teams: ApiTeam[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  renameDept: (id: string, name: string) => Promise<void>;
  removeDept: (id: string) => Promise<void>;
  renameTeamById: (id: string, name: string) => Promise<void>;
  removeTeam: (id: string) => Promise<void>;
}

export function useOrgStructure(enabled = true): OrgStructureData {
  const [departments, setDepartments] = useState<ApiDepartment[]>([]);
  const [teams, setTeams] = useState<ApiTeam[]>([]);
  // `settled` (not a plain `loading` flag) so the very first render — before the effect has had a
  // chance to run — already reads as loading rather than flashing an empty list.
  const [settled, setSettled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    setSettled(false);
    setError(null);

    (async () => {
      try {
        const [depts, allTeams] = await Promise.all([listDepartments(), listTeams()]);
        if (!live) return;
        setDepartments([...depts].sort((a, b) => a.name.localeCompare(b.name)));
        setTeams([...allTeams].sort((a, b) => a.name.localeCompare(b.name)));
      } catch (e) {
        if (live) setError(messageOf(e));
      } finally {
        if (live) setSettled(true);
      }
    })();

    return () => {
      live = false;
    };
  }, [nonce, enabled]);

  const renameDept = useCallback(
    async (id: string, name: string) => {
      await renameDepartment(id, name);
      reload();
    },
    [reload],
  );

  const removeDept = useCallback(
    async (id: string) => {
      await deleteDepartment(id);
      reload();
    },
    [reload],
  );

  const renameTeamById = useCallback(
    async (id: string, name: string) => {
      await renameTeam(id, name);
      reload();
    },
    [reload],
  );

  const removeTeam = useCallback(
    async (id: string) => {
      await deleteTeam(id);
      reload();
    },
    [reload],
  );

  return {
    departments,
    teams,
    loading: enabled && !settled,
    error,
    reload,
    renameDept,
    removeDept,
    renameTeamById,
    removeTeam,
  };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to departments and teams.";
    return e.message;
  }
  return "Couldn't load departments and teams. Check your connection and retry.";
}
