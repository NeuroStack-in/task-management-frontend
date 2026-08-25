"use client";

/**
 * One employee's AI recap on their profile, over a selectable period.
 *
 * **This is the same cached narrative the employee reads about themselves.** There is no
 * manager-only variant, by design (`insights::shared::subject`): one artifact means there is no
 * private, model-written characterisation of someone, and no way for the two audiences to be told
 * different things about the same week. Regenerating overwrites the paragraph *both* of them see —
 * which the button says out loud.
 *
 * Needs `AiInsightsRead` **and** `ActivityReadOrg`; a 403 hides the card rather than showing an
 * error, because plenty of roles can open a profile without being entitled to this.
 *
 * The ladder is shot → day → week → month → overall, and each level reduces the level below. So a
 * period whose children were never generated has nothing to summarise — the server says so in
 * `reason`, and this renders that instead of an empty card.
 */
import { useCallback, useEffect, useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/shared/loader";
import { Markdown } from "@/components/shared/markdown";
import { DatePicker } from "@/components/ui/date-picker";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  getUserRecap,
  regenerateUserRecap,
  type DailySummary,
  type PeriodRecap,
  type RecapPeriod,
} from "@/modules/insights/services/insights.service";

const PERIODS: { key: RecapPeriod; label: string }[] = [
  // "Last day", not "Daily": a day is recapped only once it has closed, so this tab can never be
  // today — and "Daily" read as if it were. The date picker beside it says which day.
  { key: "daily", label: "Last day" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "overall", label: "Overall" },
];

const pad = (n: number) => String(n).padStart(2, "0");

const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Yesterday — the last *completed* day. Today is in progress and has no settled recap. */
function yesterdayIso(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return ymd(d);
}

