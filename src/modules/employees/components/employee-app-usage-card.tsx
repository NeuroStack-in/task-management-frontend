"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppWindow } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";

import { ApiError } from "@/lib/api";
import { formatMinutes } from "@/lib/format";
import {
  getUserAppUsage,
  type AppUsage,
  type AppUsageRow,
} from "@/modules/insights/services/insights.service";

/**
 * The day this org began recording **per-person** app usage.
 *
 * Mirrors `PER_PERSON_APPS_SINCE` in `crates/assistant/.../tools.rs` and the rollout note in
 * `ingest::shared::keys::user_app_day_key`. It exists so an empty panel can say *which* kind of
 * empty it is: before this date the ingest fold summed apps into three category buckets and threw
 * the names away, so there is nothing to show and nothing to backfill. Rendering a bare "No
 * activity" over that period would state something false about a person's work.
 */
const TRACKING_SINCE = "2026-08-27";

/**
 * Seconds → `HH:MM:SS`, rounded to the whole minute first.
 *
 * The rounding stays: app time is sampled, so a second-precision figure would imply a precision the
 * sampling does not have. Only the notation changed — the seconds place reads `00` here, and that
 * is the honest answer rather than an invented one.
 */
function dur(seconds: number): string {
  return formatMinutes(Math.round(seconds / 60));
}

/** A neutral grey at `pct`% ink — the ramp Analytics → Activity uses for app rules. */
const ink = (pct: number) => `color-mix(in srgb, var(--foreground) ${pct}%, var(--card))`;

/**
 * The org's **app-rule** category, as one neutral grey stepped by lightness — never green "good" or
 * amber "bad" (UX audit 2026-10-16, XC-08 / MON-07). The category comes from the app's *name*, and
 * the owner's decision of 2026-10-13 is that app names decide nothing: the AI judges screenshots
 * against the person's role. The word beside the dot carries the category; the dot only orders it.
 * Never derived here — the server sends the category.
 */
const RULE_DOT: Record<string, string> = {
  productive: ink(80),
  neutral: ink(55),
  distracting: ink(35),
};

function Rows({ rows }: { rows: AppUsageRow[] }) {
  // Share of the top row, not of the day: app time is sampled and need not sum to active hours, so
  // a "% of day" bar would be quietly wrong. Relative width is honest about being a ranking.
  const top = rows[0]?.seconds ?? 0;
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.name} className="flex items-center gap-3 text-sm">
          <span className="w-40 shrink-0 truncate" title={r.name}>
            {r.name}
          </span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: top > 0 ? `${(r.seconds / top) * 100}%` : "0%" }}
            />
          </span>
          <span className="w-16 shrink-0 text-right tabular-nums text-muted-foreground">
            {dur(r.seconds)}
          </span>
          <span className="flex w-20 shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: RULE_DOT[r.category] ?? RULE_DOT.neutral }}
            />
            {r.category}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * One employee's measured app and website time — the profile's "where the time went" panel.
 *
 * Complements the productivity score beside it: the score says how the day rated, this says what it
 * was spent in. Both come from the same `APPDAY#`/`URLDAY#` rows the daily AI recap now narrates,
 * so the panel and the summary above it cannot disagree.
 */
export function EmployeeAppUsageCard({
  userId,
  from,
  to,
}: {
  userId: string;
  from: string;
  to: string;
}) {
  const [data, setData] = useState<AppUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Tracking rules are read and written with `MonitoringManage` — the same gate the rail uses.
  const canEditRules = usePermissions().can("monitoring:manage");

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    getUserAppUsage(userId, from, to)
      .then((d) => live && setData(d))
      .catch((e) => {
        if (!live) return;
        // A role without oversight on this person gets a plain sentence, not a broken card.
        setError(
          e instanceof ApiError && e.status === 403
            ? "You don't have access to this person's app activity."
            : "Couldn't load app usage.",
        );
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [userId, from, to]);

  const empty = !!data && data.apps.length === 0 && data.sites.length === 0;
  const beforeTracking = empty && from < TRACKING_SINCE;

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <AppWindow className="size-4 text-muted-foreground" />
        <h3 className="font-medium">App &amp; website usage</h3>
      </div>
      {/* Says whose verdict the category is — the same label Analytics → Activity carries. */}
      <p className="mt-1 text-xs text-muted-foreground">
        Categories by your app rules (not AI) — set from each app&apos;s name in{" "}
        {/* A link for whoever can open the page (UX audit SET-15); plain text for everyone else. */}
        {canEditRules ? (
          <Link
            href="/settings/tracking-rules"
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            Settings → Tracking rules
          </Link>
        ) : (
          "Settings → Tracking rules"
        )}
        .
      </p>

      {loading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
      ) : error ? (
        <p className="mt-3 text-sm text-muted-foreground">{error}</p>
      ) : beforeTracking ? (
        // The distinction the whole component exists to preserve.
        <p className="mt-3 text-sm text-muted-foreground">
          Per-person app tracking started on {TRACKING_SINCE}. Nothing was recorded per person before
          then — this isn&apos;t a quiet period, it&apos;s a gap in what was collected.
        </p>
      ) : empty ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No app activity recorded for this range. The desktop agent reports usage only while it is
          running and signed in.
        </p>
      ) : (
        <div className="mt-3 space-y-4">
          {data!.apps.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Applications
              </p>
              <Rows rows={data!.apps} />
            </div>
          ) : null}
          {data!.sites.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Websites
              </p>
              <Rows rows={data!.sites} />
            </div>
          ) : null}
          {data!.truncated ? (
            <p className="text-xs text-muted-foreground">
              Showing the most-used only — this range has more than the ranking holds.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
