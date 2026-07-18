/** Formatting helpers usable from both server and client components. */

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

/** Minutes/hours/days-ago label. */
export function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
