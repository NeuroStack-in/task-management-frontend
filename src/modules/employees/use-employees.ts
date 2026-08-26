"use client";

/**
 * The employee directory, from the real backend.
 *
 * Maps the lean directory rows into the view's `EmployeeRow`, filling in department **names** from
 * the departments endpoint. Fields the directory genuinely doesn't serve degrade honestly rather
 * than being invented: email/role/team are blank, because they live on the full profile.
 *
 * **Productivity is joined in from `insights`, not left null.** The directory list is
 * GSI-projected and carries no score, so this hook used to hardcode `productivityScore: null` with
 * a note saying the score "needs the desktop agent". That note outlived its truth — agents have
 * been reporting daily, and the scorer has been writing `SUMMARY#` rows the whole time. The column
 * read "—" for every employee not because the data was missing but because nothing ever asked for
 * it. `GET /v1/insights/activity` serves exactly these numbers and the dashboard already consumes
 * it; this joins the same source by `user_id`.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { UNKNOWN_DEPARTMENT } from "@/lib/format";
import { mapWithConcurrency } from "@/lib/concurrency";
import { useRolesStore } from "@/stores/roles.store";
import {
  getOrgActivity,
  SCORE_WINDOW_DAYS,
} from "@/modules/insights/services/insights.service";
import {
  listAllEmployees,
  departmentMap,
  deactivateEmployee,
  reactivateEmployee,
  setEmployeeBenched,
  getEmployeeAvatarUrls,
} from "./services/employees.service";

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
 * Entirely best-effort. Reading activity needs a higher permission than viewing the directory, so a
 * 403 (or any failure) must leave the roster rendering with "—" rather than break the page — the
 * directory is the point of this screen, the score is an enrichment.
 */
async function scoresByUser(): Promise<Map<string, number>> {
  const days = await mapWithConcurrency(recentDays(), SCORE_FANOUT, (date) =>
    getOrgActivity(date).catch(() => null),
  );
  const sum = new Map<string, { total: number; days: number }>();
  for (const day of days) {
    for (const p of day?.people ?? []) {
      // `breakdown` is absent when that person had no summary that day — a gap, never a zero.
      if (!p.breakdown) continue;
      const acc = sum.get(p.user_id) ?? { total: 0, days: 0 };
      acc.total += p.breakdown.score;
      acc.days += 1;
      sum.set(p.user_id, acc);
    }
  }
  return new Map(
    [...sum.entries()].map(([id, a]) => [id, Math.round(a.total / a.days)]),
  );
}

/** The row shape the view renders. `productivityScore: null` = no scored day in the window. */
export interface EmployeeRow {
  id: string;
  /** Human-facing employee id (e.g. `EMP-0001`); `null` for legacy rows that predate ids. */
  empId: string | null;
  name: string;
  email: string;
  avatarUrl?: string;
  roleName: string;
  jobTitle: string;
  department: string;
  team: string;
  status: "active" | "deactivated" | "invited" | "suspended";
  /**
   * This person has **no login** — a monitored employee (MANAGED-AGENT.md §6.4), recorded by a
   * managed agent rather than by signing in. Distinct from "invited, hasn't accepted yet", which
   * looks identical in the roster and means the opposite.
   */
  monitored: boolean;
  /** On the **bench** — still an employee, but excluded from Attendance + Time-Tracking. */
  benched: boolean;
  productivityScore: number | null;
}

export interface EmployeesData {
  employees: EmployeeRow[];
  loading: boolean;
  error: string | null;
  reload: () => void;
  deactivate: (id: string) => Promise<void>;
  reactivate: (id: string) => Promise<void>;
  /** Put an employee on / take them off the bench. Optimistic — the row flips immediately. */
  bench: (id: string, benched: boolean) => Promise<void>;
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
  if (s === "active") return "active";
  if (s === "deactivated") return "deactivated";
  return "active";
}

export function useEmployees(): EmployeesData {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
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
        // `listAllEmployees` pages every department; the bare directory call truncates at 50 with
        // no cursor to follow, which would silently cap this page (and its "Total employees").
        const [roster, depts] = await Promise.all([
          listAllEmployees(),
          departmentMap().catch(() => new Map<string, string>()),
        ]);
        if (!live) return;
        // role_id → display name (system + custom roles); blank if the id is unknown.
        const roleNames = new Map(getAllRoles().map((r) => [r.id, r.name]));
        const rows: EmployeeRow[] = roster.map((e) => ({
          id: e.user_id,
          empId: e.emp_id ?? null,
          name: e.name,
          email: "", // not on the directory list — lives on the full profile
          roleName: e.role_id ? (roleNames.get(e.role_id) ?? "") : "",
          jobTitle: e.title ?? "",
          department: depts.get(e.department_id) ?? (e.department_id ? UNKNOWN_DEPARTMENT : ""),
          team: "",
          status: mapStatus(e.status),
          // Absent on every row that predates the field, so this reads false for existing orgs.
          monitored: e.login === "none",
          benched: e.benched ?? false,
          // Filled by the score pass below; `null` — rendered "—" — means no agent reported for
          // them in the window, which is a real gap, not a zero.
          productivityScore: null,
        }));

        // **The roster renders before the scores arrive.** The window is 30 days (§3.1) and the
        // activity endpoint is per-day, so this is 30 requests; blocking the directory on them
        // would trade a working page for a spinner. The names, roles and departments are the point
        // of this screen — the score is an enrichment, and it fills in a moment later.
        setEmployees(rows);
        setLoading(false);

        // Photos, in ONE request for the whole roster — same reasoning as the scores below: the
        // directory is the point of this screen and must not wait on an enrichment. Absent ids
        // simply keep their initials, which is the correct state for someone with no photo.
        getEmployeeAvatarUrls(rows.map((r) => r.id))
          .then((urls) => {
            if (!live || Object.keys(urls).length === 0) return;
            setEmployees((prev) =>
              prev.map((r) => (urls[r.id] ? { ...r, avatarUrl: urls[r.id] } : r)),
            );
          })
          .catch(() => {
            /* decorative — initials are a correct fallback */
          });

        const scores = await scoresByUser().catch(() => new Map<string, number>());
        if (!live || scores.size === 0) return;
        setEmployees((prev) =>
          prev.map((r) => ({ ...r, productivityScore: scores.get(r.id) ?? null })),
        );
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

  const deactivate = useCallback(
    async (id: string) => {
      await deactivateEmployee(id);
      reload();
    },
    [reload],
  );

  const reactivate = useCallback(
    async (id: string) => {
      await reactivateEmployee(id);
      reload();
    },
    [reload],
  );

  // Optimistic: flip the row's `benched` immediately (a full directory refetch for a toggle is
  // overkill), and revert if the server rejects it.
  const bench = useCallback(async (id: string, benched: boolean) => {
    setEmployees((prev) => prev.map((r) => (r.id === id ? { ...r, benched } : r)));
    try {
      await setEmployeeBenched(id, benched);
    } catch (e) {
      setEmployees((prev) => prev.map((r) => (r.id === id ? { ...r, benched: !benched } : r)));
      throw e;
    }
  }, []);

  return { employees, loading, error, reload, deactivate, reactivate, bench };
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to the employee directory.";
    return e.message;
  }
  return "Couldn't load employees. Check your connection and retry.";
}
