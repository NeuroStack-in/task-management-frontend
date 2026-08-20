"use client";

/**
 * Company — the org's own details, schedule, holidays and policies, **read-only, for every member**.
 *
 * The management surface (`OrganizationTab`, `/settings/organization`) is gated on `settings:view`,
 * which employees do not have — so the policies an admin writes here had no audience. This is that
 * audience: the four GETs it reads (`/v1/org`, `/v1/org/working-hours`, `/v1/org/holidays`,
 * `/v1/org/policies`) are all member-open server-side, so nothing here needs a permission the
 * employee lacks.
 *
 * It is a *reference*, not a second editor — the "no duplicate pages" rule (frontend CLAUDE.md) is
 * satisfied because the cut is different: this reads, the Organization tab writes. Managers get a
 * link across to that editor rather than a cloned form.
 */
import { useEffect, useState } from "react";
import {
  Building2,
  Clock,
  CalendarDays,
  FileText,
  ExternalLink,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { Markdown } from "@/components/shared/markdown";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import {
  getOrg,
  getWorkingHours,
  listHolidays,
  listPolicies,
  type OrgView,
  type OrgWorkingHours,
  type OrgHoliday,
  type OrgPolicy,
} from "@/modules/settings/services/org.service";
import type { IsoWeekday } from "@/lib/workdays";

/** Mon→Sun in ISO order, so the pill row always renders a full week in a familiar order. */
const ISO_WEEK: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];

const WEEKDAY: Record<IsoWeekday, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
};

/** "Aug 15, 2026" from a `YYYY-MM-DD` — parsed as local so the date shown is the date stored. */
function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Upcoming first, then most-recent past — the next holiday is what a reader usually wants. */
function byUpcoming(a: OrgHoliday, b: OrgHoliday): number {
  const today = new Date().toISOString().slice(0, 10);
  const aFuture = a.date >= today;
  const bFuture = b.date >= today;
  if (aFuture !== bFuture) return aFuture ? -1 : 1;
  return aFuture ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
}

/** Whole days from today to an ISO date. Negative = past. Local midnight both sides. */
function daysUntil(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return 0;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / 86_400_000);
}

/** "in 3 days" / "today" / "tomorrow" — the thing a person actually wants from a holiday date. */
function whenLabel(iso: string): string | null {
  const n = daysUntil(iso);
  if (n < 0) return null;
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  if (n <= 60) return `in ${n} days`;
  return null;
}

/**
 * The working span in hours, from `HH:MM` bounds. `null` when the times don't parse or the end is
 * not after the start — an overnight or misconfigured schedule shows nothing rather than a negative.
 */
function spanHours(start: string, end: string): number | null {
  const mins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
  };
  const a = mins(start);
  const b = mins(end);
  if (a === null || b === null || b <= a) return null;
  return Math.round(((b - a) / 60) * 10) / 10;
}

function Field({ label, value }: { label: string; value?: string | null }) {
  // A blank org field is common (industry/size are optional); show a dash rather than an empty row
  // so the grid stays aligned and "not set" reads as deliberate, not broken.
  return (
    <div className="space-y-0.5">
      <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {label}
      </dt>
      <dd className="text-sm">{value?.trim() ? value : "—"}</dd>
    </div>
  );
}

