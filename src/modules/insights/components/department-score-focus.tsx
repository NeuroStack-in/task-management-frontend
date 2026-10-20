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
import { LOW_SCORE_BELOW, RANK_MIN_MINUTES_PER_DAY, isLowScore } from "../lib/thresholds";

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
  dept: deptProp,
  onDeptChange,
}: {
  from: string;
  to: string;
  /**
   * The department in view, when the page holds it (the Activity tab keeps it in the URL so it
   * survives a tab switch — UX audit MON-13). Omitted, the card keeps its own.
   */
  dept?: string;
  onDeptChange?: (id: string) => void;
  /**
   * A phrase for the window that stays true however later it is read ("the week"), so the prose
   * reads well; optional. It reaches the model's brief and the narrative is cached per range for
   * every viewer, so never a "today"/"this week" that goes stale.
   */
  period?: string;
}) {
  const [depts, setDepts] = useState<Map<string, string>>(new Map());
  const [ownDept, setOwnDept] = useState<string>(ALL);
  const dept = deptProp ?? ownDept;
  const setDept = onDeptChange ?? setOwnDept;
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
   * (UX audit 2026-10-16, MON-04) — by the `user_id` the summary sends. A server that predates the
   * field sends the name alone; then it is matched against the directory and stays plain text when
   * it isn't exactly one person. The hours tracked go alongside: the one thing behind the score this
   * payload carries.
   */
  const { employees } = useDirectory();
  const person = (p: DeptPersonStat | null): Pick<AiMetric, "value" | "hint"> =>
    p
      ? {
          value: (
            <>
              <PersonLink
                userId={p.user_id || resolvePerson(p.name, employees)?.user_id || null}
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
        // The server names the period's lowest scorer whatever the score; "Needs attention" means a
        // score under the one line every Analytics surface uses, so above it they are just the
        // lowest (UX audit 2026-10-16, MON-18).
        {
          label:
            data.metrics.needs_improvement && !isLowScore(data.metrics.needs_improvement.score)
              ? "Lowest score"
              : "Needs attention",
          ...person(data.metrics.needs_improvement),
        },
      ]
    : [];
  /** The rules behind those two names, said where they are used (MON-18). */
  const footnote = data
    ? `Top performer and lowest score are picked from people who tracked at least ${RANK_MIN_MINUTES_PER_DAY} minutes a day. Needs attention means a score under ${LOW_SCORE_BELOW}, the line every Analytics page uses.`
    : null;

  const summary =
    loading && !data
      ? "Reading the scores for this period…"
      : error
        ? error.message
        : data?.narrative || "No scored activity in this period yet.";

  /**
   * Who wrote it (MON-08) — the server says, with `ai_generated` / `model`. From a server that
   * predates those, the fixed line for an unscored period is still visible as such, and otherwise
   * the card claims neither: no "AI" in the title, and a line saying it is usually AI and can be
   * wrong.
   */
  const provenance: Provenance = data ? deptSummaryProvenance(data) : { kind: "none" };
  /**
   * A re-run can change the text when a model wrote it, when an older payload can't say, or when
   * the server wrote the line itself over a scored period (the provider was down, or another reader
   * was generating) — never over an unscored one, whose fixed line is the whole answer.
   */
  const canRerun =
    !!data?.narrative &&
    (provenance.kind !== "computed" ||
      (data.ai_generated === false && data.metrics.scored_people > 0));

  return (
    <AiReportCard
      title="Activity summary"
      provenance={provenance}
      summary={summary}
      metrics={metrics}
      footnote={footnote}
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
      // Only once a narrative exists, and only where a re-run could change it (`canRerun`) — each
      // press is a fresh billed generation (MON-08).
      onRegenerate={canRerun ? regenerate : undefined}
      regenerating={regenFor === selection}
    />
  );
}
