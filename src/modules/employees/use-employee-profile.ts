"use client";

/**
 * One employee's rich profile, assembled entirely from the **live backend** — no mock:
 *   - identity / contact / assignment  → `GET /v1/employees/{id}` + department / team / role maps;
 *   - productivity score + 6-month trend → `GET /v1/insights/user/{id}/activity` (agent-fed);
 *   - projects + per-project KPIs        → `GET /v1/projects/user/{id}` + `GET /v1/projects/{id}`.
 *
 * The output feeds the preview `EmployeeProfileData` shape verbatim. Fields the backend genuinely
 * doesn't carry (`dob`, `address`, `postcode`, `country`, `avatarUrl`) are left `""` and the UI
 * renders them as an em dash. The KPI series is **avg productive hours / day** per month, derived
 * from the agent's `productive_sec` (a month with no scored day is `null`, never `0`).
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { listRoles } from "@/modules/roles/services/roles.service";
import {
  listUserProjects,
  getProject,
} from "@/modules/projects/services/projects.service";
import {
  getUserActivity,
  SCORE_WINDOW_DAYS,
} from "@/modules/insights/services/insights.service";
import {
  getEmployeeProfile,
  departmentMap,
  teamMap,
} from "./services/employees.service";

export interface ProjectItem {
  id: string;
  name: string;
  key: string;
  progress: number;
  tasks: number;
  teammates: number;
  active: boolean;
}

export interface EmployeeProfileData {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  jobTitle: string;
  department: string;
  team: string;
  /** Raw backend ids (`""` when unset) — the edit dialog patches by id, not display name. */
  departmentId: string;
  teamId: string;
  roleName: string;
  status: "active" | "inactive" | "invited" | "suspended";
  /** `null` = no scored day in the window (agent not reporting) — **not** a score of zero. */
  productivityScore: number | null;
  empCode: string;
  phone: string;
  dob: string;
  hireDate: string;
  country: string;
  cityState: string;
  address: string;
  postcode: string;
  projects: ProjectItem[];
  /** `null` in a month = nothing was measured that month — **not** a measured zero. */
  kpi: { months: string[]; current: (number | null)[]; previous: (number | null)[] };
  totalTasks: number;
  avgCompletion: number;
}

