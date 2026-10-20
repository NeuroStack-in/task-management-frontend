"use client";

/**
 * The Analytics hub scoped to one employee (`?emp=<id>`, opened from the profile's Analytics button —
 * owner request 2026-10-16).
 *
 * Screenshots and Locations already had per-person views; these are the other two tabs' versions:
 *
 *  - **Activity** — that person's daily productivity score and where their time went, from the same
 *    per-person reads the profile uses (`/v1/insights/user/{id}/activity`, `…/apps`), so the hub and
 *    the profile can never tell different stories about the same days.
 *  - **AI reports** — that person's AI recap (the profile's card). The organization-wide reports
 *    (workforce health, anomalies, the report library) describe everyone, so they stay on the
 *    unscoped tab, one click away.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_MARGIN_WITH_LEGEND, xAxisLabel, yAxisLabel } from "@/components/shared/chart-axis";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { ApiError } from "@/lib/api";
import { formatDuration, isoDay } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmployeeAppUsageCard } from "@/modules/employees/components/employee-app-usage-card";
import { EmployeeRecapCard } from "@/modules/employees/components/employee-recap-card";
import { getUserActivity, type SelfActivity } from "../services/insights.service";
import { useEmployeeName } from "./employee-scope-bar";

const RANGES = [7, 14, 30] as const;
type RangeDays = (typeof RANGES)[number];

function rangeOf(days: RangeDays): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  return { from: isoDay(from), to: isoDay(now) };
}

/** Every day from `from` to `to`, inclusive, as local ISO days. */
function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const [fy, fm, fd] = from.split("-").map(Number);
  const cur = new Date(fy, fm - 1, fd);
  for (let i = 0; i < 62 && isoDay(cur) <= to; i++) {
    out.push(isoDay(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function shortLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** One employee's Activity tab. */
export function PersonActivity({ userId }: { userId: string }) {
  const name = useEmployeeName(userId) ?? "this employee";
  const pathname = usePathname();
  const { can } = usePermissions();
  const canSeeApps = can("activity:apps:person");

  const [days, setDays] = useState<RangeDays>(14);
  // Resolved after mount: `new Date()` in a render path can disagree between server and client.
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  useEffect(() => setRange(rangeOf(days)), [days]);

  const [data, setData] = useState<SelfActivity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!range) return;
    let live = true;
    setLoading(true);
    setError(null);
    getUserActivity(userId, range.from, range.to)
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e) => {
        if (!live) return;
        setData(null);
        setError(
          e instanceof ApiError && e.status === 403
            ? "You don't have access to this employee's activity."
            : "Couldn't load this employee's activity. Try again in a moment.",
        );
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [userId, range]);

  // A bar for every day of the range — a day with no score stays an empty slot rather than vanishing,
  // so a gap reads as a gap, never as a shorter fortnight.
  const chart = useMemo(() => {
    if (!range || !data) return [];
    const byDay = new Map(data.days.map((d) => [d.date, d]));
    return daysBetween(range.from, range.to).map((iso) => {
      const row = byDay.get(iso);
      return { date: iso, label: shortLabel(iso), score: row ? Math.round(row.score) : null };
    });
  }, [range, data]);

  const totals = useMemo(() => {
    const rows = data?.days ?? [];
    const sum = (k: "active_sec" | "productive_sec" | "neutral_sec" | "distracting_sec") =>
      rows.reduce((s, r) => s + (r[k] ?? 0), 0);
    const productive = sum("productive_sec");
    const neutral = sum("neutral_sec");
    const distracting = sum("distracting_sec");
    return { active: sum("active_sec"), productive, neutral, distracting, categorised: productive + neutral + distracting };
  }, [data]);

  const scored = data?.trend.days_scored ?? 0;
  const avg = data?.trend.avg_score;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Activity — {name}</h2>
          <p className="text-sm text-muted-foreground">
            Daily productivity score and where the time went, from the desktop agent.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border p-1" role="group" aria-label="Period">
          {RANGES.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={days === n}
              onClick={() => setDays(n)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                days === n ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Last {n} days
            </button>
          ))}
        </div>
      </div>

      {loading && !data ? (
        <div className="flex min-h-[240px] items-center justify-center rounded-xl border bg-card">
          <Loader label="Loading activity…" />
        </div>
      ) : error ? (
        <div className="rounded-xl border bg-card p-6">
          <EmptyState icon={Activity} title="Activity unavailable" description={error} />
        </div>
      ) : scored === 0 ? (
        <div className="rounded-xl border bg-card p-6">
          <EmptyState
            icon={Activity}
            title={`No activity scored for ${name} in the last ${days} days`}
            description="Scores come from the desktop agent. Nothing was reported for this period — which isn't the same as a measured zero."
            action={
              <Button variant="outline" size="sm" render={<Link href={pathname} />} nativeButton={false}>
                View the whole organization
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Average score" value={avg == null ? "—" : `${Math.round(avg)}`} hint="out of 100" />
            <Stat label="Days scored" value={`${scored}`} hint={`of ${chart.length} days`} />
            <Stat label="Active time" value={formatDuration(totals.active)} hint={`last ${days} days`} />
            <Stat
              label="Best day"
              value={data?.trend.best ? `${Math.round(data.trend.best.score)}` : "—"}
              hint={data?.trend.best ? shortLabel(data.trend.best.date) : "no scored day"}
            />
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="text-sm font-semibold">Productivity score by day</h3>
            <p className="text-xs text-muted-foreground">Empty days had no score — the agent reported nothing.</p>
            <div className="mt-3 h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={CHART_MARGIN_WITH_LEGEND}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    {...xAxisLabel("Day")}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    interval="preserveStartEnd"
                    minTickGap={16}
                    dy={6}
                  />
                  <YAxis
                    {...yAxisLabel("Score")}
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                    width={50}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                    formatter={(v) => [v == null ? "No score" : `${v} / 100`, "Score"]}
                  />
                  <Bar dataKey="score" name="Score" fill="var(--primary)" radius={[3, 3, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {totals.categorised > 0 ? (
            <div className="rounded-xl border bg-card p-4">
              <h3 className="text-sm font-semibold">Where the time went</h3>
              <p className="text-xs text-muted-foreground">Classified by your organization&apos;s app and website rules (not AI).</p>
              <dl className="mt-3 grid grid-cols-3 gap-3">
                <Split label="Productive" secs={totals.productive} of={totals.categorised} />
                <Split label="Neutral" secs={totals.neutral} of={totals.categorised} />
                <Split label="Distracting" secs={totals.distracting} of={totals.categorised} />
              </dl>
            </div>
          ) : null}
        </>
      )}

      {canSeeApps && range ? <EmployeeAppUsageCard userId={userId} from={range.from} to={range.to} /> : null}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Split({ label, secs, of }: { label: string; secs: number; of: number }) {
  const pct = of > 0 ? Math.round((secs / of) * 100) : 0;
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums">{pct}%</dd>
      <dd className="text-xs text-muted-foreground tabular-nums">{formatDuration(secs)}</dd>
    </div>
  );
}

/** One employee's AI reports tab: their AI recap, with the way back to the organization's reports. */
export function PersonAiReports({ userId }: { userId: string }) {
  const name = useEmployeeName(userId);
  const pathname = usePathname();
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        The AI recap for {name ?? "this employee"}. Workforce health, anomalies and the report library
        cover everyone —{" "}
        <Link href={pathname} className="font-medium text-primary underline-offset-2 hover:underline">
          view them for the whole organization
        </Link>
        .
      </p>
      {/* The recap card titles itself with the name, so it waits for it rather than flash a blank. */}
      {name ? <EmployeeRecapCard userId={userId} name={name} /> : <Loader label="Loading…" />}
    </div>
  );
}
