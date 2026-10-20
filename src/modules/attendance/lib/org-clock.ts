/**
 * The organization's wall clock — what time it is **where the org works**, not where the viewer is.
 *
 * Attendance is decided in the org's timezone: the nightly close runs at 23:59 org time and compares
 * a first session against the org's "Late after" in org time (`wp_platform::tz::OrgClock`). The
 * live Today view used the viewer's own clock for both, so an admin travelling, or working from
 * another office, saw people as late (or not yet late) by the wrong clock (UX audit 2026-10-16,
 * TIME-11).
 *
 * `ORG#meta.timezone` comes from two pickers that never agreed, and both forms are read here, as the
 * server reads them: a fixed-offset label — `(GMT+05:30) India Standard`, with an ASCII `-` or a
 * U+2212 minus in western ones — or an IANA name (`Asia/Kolkata`), resolved by the browser with
 * daylight saving. Absent or unreadable → the viewer's clock, said so through `zoned: false`.
 */

/** Minutes east of UTC for a fixed-offset label, or `null` when the label isn't one. */
export function fixedOffsetMinutes(label: string): number | null {
  const m = /GMT\s*([+\-−])\s*(\d{1,2}):?(\d{2})?/.exec(label);
  if (!m) return null;
  const sign = m[1] === "+" ? 1 : -1;
  const h = Number(m[2]);
  const min = Number(m[3] ?? "0");
  if (h > 14 || min > 59) return null;
  return sign * (h * 60 + min);
}

export interface OrgClock {
  /** The org's local date, `YYYY-MM-DD`. */
  date: string;
  /** The org's local time, `HH:MM` (24-hour) — compares lexically against a `late_threshold`. */
  hhmm: string;
  /** `true` when the org's own timezone was used; `false` = fell back to the viewer's clock. */
  zoned: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

function viewerClock(ms: number): OrgClock {
  const d = new Date(ms);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    hhmm: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    zoned: false,
  };
}

/** The org's clock at instant `ms`, from its timezone label. */
export function orgClockAt(label: string | null | undefined, ms: number): OrgClock {
  const tz = (label ?? "").trim();
  if (!tz) return viewerClock(ms);

  const fixed = fixedOffsetMinutes(tz);
  if (fixed !== null) {
    const d = new Date(ms + fixed * 60_000);
    return {
      date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
      hhmm: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
      zoned: true,
    };
  }

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(ms));
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    const hour = get("hour") === "24" ? "00" : get("hour");
    return {
      date: `${get("year")}-${get("month")}-${get("day")}`,
      hhmm: `${hour}:${get("minute")}`,
      zoned: true,
    };
  } catch {
    // Not a zone this browser knows — the viewer's clock, flagged as such.
    return viewerClock(ms);
  }
}

/**
 * Is it still before the org's "Late after" on `viewedDate`? Until then, someone with no session is
 * **not in yet**, not absent (TIME-11). A viewed day the org has already finished is over; one the
 * org hasn't reached yet hasn't started.
 */
export function beforeLateThreshold(
  clock: Pick<OrgClock, "date" | "hhmm">,
  viewedDate: string,
  lateThreshold: string,
): boolean {
  if (clock.date !== viewedDate) return clock.date < viewedDate;
  return clock.hhmm <= lateThreshold;
}
