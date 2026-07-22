import { create } from "zustand";
import { ApiError } from "@/lib/api";
import {
  getGeofence,
  updateGeofence,
} from "@/modules/insights/services/insights.service";
import { DEFAULT_GEOFENCE, type GeoPoint } from "@/modules/locations/types";

/**
 * The admin-configurable "location perimeter" — now **server-backed**
 * (`GET/PUT /v1/org/geofence`, `insights::geofence`).
 *
 * It used to be in-session only: it reset on every refresh and each admin saw their own fence, so
 * "inside/outside the office" meant something different per browser tab. It is now one org-wide
 * perimeter, readable by anyone who can see the Locations board (`activity:read:team`) and writable
 * only with `monitoring:manage`.
 *
 * **Visual only** (owner decision, 2026-07-22): the fence draws who is inside and who is outside.
 * Being outside raises no anomaly, no notification and no event.
 *
 * ## Two deliberate choices
 *
 * **Setters stay local and synchronous.** Dragging the perimeter has to track the cursor, so the
 * setters move local state only and `save()` is the single write — a drag is not a hundred PUTs.
 * That is also why editing is a mode in the board rather than always-on.
 *
 * **Coordinates convert here.** The API speaks `{ lat, lon }`, the map speaks `{ lat, lng }`. The
 * conversion lives at this boundary so no component has to know which convention it is holding —
 * the same rule `OversightPersonLocation` already follows.
 */
interface GeofenceState {
  center: GeoPoint;
  radiusM: number;
  enabled: boolean;
  /** Optimistic-lock counter from the server. `0` = never configured (serving the shipped default). */
  version: number;
  /**
   * Local edits not yet written. Drives the Save affordance — without it there is no way to tell a
   * dragged-but-unsaved perimeter from the saved one, and an admin would leave thinking the org sees
   * their change.
   */
  dirty: boolean;
  loading: boolean;
  saving: boolean;
  /** Last load/save failure, for the board to surface. `null` when the last call succeeded. */
  error: string | null;
  setCenter: (c: GeoPoint) => void;
  setRadius: (r: number) => void;
  setEnabled: (b: boolean) => void;
  reset: () => void;
  load: () => Promise<void>;
  save: () => Promise<boolean>;
}

export const useGeofenceStore = create<GeofenceState>((set, get) => ({
  center: DEFAULT_GEOFENCE.center,
  radiusM: DEFAULT_GEOFENCE.radiusM,
  enabled: true,
  version: 0,
  dirty: false,
  loading: false,
  saving: false,
  error: null,

  setCenter: (center) => set({ center, dirty: true }),
  setRadius: (radiusM) => set({ radiusM, dirty: true }),
  setEnabled: (enabled) => set({ enabled, dirty: true }),

  /**
   * Back to the shipped default, **locally**. Deliberately does not write: reset is an editing
   * affordance ("undo my dragging"), not a destructive org-wide action. It reaches everyone only if
   * the admin then saves.
   */
  reset: () =>
    set({
      center: DEFAULT_GEOFENCE.center,
      radiusM: DEFAULT_GEOFENCE.radiusM,
      dirty: true,
    }),

  load: async () => {
    set({ loading: true, error: null });
    try {
      const g = await getGeofence();
      set({
        center: { lat: g.center.lat, lng: g.center.lon },
        radiusM: g.radius_m,
        enabled: g.enabled,
        version: g.version,
        dirty: false,
        loading: false,
      });
    } catch {
      // The board still renders against the shipped default: a perimeter that failed to load is a
      // degraded backdrop, not a reason to hide everyone's location.
      set({ loading: false, error: "Couldn't load the office perimeter." });
    }
  },

  /** `true` on success. `false` leaves `error` set for the caller to surface. */
  save: async () => {
    const { center, radiusM, enabled, version } = get();
    set({ saving: true, error: null });
    try {
      const g = await updateGeofence({
        enabled,
        center: { lat: center.lat, lon: center.lng },
        radius_m: radiusM,
        version,
      });
      set({
        center: { lat: g.center.lat, lng: g.center.lon },
        radiusM: g.radius_m,
        enabled: g.enabled,
        version: g.version,
        dirty: false,
        saving: false,
      });
      return true;
    } catch (e) {
      // A 409 means another admin saved first. Telling them to reload is the honest instruction —
      // silently retrying with a bumped version would overwrite a change they never saw.
      const status = e instanceof ApiError ? e.status : 0;
      set({
        saving: false,
        error:
          status === 409
            ? "Someone else updated the perimeter. Reload to see their change."
            : status === 403
              ? "You don't have permission to change the office perimeter."
              : "Couldn't save the office perimeter.",
      });
      return false;
    }
  },
}));
