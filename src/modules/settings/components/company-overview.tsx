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

      {/* ── Org details ─────────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="size-4 text-primary" /> {org?.name ?? "Organization"}
            </CardTitle>
            <CardDescription>Company profile</CardDescription>
          </div>
          {/* Managers reach the editor from here rather than being sent to hunt for it. Everyone
              else never sees a control they cannot use. */}
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
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Industry" value={org?.industry} />
            <Field label="Company size" value={org?.size} />
            <Field label="Time zone" value={org?.timezone} />
            <Field label="Website" value={org?.website} />
            <Field label="Plan" value={org?.plan} />
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
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Hours" value={`${hours.work_start} – ${hours.work_end}`} />
              <Field label="Late after" value={hours.late_threshold} />
              <Field
                label="Working days"
                value={
                  hours.workdays.length
                    ? hours.workdays.map((d) => WEEKDAY[d]).join(", ")
                    : "—"
                }
              />
            </dl>
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
                      "flex items-center justify-between py-2.5 text-sm",
                      past && "text-muted-foreground",
                    )}
                  >
                    <span className="font-medium">{h.name}</span>
                    <span className="tabular-nums">{longDate(h.date)}</span>
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
