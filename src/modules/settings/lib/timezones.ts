/**
 * The organization timezone picker's data (UX audit 2026-10-16, SET-16).
 *
 * The picker offers **every IANA zone the browser knows** (`Intl.supportedValuesOf("timeZone")`). The
 * server reads the full IANA database too (`wp_platform::tz`, chrono-tz), old names and any letter
 * case included. Until 2026-10-20 it read a hand-kept table of ~80 zones and treated any other name as
 * UTC, so this module mirrored that table and the picker offered only those. A browser without
 * `Intl.supportedValuesOf` still gets {@link COMMON_ZONES}.
 *
 * Not a `"use client"` module: pure, so it is unit-tested directly.
 */

/** What the picker offers where the browser can't list its zones — the zones most orgs choose. */
export const COMMON_ZONES: readonly string[] = [
  "UTC",
  "Europe/London",
  "Europe/Dublin",
  "Europe/Lisbon",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/Rome",
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/Vienna",
  "Europe/Zurich",
  "Europe/Stockholm",
  "Europe/Oslo",
  "Europe/Copenhagen",
  "Europe/Warsaw",
  "Europe/Prague",
  "Europe/Budapest",
  "Africa/Lagos",
  "Europe/Athens",
  "Europe/Helsinki",
  "Europe/Bucharest",
  "Europe/Kyiv",
  "Africa/Johannesburg",
  "Europe/Istanbul",
  "Europe/Moscow",
  "Africa/Nairobi",
  "Asia/Riyadh",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Colombo",
  "Asia/Kathmandu",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Asia/Ho_Chi_Minh",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Manila",
  "Asia/Taipei",
  "Australia/Perth",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Darwin",
  "Australia/Adelaide",
  "Australia/Brisbane",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Hobart",
  "Pacific/Auckland",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "America/Halifax",
  "America/New_York",
  "America/Toronto",
  "America/Detroit",
  "America/Bogota",
  "America/Lima",
  "America/Chicago",
  "America/Winnipeg",
  "America/Mexico_City",
  "America/Denver",
  "America/Edmonton",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Vancouver",
  "America/Anchorage",
  "Pacific/Honolulu",
];

/**
 * Older names a browser may report — Chrome lists `Asia/Calcutta`, not `Asia/Kolkata` — mapped to
 * today's name, so the picker shows one entry per zone under the name people know. The server reads
 * both spellings, so a stored old name still works.
 */
const ALIASES: Record<string, string> = {
  "Etc/UTC": "UTC",
  "Etc/GMT": "UTC",
  GMT: "UTC",
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Rangoon": "Asia/Yangon",
  "Europe/Kiev": "Europe/Kyiv",
  "Atlantic/Faeroe": "Atlantic/Faroe",
  "America/Godthab": "America/Nuuk",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "America/Catamarca": "America/Argentina/Catamarca",
  "America/Cordoba": "America/Argentina/Cordoba",
  "America/Jujuy": "America/Argentina/Jujuy",
  "America/Mendoza": "America/Argentina/Mendoza",
  "America/Indianapolis": "America/Indiana/Indianapolis",
  "America/Louisville": "America/Kentucky/Louisville",
  "Pacific/Truk": "Pacific/Chuuk",
  "Pacific/Ponape": "Pacific/Pohnpei",
  "Pacific/Enderbury": "Pacific/Kanton",
  "Australia/Canberra": "Australia/Sydney",
};

/** Names known without asking the browser — for a runtime whose `Intl` can't check a zone. */
const KNOWN = new Set<string>([...COMMON_ZONES, ...Object.keys(ALIASES)]);

const zoneCheck = new Map<string, boolean>();

/**
 * Whether `tz` names an IANA zone. The browser's own database answers (any letter case, old names
 * included — as the server's does); an invalid name makes `Intl.DateTimeFormat` throw.
 */
function isIanaZone(tz: string): boolean {
  if (KNOWN.has(tz)) return true;
  const hit = zoneCheck.get(tz);
  if (hit !== undefined) return hit;
  let ok: boolean;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    // Newer engines also take a bare offset (`+05:30`); the fixed-offset check covers those.
    ok = /^[A-Za-z]/.test(tz);
  } catch {
    ok = false;
  }
  zoneCheck.set(tz, ok);
  return ok;
}

/** The zone the picker lists for `tz` — an alias folds onto its canonical name. */
export function canonicalZone(tz: string): string {
  return ALIASES[tz] ?? tz;
}

/**
 * A fixed-offset label as sign-up writes it — `(GMT+05:30) India Standard`, `(GMT−08:00) Pacific
 * Time`, `UTC+5`, `+0530` — mirroring `wp_platform::tz::fixed_offset` closely enough to tell a label
 * the server reads from one it doesn't.
 */
