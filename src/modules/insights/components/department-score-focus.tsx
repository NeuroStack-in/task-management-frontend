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

import { useEffect, useMemo, useState } from "react";

import { DepartmentFilter } from "@/components/shared/department-filter";
import { departmentMap } from "@/modules/employees/services/employees.service";
import {
  getDeptSummary,
  regenerateDeptSummary,
  type DeptPersonStat,
  type DeptSummary,
} from "../services/insights.service";
import { AiReportCard, type AiMetric } from "./ai-report-card";

const ALL = "all";

const person = (p: DeptPersonStat | null) => (p ? `${p.name} · ${p.score}` : "—");

export function DepartmentScoreFocus({
  from,
  to,
  period,
}: {
  from: string;
  to: string;
  /** Natural window phrase ("this week") so the prose reads well; optional. */
  period?: string;
}) {
  const [depts, setDepts] = useState<Map<string, string>>(new Map());
  const [dept, setDept] = useState<string>(ALL);
  const [data, setData] = useState<DeptSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

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

  useEffect(() => {
    if (!from || !to) return;
    let live = true;
    setLoading(true);
    getDeptSummary({ department: dept, from, to, label, period })
      .then((d) => live && setData(d))
      .catch(() => live && setData(null))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dept, from, to, period, depts]);

  async function regenerate() {
    if (regenerating || !from || !to) return;
    setRegenerating(true);
    try {
      setData(await regenerateDeptSummary({ department: dept, from, to, label, period }));
    } catch {
      /* keep the narrative already on screen — a failed re-run must not blank the card */
    } finally {
      setRegenerating(false);
    }
  }

  const options = useMemo(
    () => Array.from(depts.entries()).sort((a, b) => a[1].localeCompare(b[1])),
    [depts],
  );

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
        { label: "Top performer", value: person(data.metrics.top_performer) },
        { label: "Needs attention", value: person(data.metrics.needs_improvement) },
      ]
    : [];

  const summary = loading && !data
    ? "Reading the scores for this period…"
    : data?.narrative || "No scored activity in this period yet.";

  return (
    <AiReportCard
      title="AI activity report"
      summary={summary}
      metrics={metrics}
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
      onRegenerate={data?.narrative ? regenerate : undefined}
      regenerating={regenerating}
    />
  );
}
