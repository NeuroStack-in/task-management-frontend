"use client";

/**
 * The employee directory, from the real backend.
 *
 * Maps the lean directory rows into the view's `EmployeeRow`, filling in department **names** from
 * the departments endpoint and role names from the roles catalog. Email and team are not on the
 * directory list (they live on the full profile), so the rows don't pretend to carry them.
 *
 * **Productivity is joined in from `insights`, not left null.** The directory list is
 * GSI-projected and carries no score, so this hook used to hardcode `productivityScore: null` with
 * a note saying the score "needs the desktop agent". That note outlived its truth — agents have
 * been reporting daily, and the scorer has been writing `SUMMARY#` rows the whole time. The column
 * read "—" for every employee not because the data was missing but because nothing ever asked for
 * it. `GET /v1/insights/activity` serves exactly these numbers and the dashboard already consumes
 * it; this joins the same source by `user_id`.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api";
import { UNKNOWN_DEPARTMENT } from "@/lib/format";
import { mapWithConcurrency } from "@/lib/concurrency";
import { useRolesStore } from "@/stores/roles.store";
import {
  getOrgActivity,
  SCORE_WINDOW_DAYS,
} from "@/modules/insights/services/insights.service";
import {
  readRoster,
  setEmployeeBenched,
  UNASSIGNED_DEPT,
} from "./services/employees.service";
import { listRoles } from "@/modules/roles/services/roles.service";

/** Small cap: a per-day fan-out is exactly the burst that trips the Lambda's 503 throttle. */
const SCORE_FANOUT = 3;

const pad = (n: number) => String(n).padStart(2, "0");

/** The last `SCORE_WINDOW_DAYS` local calendar days, oldest first, as `YYYY-MM-DD`. */
function recentDays(): string[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: SCORE_WINDOW_DAYS }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (SCORE_WINDOW_DAYS - 1 - i));
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
}

/**
 * `user_id → mean score` over the window, counting only days the person actually scored.
 *
 * Best-effort: a failed day must leave the roster rendering rather than break the page — the
 * directory is the point of this screen, the score is an enrichment. But a failure is reported
 * (`failed`), not passed off as a quiet month: "no agent activity in the last 30 days" used to be
 * what a network blip read as (QA audit 2026-10-08, WP-229).
 */
async function scoresByUser(): Promise<{
  scores: Map<string, number>;
  /** True if ANY person reported activity in the window, scored or not. */
  anyReported: boolean;
  /** Some day's read failed, so the scores may be partial or missing. */
  failed: boolean;
}> {
  let failed = false;
  const days = await mapWithConcurrency(recentDays(), SCORE_FANOUT, (date) =>
    getOrgActivity(date).catch(() => {
      failed = true;
      return null;
    }),
  );
  const sum = new Map<string, { total: number; days: number }>();
  let anyReported = false;
  for (const day of days) {
    for (const p of day?.people ?? []) {
      // `totals` means the agent reported. `breakdown` means the day ALSO cleared the server's
      // 30-minute volume floor. Two different facts: a person can report all month and never
      // clear the floor, and calling that "no agent activity" sends someone to debug a working
      // install.
      if (p.totals) anyReported = true;
      if (!p.breakdown) continue;
      const acc = sum.get(p.user_id) ?? { total: 0, days: 0 };
      acc.total += p.breakdown.score;
      acc.days += 1;
      sum.set(p.user_id, acc);
    }
  }
  return {
    scores: new Map(
      [...sum.entries()].map(([id, a]) => [id, Math.round(a.total / a.days)]),
    ),
    anyReported,
    failed,
  };
}

/**
 * The row shape the view renders. `productivityScore: null` = no score (see `scoreStatus` for why).
 *
 * No `email` or `team`: the directory list carries neither, and the rows used to hold them as `""`,
 * which the search box, the CSV export and a Status filter value all promised as data (QA audit
 * 2026-10-08, WP-456). No `avatarUrl` either: the roster's photos come from the shared avatar store
 * via `<UserAvatar>`, which batches every row, not just the first 50, and refreshes expired URLs
 * (WP-231).
 */
