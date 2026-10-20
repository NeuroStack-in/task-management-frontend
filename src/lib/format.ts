/** Formatting helpers usable from both server and client components. */

/**
 * True when `s` is a UUID (e.g. a Cognito `sub` / raw user id). Opaque UUIDs are never shown in the
 * UI — a display value that's a UUID should be suppressed or replaced with a human id (emp code,
 * project key). Accepts any hex-quad UUID shape, not just v4.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(s: string | null | undefined): boolean {
  return typeof s === "string" && UUID_RE.test(s.trim());
}

/**
 * Shown where a person's name belongs but the directory has no record — almost always an employee
 * who was deleted while a reference to them (a project membership, an enrolment code, a comp row)
 * survived.
 */
export const REMOVED_PERSON = "Removed employee";

/**
 * Neutral labels shown where an entity's name belongs but the id → name lookup couldn't resolve it
 * (the name map was empty — e.g. a viewer without `employees:view` — or the entity was deleted). A
 * raw opaque id (a `dept-…` / `01…` ULID) must never reach the UI; fall back to one of these instead.
 */
export const UNKNOWN_DEPARTMENT = "Unknown department";
export const UNKNOWN_TEAM = "Unknown team";
export const UNKNOWN_PROJECT = "Unknown project";
export const UNKNOWN_ROLE = "Unknown role";
export const UNKNOWN_TYPE = "Unknown type";

/**
 * A person's display name, guaranteed never to be a raw id.
 *
 * This is the enforcement of the `isUuid` policy above, which says a UUID must never reach the UI.
 * Several call sites wrote `directory.find(...)?.name ?? id` and so rendered a bare Cognito `sub`
 * the moment the person was gone — most visibly in the project-lead picker, which offered two raw
 * UUIDs as if they were people you could assign.
 *
 * The `isUuid` guard is deliberate belt-and-braces: even if a server ever hands back an id *as* a
 * name, it still will not render as one.
 */
export function personName(
  name: string | null | undefined,
  fallback: string = REMOVED_PERSON,
): string {
  const n = name?.trim();
  return n && !isUuid(n) ? n : fallback;
}

/**
 * Two-letter uppercase initials from a full name.
 *
 * Taken per **code point** (`Array.from`), not per UTF-16 unit: `part[0]` split an emoji or an astral
 * CJK character in half and the avatar drew a replacement glyph. Never `""` either — an empty string
 * switched the avatar's monogram off and left a blank circle (QA audit 2026-10-08, WP-547).
 */
export function initials(name: string): string {
  const out = name
    .split(/\s+/)
    .map((part) => Array.from(part)[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return out || "?";
}

/** Deterministic 32-bit FNV-1a hash of a string. */
function fnv1a(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * The WorkPulse "Gradient Monogram" avatar fill — a deterministic two-tone
 * diagonal gradient derived from a seed (a person's name or initials).
 * Same seed → same gradient. Returns a CSS `linear-gradient(...)` value meant
 * to sit behind white initials (see AvatarFallback). This is the default
 * avatar for anyone without an uploaded profile picture.
 */
export function monogramGradient(seed: string): string {
  const s = fnv1a(seed);
  const h = s % 360;
  const h2 = (h + 26) % 360;
  const angle = (s >>> 3) % 360;
  return `linear-gradient(${angle}deg, hsl(${h} 66% 56%), hsl(${h2} 70% 44%))`;
}

/**
 * Seconds → `HH:MM:SS`. **The one duration notation in the product** — see `formatHours`.
 *
 * Rounds and floors at zero before splitting, because callers now include `formatHours`, which
 * arrives via a float multiply (`6.8 * 3600` is `24480.000000000004`). Without that, a fractional
 * remainder renders as `06:48:0.000000004`.
 */
export function formatDuration(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * A `Date` as a **local** ISO day (`YYYY-MM-DD`) — the format every `DatePicker`/`Calendar`
 * `value`/`min`/`max` speaks.
 *
 * Deliberately not `toISOString().slice(0,10)`, which converts to UTC first and so reports
 * *tomorrow* for anyone east of UTC after their local evening (IST is +5:30) — which would let a
 * "no future dates" bound leak a day, and make "today" unselectable.
 */
export function isoDay(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today as a local ISO day. The bound for "no future dates" / floor for "no past dates". */
export function todayIso(): string {
  return isoDay(new Date());
}

/** Minutes/hours/days-ago label. */
export function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/**
 * Decimal hours → `HH:MM:SS`.
 *
 * ## Why this is not "6h 48m" any more
 *
 * The product reports the same elapsed time on several surfaces at once — a running timer, the day
 * it belongs to, the week that contains it — and it used to say each in whichever notation that
 * surface preferred. A card showing a live `02:28:05` above a `2.5h` total was reporting **one**
 * number twice, but `2:28` reads like "2.28", so the two looked like they disagreed. They never did;
 * the card was speaking two languages. One notation everywhere removes the question.
 *
 * `HH:MM:SS` is the one that survives, because it is the only one a *ticking* clock can also use.
 *
 * Most callers hold hours at minute precision (the server sends decimal hours), so the seconds place
 * is usually `00`. That is fine and deliberate — a stable column width is worth more here than
 * suppressing a field, and dropping it on some values would reintroduce exactly the two-notation
 * problem this exists to end.
 */
export function formatHours(hours: number): string {
  return formatDuration(hours * 3600);
}

/** Minutes → `HH:MM:SS`. The same notation, for the callers that count in minutes. */
export function formatMinutes(minutes: number): string {
  return formatDuration(minutes * 60);
}

/** `YYYY-MM-DD` → a local `Date` at midnight (never UTC, so no day shifts west of Greenwich). */
function localDay(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function asDate(value: string | number | Date): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") return Number.isFinite(value) ? new Date(value) : null;
  return localDay(value) ?? (Number.isNaN(Date.parse(value)) ? null : new Date(value));
}

/**
 * **The one date notation** (UX audit XC-06): "16 Oct 2026", or "Fri, 16 Oct 2026" with `weekday`,
 * in the viewer's locale (an en-US browser reads "Oct 16, 2026" — consistent for that viewer). Pages
 * used three styles at once ("Friday, 16 October 2026", "Oct 15, 2026", "2026-10-15").
 *
 * Takes a `YYYY-MM-DD` day (read as that calendar day, never shifted by time zone), epoch ms or a
 * `Date`. `year: false` drops the year for dates in the current year where space is tight.
 */
export function formatDate(
  value: string | number | Date,
  opts: { weekday?: boolean; year?: boolean } = {},
): string {
  const d = asDate(value);
  if (!d) return "—";
  return d.toLocaleDateString(undefined, {
    ...(opts.weekday ? { weekday: "short" as const } : {}),
    day: "numeric",
    month: "short",
    ...(opts.year === false ? {} : { year: "numeric" as const }),
  });
}

/** "16 Oct 2026, 14:05" — a moment, in the viewer's locale and clock. */
export function formatDateTime(value: number | Date): string {
  const d = asDate(value);
  if (!d) return "—";
  return `${formatDate(d)}, ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
}

/** "16 – 20 Oct 2026" / "28 Oct – 2 Nov 2026" / one day → that day. Inclusive `YYYY-MM-DD` bounds. */
export function formatDateRange(from: string, to: string): string {
  const a = localDay(from);
  const b = localDay(to);
  if (!a || !b) return "—";
  if (from === to) return formatDate(a);
  const sameYear = a.getFullYear() === b.getFullYear();
  return `${formatDate(a, { year: !sameYear })} – ${formatDate(b)}`;
}