/** "Mon, Aug 17" — the day a daily recap actually covers, so it can't be mistaken for today. */
function dayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** The ISO-8601 week (`YYYY-Www`) containing `d` — what `?week=` expects. */
function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // ISO weeks belong to the year containing their Thursday.
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${pad(week)}`;
}

/**
 * The period label each route wants, anchored on **yesterday** for the daily.
 *
 * A recap of today would be written from a part-finished day, and the attendance close hasn't run —
 * so the daily deliberately reads the last completed day rather than an in-progress one.
 */
function paramFor(period: RecapPeriod, dailyDate: string): string | undefined {
  const now = new Date();
  // The Daily recap is for whichever date the user has selected (defaulting to yesterday). The
  // other periods keep their own anchor — a week/month picker is a different affordance.
  if (period === "daily") return dailyDate;
  if (period === "weekly") return isoWeek(now);
  if (period === "monthly") return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  return undefined; // overall defaults to "through now" server-side
}

const PERIOD_HINT: Record<RecapPeriod, string> = {
  daily: "the last completed day",
  weekly: "this ISO week",
  monthly: "this calendar month",
  overall: "the last 12 months",
};

type Recap = DailySummary | PeriodRecap;

/** The narrative's evidence base, whichever level produced it — shown so a thin recap reads thin. */
function evidence(r: Recap): string | null {
  const p = r as PeriodRecap;
  if (p.source_days != null) return `${p.source_days} day(s) with a recap`;
  if (p.source_weeks != null) return `${p.source_weeks} week(s) with a recap`;
  if (p.source_months != null) return `${p.source_months} month(s) with a recap`;
  return null;
}

export function EmployeeRecapCard({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  // Daily by default: the daily recap is the rich one (session shape, breaks, "2 of 3 tasks",
  // yesterday comparison, focus areas). Weekly/monthly are thin reduces that can't carry that
  // detail, so opening on Weekly hid the useful recap behind a tab switch.
  const [period, setPeriod] = useState<RecapPeriod>("daily");
  // The date the Daily recap covers. Defaults to yesterday (the last completed day) and can be moved
  // to any past date — which is the whole point: "why does it show a report when the timer is off
  // today?" is answered by making the covered day explicit and selectable, instead of a fixed
  // "yesterday" that reads like today.
  const [dailyDate, setDailyDate] = useState<string>(yesterdayIso());
  const [recap, setRecap] = useState<Recap | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** A 403 means this role can't read recaps at all — hide the card rather than nag. */
  const [forbidden, setForbidden] = useState(false);

  const load = useCallback(() => {
    let live = true;
    setLoading(true);
    setError(null);
    getUserRecap(userId, period, paramFor(period, dailyDate))
      .then((r) => live && setRecap(r))
      .catch((e) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 403) setForbidden(true);
        else setError("Couldn't load the summary.");
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [userId, period, dailyDate]);
  useEffect(() => load(), [load]);

  async function regenerate() {
    if (regenerating || loading) return;
    setRegenerating(true);
    setError(null);
    try {
      setRecap(await regenerateUserRecap(userId, period, paramFor(period, dailyDate)));
    } catch {
      // Keep the previous narrative on screen — a failed re-run shouldn't blank a good summary.
      setError("Couldn't regenerate the summary.");
    } finally {
      setRegenerating(false);
    }
  }

  if (forbidden) return null;

  const narrative = recap?.narrative?.trim() ?? "";
  const reason = (recap as PeriodRecap | null)?.reason;
  const generatedAt = recap?.generated_at;
  const base = recap ? evidence(recap) : null;
  const first = name.split(" ")[0] || "this employee";

  return (
    <Card>
      <CardHeader>
        {/* NOT `flex-wrap`. With wrapping, the button's position depended on how long the
            description happened to be: "Mon 24 Aug · recapped after the day closed · the same recap
            Rahul sees about themselves" pushed it onto a second line, while the shorter Overall
            copy left it top-right — so switching tabs made the control jump. `min-w-0` lets the
            description wrap inside its own column instead of shoving the button anywhere. */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" /> AI summary
            </CardTitle>
            <CardDescription>
              {period === "daily"
                ? `${dayLabel(dailyDate)} · recapped after the day closed · the same recap ${first} sees about themselves`
                : `${PERIOD_HINT[period]} · the same recap ${first} sees about themselves`}
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={regenerate}
            disabled={loading || regenerating}
            // Said plainly: this is not a private re-roll.
            title={`Rewrite the summary ${first} also sees`}
          >
            <RefreshCw className={cn("size-3.5", regenerating && "animate-spin")} />
            {regenerating ? "Regenerating…" : "Regenerate"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex items-center gap-0.5 rounded-full border bg-card p-0.5"
            role="group"
            aria-label="Summary period"
          >
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              aria-pressed={period === p.key}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                period === p.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
          </div>
          {/* Only on Daily: weekly/monthly/overall have their own fixed anchor, and a day picker
              beside them would imply it changes those, which it doesn't. Capped at yesterday —
              today is in progress and has no settled recap yet. */}
          {period === "daily" ? (
            <DatePicker
              value={dailyDate}
              onChange={setDailyDate}
              max={yesterdayIso()}
              className="w-[9.5rem]"
            />
          ) : null}
        </div>

        {loading || regenerating ? (
          <div className="flex min-h-[4rem] items-center">
            <Loader
              label={regenerating ? "Regenerating…" : "Loading the summary…"}
            />
          </div>
        ) : narrative ? (
          <>
            {/* Bullet list from the recap prompt — rendered as markdown, not raw text. */}
            <Markdown className="text-sm leading-relaxed">{narrative}</Markdown>
            <p className="text-muted-foreground text-xs">
              {base ? `Based on ${base}` : null}
              {base && generatedAt ? " · " : null}
              {generatedAt
                ? `text written ${new Date(generatedAt).toLocaleString()}`
                : null}
            </p>
          </>
        ) : (
          // The ladder's honest empty state: nothing below this level was generated, so there is
          // nothing to reduce. Distinct from "this person did nothing".
          <p className="text-muted-foreground text-sm">
            {reason ??
              "No summary for this period yet — nothing has been generated to summarise."}
          </p>
        )}

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
