"use client";

/**
 * The Activity tab's **single** AI summary — org-wide or one department, chosen in the card.
 *
 * This used to be a second, plainer card sitting under a blue "AI activity report" banner, so the
 * page opened with two AI-written narratives about the same period saying much the same thing. One
 * of them had to go, and the department-scoped one is the more useful: `"all"` produces the
 * org-wide reading the banner already gave, and the filter buys per-department detail the banner
 * could never express.
 *
 * Reuses the existing `getDeptSummary` / `regenerateDeptSummary` endpoints, so there is no new
 * backend and no per-item fan-out — one request per selection.
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { DepartmentFilter } from "@/components/shared/department-filter";
import { useDirectory } from "@/hooks/use-directory";
import { ApiError } from "@/lib/api";
import { formatHours } from "@/lib/format";
import { departmentMap } from "@/modules/employees/services/employees.service";
import {
  getDeptSummary,
  regenerateDeptSummary,
  type DeptPersonStat,
  type DeptSummary,
} from "../services/insights.service";
import { AiReportCard, type AiMetric } from "./ai-report-card";
import { PersonLink } from "./person-link";
import { deptSummaryProvenance, type Provenance } from "../lib/ai-provenance";
import { resolvePerson } from "../lib/attention";

const ALL = "all";

/**
 * Why the summary could not be read, in words that do not pretend it was an empty period. A refusal
 * and an outage used to fall into the same "No scored activity in this period yet." as a quiet week
 * (QA audit 2026-10-08, WP-274).
 */
function summaryError(e: unknown): { message: string; retryable: boolean } {
  if (e instanceof ApiError && e.status === 403) {
    // A refusal will refuse again, so it gets no retry.
    return {
      message:
        e.code === "feature_disabled"
          ? "AI summaries aren't available here — they're not part of your organization's plan, or they've been switched off in Settings → Features."
          : "Your role doesn't include AI summaries of team activity.",
      retryable: false,
    };
  }
  return {
    message: "The AI summary couldn't be loaded just now. Try again in a moment.",
    retryable: true,
  };
}

export function DepartmentScoreFocus({
  from,
  to,
  period,
}: {
  from: string;
  to: string;
  /**
   * A phrase for the window that stays true however later it is read ("the week"), so the prose
   * reads well; optional. It reaches the model's brief and the narrative is cached per range for
   * every viewer, so never a "today"/"this week" that goes stale.
   */
  period?: string;
}) {
  const [depts, setDepts] = useState<Map<string, string>>(new Map());
  const [dept, setDept] = useState<string>(ALL);
  const [data, setData] = useState<DeptSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [nonce, setNonce] = useState(0);
  /** The selection a Regenerate is running for, or `null` — see `regenerate`. */
  const [regenFor, setRegenFor] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    departmentMap()
      .then((m) => live && setDepts(m))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  const label = dept === ALL ? undefined : depts.get(dept);
  /** What the card is showing — a response must still match it to land. */
  const selection = `${dept}|${from}|${to}|${period ?? ""}`;
  const current = useRef(selection);
  useEffect(() => {
    current.current = selection;
  }, [selection]);

  useEffect(() => {
    if (!from || !to) return;
    let live = true;
    setLoading(true);
    setError(null);
    setNotice(null);
    // The previous selection's narrative and figures must not sit under this one's filter for the
    // length of a model call (QA audit 2026-10-08, WP-279).
    setData(null);
    getDeptSummary({ department: dept, from, to, label, period })
      .then((d) => live && setData(d))
      .catch((e) => live && setError(summaryError(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // Keyed on the label **string**, not the department map. The map is replaced once
    // `departmentMap()` resolves, which re-issued this identical request on every mount — and on a
    // cache miss that was two billed generations (QA audit 2026-10-08, WP-280).
  }, [dept, from, to, period, label, nonce]);

  async function regenerate() {
    if (regenFor === selection || !from || !to) return;
    const started = selection;
    setRegenFor(started);
    setNotice(null);
    try {
      const fresh = await regenerateDeptSummary({ department: dept, from, to, label, period });
      // A slow model run must not land under a department or period the user has since moved to
      // (QA audit 2026-10-08, WP-278).
      if (current.current === started) setData(fresh);
    } catch {
      // Keep the narrative already on screen — a failed re-run must not blank the card — but say so.
      if (current.current === started) {
        setNotice("Couldn't regenerate the summary — showing the previous one.");
      }
    } finally {
      setRegenFor((k) => (k === started ? null : k));
    }
  }

  const options = useMemo(
    () => Array.from(depts.entries()).sort((a, b) => a[1].localeCompare(b[1])),
    [depts],
  );

  /**
   * A named person as a link to their Activity — and, for a single day, their screenshots that day
   * (UX audit 2026-10-16, MON-04). The summary names people without an id, so the name is matched
   * against the directory and stays plain text when it isn't exactly one person. The hours tracked
   * go alongside: the one thing behind the score this payload carries.
   */
  const { employees } = useDirectory();
  const person = (p: DeptPersonStat | null): Pick<AiMetric, "value" | "hint"> =>
    p
      ? {
          value: (
            <>
              <PersonLink
                userId={resolvePerson(p.name, employees)?.user_id ?? null}
                name={p.name}
                date={from === to ? to : undefined}
                tone="onFeature"
              />{" "}
              · {p.score}
            </>
          ),
          hint: `${formatHours(p.hours)} tracked`,
        }
      : { value: "—" };

  /**
   * Absent figures stay absent rather than rendering as `0`. "Avg score 0/100" is a verdict on the
   * team; "—" is the truth when nobody was scored in the window.
   */
  const metrics: AiMetric[] = data
    ? [
        {
          label: "Avg score",
          value: data.metrics.avg_score == null ? "—" : data.metrics.avg_score,
          hint: data.metrics.avg_score == null ? undefined : "/ 100",
        },
        {
          label: "Reporting",
          value: `${data.metrics.scored_people} / ${data.metrics.total_people}`,
        },
        { label: "Top performer", ...person(data.metrics.top_performer) },
        { label: "Needs attention", ...person(data.metrics.needs_improvement) },
      ]
    : [];

  const summary =
    loading && !data
      ? "Reading the scores for this period…"
      : error
        ? error.message
        : data?.narrative || "No scored activity in this period yet.";

  /**
   * Who wrote it (MON-08). The fixed line for an unscored period is visible as such; otherwise this
   * payload can't say whether the model or the server's fallback wrote it, so the card claims
   * neither — no "AI" in the title, and a line saying it is usually AI and can be wrong.
   */
  const provenance: Provenance = data ? deptSummaryProvenance(data) : { kind: "none" };

  return (
    <AiReportCard
      title="Activity summary"
      provenance={provenance}
      summary={summary}
      metrics={metrics}
      notice={notice}
      onRetry={error?.retryable ? () => setNonce((n) => n + 1) : undefined}
      action={
        <DepartmentFilter
          value={dept}
          onChange={setDept}
          options={options.map(([id, name]) => ({ value: id, label: name }))}
          tone="onFeature"
          className="w-60"
          ariaLabel="Summarise which department"
        />
      }
      // Only once a narrative exists: an empty period has nothing to re-run, and each press is a
      // fresh billed generation.
      // The server's fixed line for an unscored period is never generated, so a re-run (a billed
      // model call) could not change it either (MON-08).
      onRegenerate={data?.narrative && provenance.kind !== "computed" ? regenerate : undefined}
      regenerating={regenFor === selection}
    />
  );
}
