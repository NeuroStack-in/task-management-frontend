"use client";

/**
 * Server-persisted dashboard layout — `GET/PUT /v1/me/dashboard-layouts` (LLD §3).
 *
 * Owns the optimistic-lock dance so callers don't have to:
 * - Load holds the server's `version` per dashboard.
 * - `save(kind, widgets)` PUTs with that version and adopts the version the server returns.
 * - On **409** it does *not* retry. It reloads the server's copy, replaces local state with it, and
 *   raises {@link DashboardLayoutState.conflict} so the UI can tell the user their layout was
 *   changed elsewhere — silently overwriting the other tab's save is the one thing the version
 *   guard exists to prevent.
 *
 * `layouts.oversight` being `undefined` means the user has no oversight dashboard at all (no
 * oversight permission bit), which is different from an oversight dashboard with no widgets.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  getDashboardLayouts,
  saveDashboardLayout,
  isVersionConflict,
  type ApiDashboardLayouts,
  type ApiWidgetPlacement,
  type DashboardKind,
} from "@/modules/dashboard/services/dashboard-layout.service";

export interface DashboardLayoutState {
  data: ApiDashboardLayouts | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** True while a PUT is in flight. */
  saving: boolean;
  /**
   * Set when a save lost the version race. `data` has already been replaced with the server's copy;
   * the UI should surface this and let the user redo their change. Cleared by the next save attempt
   * or {@link dismissConflict}.
   */
  conflict: string | null;
  dismissConflict: () => void;
  /** Persist one dashboard. Resolves `true` on success, `false` if it hit a version conflict. */
  save: (kind: DashboardKind, widgets: ApiWidgetPlacement[]) => Promise<boolean>;
}

const CONFLICT_MESSAGE =
  "Your dashboard was updated in another tab or device, so this layout wasn't saved. We've loaded the latest version — reapply your changes and try again.";

export function useDashboardLayout(): DashboardLayoutState {
  const [data, setData] = useState<ApiDashboardLayouts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await getDashboardLayouts(controller.signal);
        if (live) setData(res);
      } catch (e) {
        if (live && !isAbort(e)) setError(messageOf(e));
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
      controller.abort();
    };
  }, [nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const dismissConflict = useCallback(() => setConflict(null), []);

  const save = useCallback(
    async (kind: DashboardKind, widgets: ApiWidgetPlacement[]) => {
      const current = kind === "personal" ? data?.personal : data?.oversight;
      // Version 0 is the legitimate "never saved" starting point, so a missing layout still saves.
      const version = current?.version ?? 0;

      setSaving(true);
      setConflict(null);
      setError(null);
      try {
        const saved = await saveDashboardLayout(kind, { widgets, version });
        setData((prev) => (prev ? { ...prev, [kind]: saved } : prev));
        return true;
      } catch (e) {
        if (isVersionConflict(e)) {
          // Someone else won the race: take the server's copy, don't clobber it.
          try {
            const fresh = await getDashboardLayouts();
            setData(fresh);
          } catch {
            // If the reload also fails, the conflict message still stands; a manual reload can retry.
          }
          setConflict(CONFLICT_MESSAGE);
          return false;
        }
        setError(messageOf(e));
        return false;
      } finally {
        setSaving(false);
      }
    },
    [data],
  );

  return {
    data,
    loading,
    error,
    reload,
    saving,
    conflict,
    dismissConflict,
    save,
  };
}

function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to that dashboard.";
    return e.message;
  }
  return "Couldn't reach the dashboard layout service.";
}
