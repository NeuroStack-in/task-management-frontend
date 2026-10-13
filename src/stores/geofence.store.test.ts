import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/insights/services/insights.service", () => ({
  getGeofence: vi.fn(),
  updateGeofence: vi.fn(),
}));

import { getGeofence } from "@/modules/insights/services/insights.service";
import { DEFAULT_GEOFENCE } from "@/modules/locations/types";
import { useGeofenceStore } from "./geofence.store";

const mockGet = vi.mocked(getGeofence);

/** The org's saved perimeter — Mumbai, a long way from the shipped placeholder. */
const SAVED = { enabled: true, center: { lat: 19.076, lon: 72.8777 }, radius_m: 400, version: 3 };

beforeEach(() => {
  mockGet.mockReset();
  mockGet.mockResolvedValue(SAVED);
  useGeofenceStore.setState({
    center: DEFAULT_GEOFENCE.center,
    radiusM: DEFAULT_GEOFENCE.radiusM,
    enabled: false,
    version: 0,
    dirty: false,
    saved: null,
    loading: false,
    saving: false,
    error: null,
  });
});

describe("geofence store", () => {
  /** Reset used to jump to the placeholder; Reset then Save moved the org's perimeter to Chennai. */
  it("resets to the saved perimeter, not the shipped placeholder", async () => {
    await useGeofenceStore.getState().load();
    useGeofenceStore.getState().setCenter({ lat: 19.2, lng: 72.9 });
    useGeofenceStore.getState().setRadius(900);
    expect(useGeofenceStore.getState().dirty).toBe(true);

    useGeofenceStore.getState().reset();

    const s = useGeofenceStore.getState();
    expect(s.center).toEqual({ lat: 19.076, lng: 72.8777 });
    expect(s.radiusM).toBe(400);
    expect(s.enabled).toBe(true);
    expect(s.dirty).toBe(false);
  });

  /** Opening an employee and coming back re-runs `load` — it must not discard a dragged pin. */
  it("keeps unsaved edits when the board loads again", async () => {
    await useGeofenceStore.getState().load();
    useGeofenceStore.getState().setCenter({ lat: 19.2, lng: 72.9 });

    await useGeofenceStore.getState().load();

    expect(useGeofenceStore.getState().center).toEqual({ lat: 19.2, lng: 72.9 });
    expect(useGeofenceStore.getState().dirty).toBe(true);
  });
});
