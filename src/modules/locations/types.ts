/**
 * Location primitives — the pure geo types + helpers shared across the locations module and the
 * Insights › Location page. These replace the geo half of the old `lib/mock-locations.ts`; they
 * carry **no fabricated employee data**, only math a real backend (PostGIS `ST_DWithin` / Turf)
 * would replace unchanged.
 *
 * Note the coordinate convention: the map component uses `{ lat, lng }`, while the backend serves
 * `{ lat, lon }` — callers converting an API `LocationPoint` map `lon → lng`.
 */

export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * A circular "location perimeter". A real backend would store this as GeoJSON; here it's a center +
 * radius, which is all the office-fence UX needs.
 */
export interface Geofence {
  center: GeoPoint;
  radiusM: number;
}

/**
 * A sensible default map center + fence for a fresh session (Chennai / Thoraipakkam), used only to
 * seed the client-side perimeter tool until an admin moves it. Not employee data.
 */
export const DEFAULT_GEOFENCE: Geofence = {
  center: { lat: 12.9424, lng: 80.2411 },
  radiusM: 250,
};

/** Great-circle distance in metres (haversine). Pure. */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** THE authoritative in/out check — the one pure function a server would replace unchanged. */
export function insidePerimeter(point: GeoPoint, fence: Geofence): boolean {
  return distanceMeters(point, fence.center) <= fence.radiusM;
}
