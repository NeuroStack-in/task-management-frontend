import { create } from "zustand";
import { DEFAULT_GEOFENCE, type GeoPoint } from "@/modules/locations/types";

/**
 * The admin-configurable "location perimeter". Shared across the Locations board and the
 * per-employee view so both agree on the office fence. In-session (not persisted) — a real backend
 * would store this as GeoJSON (there is no geofence-config route yet, so it lives client-side).
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
  center: DEFAULT_GEOFENCE.center,
  radiusM: DEFAULT_GEOFENCE.radiusM,
  enabled: true,
  setCenter: (center) => set({ center }),
  setRadius: (radiusM) => set({ radiusM }),
  setEnabled: (enabled) => set({ enabled }),
  reset: () =>
    set({
      center: DEFAULT_GEOFENCE.center,
      radiusM: DEFAULT_GEOFENCE.radiusM,
    }),
}));