export interface EmployeeRow {
  id: string;
  /** Human-facing employee id (e.g. `EMP-0001`); `null` for legacy rows that predate ids. */
  empId: string | null;
  name: string;
  roleName: string;
  jobTitle: string;
  /** Department name; `""` for someone with no department (the server's `unassigned`). */
  department: string;
  /** The directory emits only these two (`mapStatus`). */
  status: "active" | "deactivated";
  /**
   * This person has **no login** — a monitored employee (MANAGED-AGENT.md §6.4), recorded by a
   * managed agent rather than by signing in. Distinct from "invited, hasn't accepted yet", which
   * looks identical in the roster and means the opposite.
   */
  monitored: boolean;
  /** On the **bench** — still an employee, but excluded from Attendance + Time-Tracking. */
  benched: boolean;
  productivityScore: number | null;
  /** For search only (PEOPLE-04); `""` when the server didn't send one. */
  email?: string;
}

export interface EmployeesData {
  employees: EmployeeRow[];
  loading: boolean;
  error: string | null;
  /**
   * Part of the org couldn't be read (a department, or the department list), so the list — and
   * every total drawn from it — is short. Said on screen rather than shown as the whole org (WP-230).
   */
  incomplete: boolean;
  /**
   * How many departments the org has, from the departments read — not a count of the distinct
   * labels on people, which counted "no department" as one and missed empty ones (WP-111). `null`
   * when that read failed.
   */
  departmentCount: number | null;
  reload: () => void;
  /** Put an employee on / take them off the bench. Optimistic — the row flips immediately. */
  bench: (id: string, benched: boolean) => Promise<void>;
  /**
   * Where the productivity scores stand: `off` — not asked for (the caller may not read org
   * activity, or doesn't show scores); `loading`; `ready`; `failed` — some reads failed, so a "—"
   * may be a gap in the data we have rather than a quiet month.
   */
  scoreStatus: "off" | "loading" | "ready" | "failed";
  /**
   * Did ANY agent report activity in the 30-day window, scored or not?
   *
   * `productivityScore` is null both when nobody ran an agent and when everyone did but no day
   * cleared the server's 30-minute scoring floor. Those need different copy: the first is a fleet
   * problem, the second is not a problem at all.
   */
  anyAgentReported: boolean;
}

/**
 * Backend status → the view's union. The directory only ever emits active/deactivated.
 *
 * **`deactivated` is no longer renamed to `inactive`.** That rename is what made this screen
 * unreadable: the `benched` flag was *also* surfaced as "Inactive", so one word stood for two
 * unrelated states — one where the person still signs in, one where their access is revoked — and
 * they looked like the same thing because we called them the same thing.
 */
function mapStatus(s: string): EmployeeRow["status"] {
  if (s === "deactivated") return "deactivated";
  return "active";
}

/**
 * The org's roster, with productivity scores joined in when `withScores` is set.
 *
 * `withScores` is the caller's to decide — the Employees page passes whether the viewer may read org
 * activity. The scores are 30 org-wide reads (one per day), and they used to run for every caller on
 * every load and every `reload()`: 30 guaranteed 403s for a directory-only viewer, 30 more after each
 * "Add employee", and 30 on Settings → Ownership, which only needs names (QA audit 2026-10-08,
 * WP-453). Now they run once per mount, only when asked for, and a roster reload keeps them.
 */
