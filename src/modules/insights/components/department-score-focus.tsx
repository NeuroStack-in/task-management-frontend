"use client";

/**
 * Per-department productivity-score focus for the Analytics/Activity page.
 *
 * A single-department deep-dive (average score + coverage + Top/Needs performers + an AI line),
 * scoped to the range the Activity page is already showing. Distinct from the dashboard's Team
 * comparison, which shows every department at once as bars — this is the analytics home for reading
 * one department's score in context. Reuses the existing `getDeptSummary` endpoint, so no per-item
 * fan-out and no new backend.
 */

import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader } from "@/components/shared/loader";
import { Markdown } from "@/components/shared/markdown";
import { departmentMap } from "@/modules/employees/services/employees.service";
import {
  getDeptSummary,
  type DeptPersonStat,
  type DeptSummary,
} from "../services/insights.service";

const ALL = "all";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-heading text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

const person = (p: DeptPersonStat | null) =>
  p ? `${p.name} · ${p.score}` : "—";

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

  useEffect(() => {
    let live = true;
    departmentMap()
      .then((m) => live && setDepts(m))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!from || !to) return;
    let live = true;
    setLoading(true);
    const label = dept === ALL ? undefined : depts.get(dept);
    getDeptSummary({ department: dept, from, to, label, period })
      .then((d) => live && setData(d))
      .catch(() => live && setData(null))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [dept, from, to, period, depts]);

  const options = useMemo(
    () =>
      Array.from(depts.entries()).sort((a, b) => a[1].localeCompare(b[1])),
    [depts],
  );

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-heading flex items-center gap-2 text-base font-medium">
          <Sparkles className="text-primary size-4" /> Score by department
        </h3>
        <Select value={dept} onValueChange={(v) => setDept(String(v))}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All departments</SelectItem>
            {options.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && !data ? (
        <div className="flex min-h-[4rem] items-center">
          <Loader label="Loading the department's scores…" />
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat
              label="Avg score"
              value={
                data.metrics.avg_score == null
                  ? "—"
                  : `${data.metrics.avg_score}/100`
              }
            />
            <Stat
              label="Reporting"
              value={`${data.metrics.scored_people} / ${data.metrics.total_people}`}
            />
            <Stat label="Top performer" value={person(data.metrics.top_performer)} />
            <Stat
              label="Needs attention"
              value={person(data.metrics.needs_improvement)}
            />
          </div>
          {data.narrative ? (
            <Markdown className="text-muted-foreground text-sm leading-relaxed">
              {data.narrative}
            </Markdown>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