export interface EmployeeProfileState {
  data: EmployeeProfileData | null;
  loading: boolean;
  error: string | null;
  notFound: boolean;
  reload: () => void;
}

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** `YYYY-MM-DD` in local calendar (the activity endpoint wants local, the server is UTC). */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Run `fn` over `items` with a bounded concurrency, so a many-project fan-out can't throttle (503). */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Twelve monthly buckets ending on the current month, each holding the **avg productive hours / day**
 * for that month (mean of the returned days' `productive_sec / 3600`). The last 6 buckets are
 * "current", the first 6 "previous".
 *
 * **A month with no scored day is `null`, not `0`.** It used to fold to zero, which drew a flat line
 * along the axis that was indistinguishable from a real, measured zero — the chart said "this person
 * produced nothing for six months" when the truth was "nothing was ever measured". That is the same
 * null-collapsed-to-zero mistake the productivity stat card already guards against, and it is worse
 * on a chart, because a line implies a series of observations.
 */
function buildKpi(
  days: { date: string; productiveSec: number }[],
  now: Date,
): { months: string[]; current: (number | null)[]; previous: (number | null)[] } {
  const keys: string[] = [];
  const labels: string[] = [];
  for (let k = 11; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    labels.push(MONTH_SHORT[d.getMonth()]);
  }
  const sum = new Map<string, { hours: number; n: number }>();
  for (const day of days) {
    const key = day.date.slice(0, 7);
    const acc = sum.get(key) ?? { hours: 0, n: 0 };
    acc.hours += day.productiveSec / 3600;
    acc.n += 1;
    sum.set(key, acc);
  }
  const avgFor = (key: string): number | null => {
    const acc = sum.get(key);
    return acc && acc.n > 0 ? round1(acc.hours / acc.n) : null;
  };
  const previous = keys.slice(0, 6).map(avgFor);
  const current = keys.slice(6).map(avgFor);
  const months = labels.slice(6); // label the axis by the last-6-month window
  return { months, current, previous };
}

export function useEmployeeProfile(id: string): EmployeeProfileState {
  const [data, setData] = useState<EmployeeProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    setNotFound(false);

    (async () => {
      try {
        const now = new Date();
        const from = ymd(new Date(now.getFullYear(), now.getMonth() - 11, 1));
        const to = ymd(now);

        const [p, depts, teams, roles, allProjects, activity] = await Promise.all([
          getEmployeeProfile(id),
          departmentMap().catch(() => new Map<string, string>()),
          teamMap().catch(() => new Map<string, string>()),
          listRoles().catch(() => []),
          listUserProjects(id).catch(() => []),
          getUserActivity(id, from, to).catch(() => null),
        ]);
        if (!live) return;

        // Every project this person is a member of (manager OR member) — the real membership scan.
        const memberProjects = allProjects.slice(0, 50); // safety cap on the per-project KPI fan-out
        const details = await mapLimit(memberProjects, 5, (pr) =>
          getProject(pr.id).catch(() => null),
        );
        if (!live) return;

        const projects: ProjectItem[] = memberProjects
          .map((pr, idx) => {
            const detail = details[idx];
            const kpi = detail?.kpi;
            return {
              id: pr.id,
              name: pr.name,
              key: pr.key ?? "",
              progress: kpi?.completion_pct ?? 0,
              tasks: kpi?.total_tasks ?? 0,
              teammates: kpi?.active_members ?? detail?.members.length ?? 0,
              active: pr.status === "active",
            };
          })
          .sort((a, b) => Number(b.active) - Number(a.active) || b.progress - a.progress);

        const totalTasks = projects.reduce((s, pr) => s + pr.tasks, 0);
        const avgCompletion = projects.length
          ? Math.round(projects.reduce((s, pr) => s + pr.progress, 0) / projects.length)
          : 0;

        // **The mean of this person's scored days over the last 30** (PRODUCTIVITY.md §3.1) —
        // deliberately *not* `trend.avg_score`, which covers the whole 12-month fetch. That fetch
        // stays because the KPI chart below genuinely needs a year of buckets; the headline number
        // does not, and a year-long average beside someone's name is both stale and unlike every
        // other surface. One window, one meaning — the directory column uses the same 30 days.
        //
        // **`null` means "not measured", and it must stay `null`.** Collapsing it to `0` published
        // a fabricated verdict: a confident "0%", and a summary card calling the person a
        // "developing performer, averaging 0% productivity" — a statement about a missing agent
        // feed, not about them.
        const scoreCutoff = ymd(
          new Date(now.getFullYear(), now.getMonth(), now.getDate() - (SCORE_WINDOW_DAYS - 1)),
        );
        const recentScored = (activity?.days ?? []).filter((d) => d.date >= scoreCutoff);
        const productivityScore = recentScored.length
          ? Math.round(recentScored.reduce((s, d) => s + d.score, 0) / recentScored.length)
          : null;
        const kpi = buildKpi(
          (activity?.days ?? []).map((d) => ({ date: d.date, productiveSec: d.productive_sec })),
          now,
        );

        const roleName = roles.find((r) => r.id === p.role_id)?.name ?? p.role_id ?? "";

        setData({
          id: p.user_id,
          name: p.name,
          email: p.email,
          avatarUrl: undefined, // no avatar field on the backend profile
          jobTitle: p.title ?? "",
          department: p.department_id ? (depts.get(p.department_id) ?? p.department_id) : "",
          team: p.team_id ? (teams.get(p.team_id) ?? p.team_id) : "",
          departmentId: p.department_id ?? "",
          teamId: p.team_id ?? "",
          roleName,
          status: p.status === "deactivated" ? "inactive" : "active",
          productivityScore,
          empCode: p.emp_id ?? "",
          phone: p.phone ?? "",
          dob: "", // not carried by the backend
          hireDate: p.joined_at ? fmtDate(p.joined_at) : "",
          country: "", // not carried by the backend
          cityState: p.location ?? "",
          address: "", // not carried by the backend
          postcode: "", // not carried by the backend
          projects,
          kpi,
          totalTasks,
          avgCompletion,
        });
      } catch (e) {
        if (!live) return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError(messageOf(e));
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [id, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, notFound, reload };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to this profile.";
    return e.message;
  }
  return "Couldn't load this employee. Check your connection and retry.";
}