const FIXED_OFFSET = /(?:^|\b(?:GMT|UTC)\s*)([+\-−–])\s*(\d{1,2})(?::?(\d{2}))?/i;

/**
 * Whether the server turns this stored label into a real offset. `false` means attendance, lateness
 * and reports use **UTC** for the org — the unset case, and a name that isn't a timezone at all.
 */
export function serverResolves(label: string): boolean {
  const v = label.trim();
  if (!v) return false;
  if (isIanaZone(v)) return true;
  if (/^\(?\s*(GMT|UTC)\s*\)?(\s|$)/i.test(v) && !/[+\-−–]\s*\d/.test(v)) return true;
  const m = FIXED_OFFSET.exec(v);
  if (!m) return false;
  const hh = Number(m[2]);
  const mm = m[3] ? Number(m[3]) : 0;
  return hh <= 14 && mm < 60;
}

let zones: readonly string[] | null = null;

/**
 * The zones the picker offers: every zone the browser knows, old names folded onto today's (one entry
 * each), or {@link COMMON_ZONES} where the browser can't list them.
 */
export function pickerZones(): readonly string[] {
  if (!zones) {
    const all = browserZones();
    zones = all.length ? [...new Set(["UTC", ...all.map(canonicalZone)])] : COMMON_ZONES;
  }
  return zones;
}

/** Every IANA zone the browser knows, or `[]` where `Intl.supportedValuesOf` is missing. */
export function browserZones(): readonly string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    return typeof fn === "function" ? fn("timeZone") : [];
  } catch {
    return [];
  }
}

/** The browser's own zone (canonical), or `null` when it can't be read. */
export function browserZone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz ? canonicalZone(tz) : null;
  } catch {
    return null;
  }
}

const offsetCache = new Map<string, number | null>();

/**
 * The zone's UTC offset **right now**, in minutes (`330` for Kolkata), or `null` when the browser
 * can't format it. Display only — the server applies its own rules.
 */
export function currentOffsetMinutes(tz: string, now: Date = new Date()): number | null {
  const key = `${tz}|${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}`;
  if (offsetCache.has(key)) return offsetCache.get(key) ?? null;
  let out: number | null = null;
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" })
      .formatToParts(now)
      .find((p) => p.type === "timeZoneName")?.value;
    if (part) {
      const m = /GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?/.exec(part);
      if (m) out = m[1] ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0;
    }
  } catch {
    out = null;
  }
  offsetCache.set(key, out);
  return out;
}

/** `330` → `"UTC+5:30"`, `0` → `"UTC"`, `-480` → `"UTC−8"`. */
export function formatOffset(minutes: number | null): string {
  if (minutes === null) return "";
  if (minutes === 0) return "UTC";
  const sign = minutes < 0 ? "−" : "+";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

/** `America/Argentina/Buenos_Aires` → city `Buenos Aires`, region `America · Argentina`. */
export function zoneParts(tz: string): { city: string; region: string } {
  if (tz === "UTC") return { city: "UTC", region: "Coordinated Universal Time" };
  const parts = tz.split("/");
  const city = (parts.pop() ?? tz).replace(/_/g, " ");
  return { city, region: parts.join(" · ").replace(/_/g, " ") };
}

export interface ZoneOption {
  id: string;
  city: string;
  region: string;
  offset: number | null;
}

function option(id: string, now: Date): ZoneOption {
  return { id, ...zoneParts(id), offset: currentOffsetMinutes(id, now) };
}

const byOffsetThenCity = (a: ZoneOption, b: ZoneOption) =>
  (a.offset ?? 0) - (b.offset ?? 0) || a.city.localeCompare(b.city);

/**
 * What the picker lists for `query`: the zones that match, by offset, then city. Matches the zone id,
 * the city ("buenos"), and the offset ("+5:30", "utc-8").
 */
export function searchZones(
  query: string,
  { now = new Date(), zones = pickerZones() }: { now?: Date; zones?: readonly string[] } = {},
): ZoneOption[] {
  const q = query.trim().toLowerCase().replace(/−/g, "-");
  const matches = (o: ZoneOption) => {
    if (!q) return true;
    const offset = formatOffset(o.offset).toLowerCase().replace(/−/g, "-");
    return (
      o.id.toLowerCase().includes(q) ||
      o.city.toLowerCase().includes(q) ||
      (offset !== "" && (offset.includes(q) || offset.replace("utc", "gmt").includes(q)))
    );
  };
  return zones
    .map((z) => option(z, now))
    .filter(matches)
    .sort(byOffsetThenCity);
}
