/**
 * Address → coordinates, via **Nominatim** (OpenStreetMap).
 *
 * Chosen because it needs no API key and no billing, and the app already renders OSM tiles through
 * maplibre — so this adds a lookup to a service the map is effectively already built on rather than
 * standing up a second vendor.
 *
 * **This sends text to a third party.** Whatever an admin types — an office address — leaves our
 * infrastructure and reaches `nominatim.openstreetmap.org`. Low sensitivity and entirely standard,
 * but it is a real egress and it should be a decision rather than a surprise.
 *
 * **Their usage policy is a hard constraint, not advice.** Nominatim asks for at most one request
 * per second and an identifying `User-Agent`, and blocks clients that ignore it. So:
 *
 *  - callers debounce ({@link GEOCODE_DEBOUNCE_MS}) rather than searching per keystroke,
 *  - identical queries are served from an in-memory cache,
 *  - and an in-flight request is aborted when a newer one supersedes it.
 *
 * A browser cannot set `User-Agent`, so the `Referer` the browser sends is what identifies us —
 * which is the documented browser-side expectation.
 */

export interface GeoResult {
  /** Human-readable address, for the suggestion row. */
  label: string;
  lat: number;
  lng: number;
}

/** Long enough that typing an address is one request, short enough to feel responsive. */
export const GEOCODE_DEBOUNCE_MS = 600;

/** Below this, a query matches half of Europe and the result is noise. */
const MIN_QUERY = 3;

/**
 * Session cache, keyed by the normalised query.
 *
 * An admin fixing a typo retypes the same address several times; without this each attempt is
 * another request against a rate limit measured in one-per-second.
 */
const cache = new Map<string, GeoResult[]>();

/**
 * Look up `query`. Returns `[]` for anything too short to be meaningful, and for any failure —
 * network, rate limit, malformed response.
 *
 * **Never throws.** This is a convenience on top of a map you can still click; a lookup that fails
 * should leave the admin dragging the pin, not staring at an error where suggestions belong.
 */
export async function geocode(
  query: string,
  signal?: AbortSignal,
): Promise<GeoResult[]> {
  const q = query.trim();
  if (q.length < MIN_QUERY) return [];

  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;

  try {
    const url =
      "https://nominatim.openstreetmap.org/search" +
      `?format=jsonv2&addressdetails=0&limit=5&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return [];
    const raw: unknown = await res.json();
    if (!Array.isArray(raw)) return [];

    const out: GeoResult[] = [];
    for (const r of raw) {
      const row = r as { display_name?: unknown; lat?: unknown; lon?: unknown };
      const lat = Number(row.lat);
      const lng = Number(row.lon);
      // A NaN coordinate would move the perimeter pin to nowhere and quietly break the map, so
      // anything unparseable is dropped rather than passed along.
      if (
        typeof row.display_name !== "string" ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        continue;
      }
      out.push({ label: row.display_name, lat, lng });
    }
    cache.set(key, out);
    return out;
  } catch {
    // Includes AbortError from a superseded keystroke, which is expected, not exceptional.
    return [];
  }
}
