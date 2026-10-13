"use client";

/**
 * Server sync for the org dashboard's widget layout (`identity::dashboard_layout`, LLD §3).
 *
 * Mounted once by `CustomizableDashboard`. The Zustand store (persisted to localStorage) stays the
 * **optimistic source of truth** — the UI never waits on the network.
 *
 * - **Hydrate:** on mount, `GET /v1/me/dashboard-layouts`; when a stored `oversight` layout decodes
 *   to something usable, it replaces the local layout (and remembers the server `version`) —
 *   **unless this device holds changes the server never confirmed** (`unsynced` in the store). Those
 *   are newer than the server's copy, so they are pushed instead of overwritten. No stored layout /
 *   missing oversight / any error → silently keep local/default (no crash, no toast).
 * - **Save:** any layout change (add/remove/reorder/reset) marks the layout `unsynced` and schedules
 *   a debounced `PUT /v1/me/dashboard-layouts/oversight` (1.5 s after the last change), so a drag
 *   sequence collapses into one write. Saves are serialized; a change landing mid-flight re-queues.
 *   Leaving the page **sends** a save still waiting out its debounce rather than dropping it.
 * - **Conflict:** a 409 (`version_conflict` — another tab/device wrote first) re-reads the fresh
 *   version and retries once with this tab's layout (last writer wins for the active tab).
 * - **Failure:** toast once per session, keep local state (still `unsynced`), push it again on the
 *   next change or the next visit — the user's layout is never lost. Before this, a save cut short
 *   by navigating away, a single failed PUT, or an edit made before the first read returned was
 *   overwritten by the server's older layout the next time the dashboard mounted (QA audit
 *   2026-10-08, WP-195).
 */
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { usePermissions } from "@/hooks/use-permissions";
import { isOwnerOf } from "@/hooks/use-features";
import { useAuthStore } from "@/stores/auth.store";
import { useDashboardStore, type DashboardWidget } from "@/stores/dashboard.store";
import {
  decodeLayout,
  encodeLayout,
  getDashboardLayouts,
  holdsWidgetPermission,
  putDashboardLayout,
} from "@/modules/dashboard/services/dashboard.service";

const SAVE_SETTLE_MS = 1500;

/** One whole-layout PUT; a 409 re-reads the version and retries once with this layout. */
async function attemptSave(
  layout: DashboardWidget[],
  allow: (w: DashboardWidget) => boolean,
  version: number,
) {
  const placements = encodeLayout(layout, allow);
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

export function useDashboardLayoutSync() {
  const widgets = useDashboardStore((s) => s.widgets);
  const { can } = usePermissions();
  const isOwner = useAuthStore(isOwnerOf);
  const perm = useAuthStore((s) => s.user?.perm);

  /**
   * Catalog `required_perm` pre-filter for the PUT: the server 403s a placement whose permission
   * the caller lacks, and one such widget fails the whole layout write. It mirrors the server's
   * exact bit (`holdsWidgetPermission`), not the coarser frontend id that the Team bits also light.
   * Kept in a ref so a role change never *triggers* a save — it only shapes the next one.
   */
  const allowRef = useRef<(w: DashboardWidget) => boolean>(() => true);
  allowRef.current = (w) => holdsWidgetPermission(w.type, { isOwner, perm }, can);

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

  /** Send the current layout now. Serialized: a call while a save is in flight re-runs after it. */
  const flush = useCallback(async () => {
    if (savingRef.current) {
      dirtyRef.current = true; // a save is in flight — run again when it finishes
      return;
    }
    savingRef.current = true;
    try {
      do {
        dirtyRef.current = false;
        const layout = useDashboardStore.getState().widgets;
        try {
          const saved = await attemptSave(layout, allowRef.current, versionRef.current);
          versionRef.current = saved.version;
          toastedRef.current = false;
          useDashboardStore.getState().markSynced(layout);
        } catch {
          if (!toastedRef.current) {
            toastedRef.current = true;
            toast.error("Couldn't sync your dashboard layout", {
              description:
                "Your layout is kept on this device and is saved again on your next change or visit.",
            });
          }
          break; // still `unsynced`; the next change or visit tries again
        }
      } while (dirtyRef.current);
    } finally {
      savingRef.current = false;
    }
  }, []);

  // ── Hydrate once per mount ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let pushLocal = false;
      try {
        const layouts = await getDashboardLayouts();
        if (cancelled) return;
        const oversight = layouts.oversight;
        if (oversight) {
          versionRef.current = oversight.version;
          if (useDashboardStore.getState().unsynced) {
            // Changes this device never got confirmed — including one made while this read was
            // in flight. Newer than the server's copy: push them rather than overwrite them.
            pushLocal = true;
          } else {
            const decoded = decodeLayout(oversight.widgets);
            if (decoded) {
              hydratedRef.current = decoded;
              useDashboardStore.getState().hydrate(decoded);
            }
          }
        }
      } catch {
        // No server layout (or the call failed) — keep the local/persisted layout. The next edit
        // will still try to save (and surface a toast if the API is genuinely down).
      } finally {
        if (!cancelled) readyRef.current = true;
      }
      if (pushLocal && !cancelled) void flush();
    })();
    return () => {
      cancelled = true;
      // Leaving the page **sends** a save still waiting out its debounce; cancelling it lost the
      // change to the server's older copy on the next visit.
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
        void flush();
      }
    };
  }, [flush]);

  // ── Save on settle ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Pre-hydration render: nothing is sent yet — an edit made now stays `unsynced` and is pushed
    // once the first read settles.
    if (!readyRef.current) return;
    if (hydratedRef.current === widgets) return; // this change *was* the hydration

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void flush();
    }, SAVE_SETTLE_MS);
  }, [widgets, flush]);
}
