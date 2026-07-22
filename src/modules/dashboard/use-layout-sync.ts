"use client";

/**
 * Server sync for the org dashboard's widget layout (`identity::dashboard_layout`, LLD §3).
 *
 * Mounted once by `CustomizableDashboard`. The Zustand store (persisted to localStorage) stays the
 * **optimistic source of truth** — the UI never waits on the network.
 *
 * - **Hydrate:** on mount, `GET /v1/me/dashboard-layouts`; when a stored `oversight` layout decodes
 *   to something usable, it replaces the local layout (and remembers the server `version`). No
 *   stored layout / missing oversight / any error → silently keep local/default (honest
 *   degradation, no crash, no toast).
 * - **Save:** any layout change after hydration settles (add/remove/reorder/reset) schedules a
 *   debounced `PUT /v1/me/dashboard-layouts/oversight` (1.5 s after the last change), so a drag
 *   sequence collapses into one write. Saves are serialized; a change landing mid-flight re-queues.
 * - **Conflict:** a 409 (`version_conflict` — another tab/device wrote first) re-reads the fresh
 *   version and retries once with this tab's layout (last writer wins for the active tab).
 * - **Failure:** toast once per session, keep local state — the user's layout is never lost.
 */
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { usePermissions } from "@/hooks/use-permissions";
import { useDashboardStore, type DashboardWidget } from "@/stores/dashboard.store";
import {
  decodeLayout,
  encodeLayout,
  getDashboardLayouts,
  putDashboardLayout,
  widgetPermission,
} from "@/modules/dashboard/services/dashboard.service";

const SAVE_SETTLE_MS = 1500;

export function useDashboardLayoutSync() {
  const widgets = useDashboardStore((s) => s.widgets);
  const { can } = usePermissions();

  /**
   * Catalog `required_perm` pre-filter for the PUT: the server 403s a placement whose permission
   * the caller lacks, and one such widget fails the whole layout write. Kept in a ref so a role
   * change never *triggers* a save — it only shapes the next one.
   */
  const allowRef = useRef<(w: DashboardWidget) => boolean>(() => true);
  allowRef.current = (w) => can(widgetPermission(w.type));

  /** The `version` the server last confirmed (optimistic-lock token for the next PUT). */
  const versionRef = useRef(0);
  /** Hydration attempt finished (success or failure) — saves are held until then. */
  const readyRef = useRef(false);
  /** The widget array hydration installed — that store change must not trigger a save. */
  const hydratedRef = useRef<DashboardWidget[] | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const dirtyRef = useRef(false);
  const toastedRef = useRef(false);

  // ── Hydrate once per mount ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const layouts = await getDashboardLayouts();
        if (cancelled) return;
        const oversight = layouts.oversight;
        if (oversight) {
          versionRef.current = oversight.version;
          const decoded = decodeLayout(oversight.widgets);
          if (decoded) {
            hydratedRef.current = decoded;
            useDashboardStore.getState().hydrate(decoded);
          }
        }
      } catch {
        // No server layout (or the call failed) — keep the local/persisted layout. The next edit
        // will still try to save (and surface a toast if the API is genuinely down).
      } finally {
        if (!cancelled) readyRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // ── Save on settle ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!readyRef.current) return; // pre-hydration render — nothing the user did
    if (hydratedRef.current === widgets) return; // this change *was* the hydration

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void flush();
    }, SAVE_SETTLE_MS);

    async function flush() {
      if (savingRef.current) {
        dirtyRef.current = true; // a save is in flight — run again when it finishes
        return;
      }
      savingRef.current = true;
      const layout = useDashboardStore.getState().widgets;
      try {
        const saved = await attemptSave(layout, versionRef.current);
        versionRef.current = saved.version;
        toastedRef.current = false;
      } catch {
        if (!toastedRef.current) {
          toastedRef.current = true;
          toast.error("Couldn't sync your dashboard layout", {
            description: "Your changes are kept on this device and will retry on the next edit.",
          });
        }
      } finally {
        savingRef.current = false;
        if (dirtyRef.current) {
          dirtyRef.current = false;
          void flush();
        }
      }
    }

    async function attemptSave(layout: DashboardWidget[], version: number) {
      const placements = encodeLayout(layout, allowRef.current);
      try {
        return await putDashboardLayout("oversight", {
          widgets: placements,
          version,
        });
      } catch (e) {
        // Version conflict (another tab/device saved first): re-read the current version and
        // retry once — this tab's layout wins.
        if (e instanceof ApiError && e.status === 409) {
          const fresh = await getDashboardLayouts();
          const current = fresh.oversight?.version ?? 0;
          return await putDashboardLayout("oversight", {
            widgets: placements,
            version: current,
          });
        }
        throw e;
      }
    }
  }, [widgets]);
}