export function useEmployees({ withScores = false }: { withScores?: boolean } = {}): EmployeesData {
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [incomplete, setIncomplete] = useState(false);
  const [departmentCount, setDepartmentCount] = useState<number | null>(null);
  const [scores, setScores] = useState<{
    status: EmployeesData["scoreStatus"];
    byUser: Map<string, number>;
    // Whether ANY agent reported activity in the window, scored or not — the difference
    // between "nobody is running the agent" and "everyone is, below the scoring floor".
    anyReported: boolean;
  }>(() => ({ status: withScores ? "loading" : "off", byUser: new Map(), anyReported: false }));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const getAllRoles = useRolesStore((s) => s.getAllRoles); // stable ref: role_id → name lookup

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        // `readRoster` pages every department; the bare directory call truncates at 50 with no
        // cursor to follow, which would silently cap this page (and its "Total employees").
        const [roster, serverRoles] = await Promise.all([
          readRoster(),
          // The org's real roles, custom ones included. The local roles store is a leftover nothing
          // populates, so every custom-role member had a blank Role cell (QA audit WP-227). A
          // reader without roles access falls back to the built-in names.
          listRoles().catch(() => []),
        ]);
        if (!live) return;
        const depts = new Map((roster.departments ?? []).map((d) => [d.id, d.name]));
        // role_id → display name; the server's catalog first, the built-in names as a fallback.
        const roleNames = new Map(getAllRoles().map((r) => [r.id, r.name]));
        for (const r of serverRoles) roleNames.set(r.id, r.name);
        setRows(
          roster.employees.map((e) => ({
            id: e.user_id,
            empId: e.emp_id ?? null,
            name: e.name,
            roleName: e.role_id ? (roleNames.get(e.role_id) ?? "") : "",
            jobTitle: e.title ?? "",
            // `unassigned` is the server's word for "no department", not a department id. It used
            // to miss the name table and read "Unknown department" — the label for a deleted one —
            // and then count as a department of its own (QA audit 2026-10-08, WP-111).
            department:
              !e.department_id || e.department_id === UNASSIGNED_DEPT
                ? ""
                : (depts.get(e.department_id) ?? UNKNOWN_DEPARTMENT),
            status: mapStatus(e.status),
            // Absent on every row that predates the field, so this reads false for existing orgs.
            monitored: e.login === "none",
            benched: e.benched ?? false,
            email: e.email ?? "",
            // Joined from `scores` below; `null` — rendered "—" — until there is one.
            productivityScore: null,
          })),
        );
        setIncomplete(roster.incomplete);
        setDepartmentCount(roster.departments ? roster.departments.length : null);
      } catch (e) {
        if (live) setError(messageOf(e));
      } finally {
        if (live) setLoading(false);
      }
    })();

    return () => {
      live = false;
    };
  }, [nonce, getAllRoles]);

  // **The roster renders before the scores arrive**, and doesn't wait on them: the window is 30 days
  // (§3.1) and the endpoint is per-day, so this is 30 requests. The names, roles and departments are
  // the point of this screen — the score is an enrichment that fills in a moment later.
  useEffect(() => {
    if (!withScores) {
      setScores({ status: "off", byUser: new Map(), anyReported: false });
      return;
    }
    let live = true;
    setScores((s) => ({ ...s, status: "loading" }));
    scoresByUser()
      .then(({ scores: byUser, anyReported, failed }) => {
        // `anyReported` is recorded even when nothing scored — that is precisely the case the
        // roster used to describe as "no agent activity in the last 30 days" while agents were
        // reporting daily.
        if (live) setScores({ status: failed ? "failed" : "ready", byUser, anyReported });
      })
      .catch(() => {
        if (live) setScores({ status: "failed", byUser: new Map(), anyReported: false });
      });
    return () => {
      live = false;
    };
  }, [withScores]);

  const employees = useMemo(
    () =>
      scores.byUser.size === 0
        ? rows
        : rows.map((r) => ({ ...r, productivityScore: scores.byUser.get(r.id) ?? null })),
    [rows, scores.byUser],
  );

  // Optimistic: flip the row's `benched` immediately (a full directory refetch for a toggle is
  // overkill), and revert if the server rejects it.
  const bench = useCallback(async (id: string, benched: boolean) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, benched } : r)));
    try {
      await setEmployeeBenched(id, benched);
    } catch (e) {
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, benched: !benched } : r)));
      throw e;
    }
  }, []);

  return {
    employees,
    loading,
    error,
    incomplete,
    departmentCount,
    reload,
    bench,
    scoreStatus: scores.status,
    anyAgentReported: scores.anyReported,
  };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to the employee directory.";
    return e.message;
  }
  return "Couldn't load employees. Check your connection and retry.";
}
