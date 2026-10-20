/**
 * The organization timezone picker's data (UX audit 2026-10-16, SET-16).
 *
 * ## Why this is not simply every IANA zone
 *
 * The finding asked for the full IANA list. The browser has it (`Intl.supportedValuesOf`), but **the
 * server does not**: `wp_platform::tz::offset_minutes` resolves an IANA name from a hand-kept table
 * and treats any other name as unknown — the org's day then silently closes on **UTC**, so attendance,
 * lateness and every per-day report would be filed against the wrong day with nothing on screen to
 * say so. Offering a zone the server ignores is a promise the product can't keep, so the picker
 * offers {@link SERVER_ZONES} — a mirror of that table — and a search that finds any other zone says
 * plainly that it isn't supported yet instead of pretending to save it.
 *
 * When the server resolves every IANA zone (a full tz database instead of the table), return the
 * whole `Intl.supportedValuesOf("timeZone")` list from {@link pickerZones} and delete the mirror.
 *
 * Not a `"use client"` module: pure, so it is unit-tested directly.
 */

/**
 * The IANA zones `wp_platform::tz::ZONES` resolves — **keep in step with that table** (canonical
 * names only; the aliases it also reads are in {@link ALIASES}).
 */
export const SERVER_ZONES: readonly string[] = [
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

/** Older or alternative names a browser may report, mapped to the zone the picker lists. */
const ALIASES: Record<string, string> = {
  "Etc/UTC": "UTC",
  "Etc/GMT": "UTC",
  GMT: "UTC",
  "Asia/Calcutta": "Asia/Kolkata",
  "Europe/Kiev": "Europe/Kyiv",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "Australia/Canberra": "Australia/Sydney",
};

const SERVER_SET = new Set<string>([...SERVER_ZONES, ...Object.keys(ALIASES)]);

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
 * and reports use **UTC** for the org — the unset case, and a name the server's table doesn't hold.
 */
export function serverResolves(label: string): boolean {
  const v = label.trim();
  if (!v) return false;
  if (SERVER_SET.has(v)) return true;
  if (/^\(?\s*(GMT|UTC)\s*\)?(\s|$)/i.test(v) && !/[+\-−–]\s*\d/.test(v)) return true;
  const m = FIXED_OFFSET.exec(v);
  if (!m) return false;
  const hh = Number(m[2]);
  const mm = m[3] ? Number(m[3]) : 0;
  return hh <= 14 && mm < 60;
}

/** The zones the picker offers. See the module comment for why this is not every IANA zone. */
export function pickerZones(): readonly string[] {
  return SERVER_ZONES;
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
  /** `false` — the server can't resolve it yet; listed only so a search can say so. */
  supported: boolean;
}

function option(id: string, supported: boolean, now: Date): ZoneOption {
  return { id, ...zoneParts(id), offset: currentOffsetMinutes(id, now), supported };
}

const byOffsetThenCity = (a: ZoneOption, b: ZoneOption) =>
  (a.offset ?? 0) - (b.offset ?? 0) || a.city.localeCompare(b.city);

/**
 * What the picker lists for `query`: the supported zones that match, by offset, then — only while
 * searching — any other browser-known zone that matches, flagged unsupported. Matches the zone id, the
 * city ("buenos"), and the offset ("+5:30", "utc-8").
 */
export function searchZones(
  query: string,
  {
    now = new Date(),
    all = browserZones(),
    supported = pickerZones(),
  }: { now?: Date; all?: readonly string[]; supported?: readonly string[] } = {},
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
  const ok = supported.map((z) => option(z, true, now)).filter(matches).sort(byOffsetThenCity);
  if (!q) return ok;
  const known = new Set(supported.map(canonicalZone));
  const others = all
    .filter((z) => !known.has(canonicalZone(z)) && !SERVER_SET.has(z))
    .map((z) => option(z, false, now))
    .filter(matches)
    .sort(byOffsetThenCity);
  return [...ok, ...others];
}