export function CompanyOverview() {
  const { can } = usePermissions();
  const canManage = can("settings:manage");

  const [org, setOrg] = useState<OrgView | null>(null);
  const [hours, setHours] = useState<OrgWorkingHours | null>(null);
  const [holidays, setHolidays] = useState<OrgHoliday[]>([]);
  const [policies, setPolicies] = useState<OrgPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    // Each is independent and best-effort: a member who can read the org but not (say) holidays
    // should still get everything else, so one rejection degrades its own card, never the page.
    Promise.allSettled([
      getOrg(),
      getWorkingHours(),
      listHolidays(),
      listPolicies(),
    ])
      .then(([o, h, hol, pol]) => {
        if (!live) return;
        if (o.status === "fulfilled") setOrg(o.value);
        if (h.status === "fulfilled") setHours(h.value);
        if (hol.status === "fulfilled") setHolidays([...hol.value].sort(byUpcoming));
        if (pol.status === "fulfilled") {
          setPolicies([...pol.value].sort((a, b) => a.title.localeCompare(b.title)));
        }
        // Only a total failure is an error; a partial one just shows the cards that loaded.
        if (o.status === "rejected" && h.status === "rejected") {
          setError("Couldn't load company information.");
        }
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center">
        <Loader label="Loading company information…" />
      </div>
    );
  }
  if (error) {
    return (
      <EmptyState
        icon={Building2}
        title="Couldn't load company information"
        description={error}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company"
        description="Your organization's details, schedule, holidays and policies."
      />

      {/* ── Identity ────────────────────────────────────────────────────────────────
          The org's own name and plan lead the page rather than sitting as a card title
          above a grid of labels. This is the one page whose subject *is* the company. */}
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-start gap-4 border-b bg-gradient-to-br from-feature-tint/60 via-card to-card p-5 sm:p-6">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading truncate text-xl font-semibold">
              {org?.name ?? "Organization"}
            </h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {org?.plan ? (
                <Badge className="bg-primary/12 font-medium capitalize text-primary">
                  {org.plan}
                </Badge>
              ) : null}
              {org?.industry ? <span>{org.industry}</span> : null}
              {org?.size ? <span>· {org.size} people</span> : null}
              {org?.website ? (
                <a
                  href={org.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  {org.website.replace(/^https?:\/\//, "")}
                  <ExternalLink className="size-3" />
                </a>
              ) : null}
            </div>
          </div>
          {/* Managers reach the editor from here rather than hunting for it. Everyone else never
              sees a control they cannot use. */}
          {canManage ? (
            <Button
              size="sm"
              variant="outline"
              render={<Link href="/settings/organization" />}
              nativeButton={false}
            >
              <Pencil className="size-3.5" /> Manage
            </Button>
          ) : null}
        </div>
        <CardContent className="p-5 sm:p-6">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Industry" value={org?.industry} />
            <Field label="Company size" value={org?.size} />
            <Field label="Time zone" value={org?.timezone} />
          </dl>
        </CardContent>
      </Card>

      {/* ── Working hours ───────────────────────────────────────────────────────── */}
      {hours ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4 text-primary" /> Working hours
            </CardTitle>
            <CardDescription>The schedule attendance is measured against.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field
                label="Hours"
                value={`${hours.work_start} – ${hours.work_end}`}
              />
              <Field label="Late after" value={hours.late_threshold} />
              {/* Derived, not stored: the figure people actually quote is the length of the day,
                  and making a reader subtract two clock times is work the page can do. */}
              <Field
                label="Day length"
                value={(() => {
                  const h = spanHours(hours.work_start, hours.work_end);
                  return h === null ? null : `${h} hours`;
                })()}
              />
            </dl>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Working days
              </p>
              {/* Every weekday is shown, with the non-working ones dimmed and struck through.
                  A comma list of seven names can't be read at a glance, and — worse — it gives no
                  way to see which days are *missing*, which is the actual question. */}
              <div className="flex flex-wrap gap-1.5">
                {ISO_WEEK.map((d) => {
                  const on = hours.workdays.includes(d);
                  return (
                    <span
                      key={d}
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs font-medium",
                        on
                          ? "border-primary/25 bg-primary/10 text-primary"
                          : "border-border bg-muted/40 text-muted-foreground line-through",
                      )}
                    >
                      {WEEKDAY[d]}
                    </span>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ── Holidays ────────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-4 text-primary" /> Holidays
          </CardTitle>
          <CardDescription>
            Company holidays used across scheduling and attendance.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {holidays.length === 0 ? (
            <p className="text-muted-foreground text-sm">No holidays have been added yet.</p>
          ) : (
            <ul className="divide-y">
              {holidays.map((h) => {
                const past = h.date < new Date().toISOString().slice(0, 10);
                return (
                  <li
                    key={h.id}
                    className={cn(
                      "flex items-center justify-between gap-3 py-2.5 text-sm",
                      past && "text-muted-foreground",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          past ? "bg-muted-foreground/40" : "bg-primary",
                        )}
                      />
                      <span className="truncate font-medium">{h.name}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {/* "in 3 days" is the part a person is looking for; the date alone makes
                          them count. Only for dates close enough for it to mean something. */}
                      {whenLabel(h.date) ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.7rem] font-medium text-primary">
                          {whenLabel(h.date)}
                        </span>
                      ) : null}
                      <span className="tabular-nums">{longDate(h.date)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ── Policies — the point of the whole page ──────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="size-4 text-primary" /> Policies
          </CardTitle>
          <CardDescription>
            Workplace policies for the team to reference.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {policies.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No policies have been published yet.
            </p>
          ) : (
            <div className="space-y-4">
              {policies.map((p) => (
                <div key={p.id} className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-medium">{p.title}</h3>
                    {p.url ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary inline-flex shrink-0 items-center gap-1 text-sm hover:underline"
                      >
                        Open <ExternalLink className="size-3.5" />
                      </a>
                    ) : null}
                  </div>
                  {/* Policy bodies are authored as Markdown in the editor; render them the same way
                      every other AI/authored surface does, so a bulleted policy reads as a list, not
                      as literal asterisks. */}
                  {p.body?.trim() ? (
                    <div className="mt-2 text-sm">
                      <Markdown>{p.body}</Markdown>
                    </div>
                  ) : !p.url ? (
                    <p className="text-muted-foreground mt-1 text-sm">No details provided.</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
