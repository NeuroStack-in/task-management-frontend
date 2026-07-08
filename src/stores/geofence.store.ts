import { create } from "zustand";
import { OFFICE_GEOFENCE, type GeoPoint } from "@/lib/mock-locations";

/**
 * The admin-configurable "location perimeter" (Phase 1). Shared across the
 * Locations board and the per-employee view so both agree on the office fence.
 * In-session (not persisted) — a real backend would store this as GeoJSON.
 */
interface GeofenceState {
  center: GeoPoint;
  radiusM: number;
  enabled: boolean;
  setCenter: (c: GeoPoint) => void;
  setRadius: (r: number) => void;
  setEnabled: (b: boolean) => void;
  reset: () => void;
}

export const useGeofenceStore = create<GeofenceState>((set) => ({
  center: OFFICE_GEOFENCE.center,
  radiusM: OFFICE_GEOFENCE.radiusM,
  enabled: true,
  setCenter: (center) => set({ center }),
  setRadius: (radiusM) => set({ radiusM }),
  setEnabled: (enabled) => set({ enabled }),
  reset: () =>
    set({
      center: OFFICE_GEOFENCE.center,
      radiusM: OFFICE_GEOFENCE.radiusM,
    }),
}));
