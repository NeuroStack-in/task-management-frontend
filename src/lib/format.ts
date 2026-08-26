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

/** Two-letter uppercase initials from a full name. */
export function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
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

/** Seconds → HH:MM:SS. */
export function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
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

/** Hours (decimal) → "6h 12m". */
export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
