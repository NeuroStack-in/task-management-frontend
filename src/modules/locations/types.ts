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

// ── derived status + work mode ───────────────────────────────────────────────
//
// Neither of these is a stored field: the backend serves positions, not states. Deriving them here
// (rather than inventing backend columns) keeps the server the source of *facts* and the client the
// source of *presentation* — and means neither filter can drift from the data it claims to describe.

/**
 * How recent a fix must be to count as "online" — **10 minutes**, the exact value the backend's
 * fleet page uses (`fleet::shared::device::ONLINE_WINDOW_MS`, 2× the agent's ~5-min heartbeat,
 * LLD §18).
 *
 * Deliberately the same number: two different definitions of "online" across two pages of the same
 * product is a support ticket waiting to happen ("Fleet says she's online, Locations says she
 * isn't").
 *
 * One honest nuance — location capture is **timer-gated** while the fleet heartbeat is not. So here
 * "online" means *actively tracked in the last 10 minutes*, which for a location board is the more
 * useful reading: someone signed in with no timer running has no business showing as a live pin.
 */
export const ONLINE_WINDOW_MS = 10 * 60 * 1000;

/**
 * Where an employee stands on the location board.
 *
 * - `online` — reported a fix inside the online window.
 * - `offline` — reported fixes today, but none recently.
 * - `untracked` — reported nothing at all today. **Not the same as offline**: it usually means the
 *   agent never ran or never got a position, which is why the board offers it separately rather than
 *   lumping "we know they stopped" together with "we never knew".
 */
export type LocationStatus = "online" | "offline" | "untracked";

export function deriveStatus(
  latestCapturedAt: number | null,
  fixCount: number,
  now: number,
): LocationStatus {
  if (latestCapturedAt === null || fixCount === 0) return "untracked";
  return now - latestCapturedAt <= ONLINE_WINDOW_MS ? "online" : "offline";
}

/**
 * Working from the office, or away from it.
 *
 * **Derived from the perimeter, not declared.** WorkPulse has no work-arrangement field — an
 * employee never states "I am remote today" — so this is inferred from where their latest fix sits
 * relative to the office geofence (owner decision, 2026-07-22). The UI labels it as derived for
 * exactly that reason: it answers "are they at the office right now", not "what is their contract".
 *
 * `null` when there is no fix to judge, or the perimeter is switched off — an unknown mode is shown
 * as unknown rather than defaulted to "remote", which would silently mark every untracked employee
 * as working from home.
 */
export type WorkMode = "in-office" | "remote";

export function deriveMode(
  point: GeoPoint | null,
  fence: Geofence,
  fenceEnabled: boolean,
): WorkMode | null {
  if (!point || !fenceEnabled) return null;
  return insidePerimeter(point, fence) ? "in-office" : "remote";
}

export const WORK_MODE_LABEL: Record<WorkMode, string> = {
  "in-office": "In office",
  remote: "Remote",
};

/**
 * Resolving "where were they at 14:30" deliberately does **not** live here.
 *
 * A pure "last position at or before t" helper used to. It was removed because it could not be made
 * correct in isolation: with the timer run 09:00–12:00 and again 14:00–15:00, it answered 14:02 with
 * the 11:55 position from the morning — a three-hour-old location presented as an afternoon one.
 * The answer depends on the day's timer sessions, so it lives in `employee-location.tsx` next to the
 * session data it needs (`positionInSession`).
 */
