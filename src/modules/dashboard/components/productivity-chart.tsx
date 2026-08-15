"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_MARGIN, xAxisLabel, yAxisLabel } from "@/components/shared/chart-axis";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TrendPoint } from "@/modules/dashboard/lib/dashboard-data";
import { ChartLegendInfo } from "@/components/shared/chart-legend-info";

/**
 * The stack, bottom → top. Order is fixed and meaningful (good → neutral → bad → absent), which is
 * itself the secondary encoding that keeps Productive (green) and Distracting (red) readable under
 * colour-vision deficiency — Neutral (blue) sits between them, so the two never touch, and every
 * segment is also legend- and tooltip-labelled. Palette validated (light: all checks pass; dark:
 * CVD/contrast/chroma pass) via the dataviz validator against the card surface.
 */
const CATEGORIES = [
  { key: "productiveH", name: "Productive", color: "var(--success)" },
  { key: "neutralH", name: "Neutral", color: "var(--chart-3)" },
  { key: "distractingH", name: "Distracting", color: "var(--negative)" },
  // Faded on purpose: tracked time the agent couldn't classify. Recessive so it never competes with
  // the real categories, but present so an unclassified day reads as "unknown", not "zero".
  { key: "unclassifiedH", name: "Unclassified", color: "var(--muted-foreground)", faded: true },
] as const;

const fmtHours = (h: number) => `${h % 1 === 0 ? h : h.toFixed(1)} h`;

/** Custom tooltip: total hours + per-category (zeros hidden) + coverage — the honest full picture. */
function MixTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string; payload?: TrendPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  const total = payload.reduce((s, p) => s + (typeof p.value === "number" ? p.value : 0), 0);
  return (
    <div className="bg-popover text-popover-foreground border-border rounded-[var(--radius)] border p-2.5 text-xs shadow-md">
      <div className="mb-1.5 flex items-baseline justify-between gap-4">
        <span className="text-muted-foreground font-medium">{row?.label}</span>
        <span className="font-semibold">{fmtHours(Math.round(total * 10) / 10)} active</span>
      </div>
      <ul className="space-y-1">
        {payload
          .filter((p) => typeof p.value === "number" && p.value > 0)
          .map((p) => (
            <li key={p.name} className="flex items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-[2px]"
                style={{ background: p.color }}
                aria-hidden
              />
              <span className="text-muted-foreground flex-1">{p.name}</span>
              <span className="font-medium tabular-nums">{fmtHours(p.value as number)}</span>
            </li>
          ))}
      </ul>
      <div className="text-muted-foreground border-border/60 mt-2 border-t pt-1.5">
        {row?.reported ? `${row.reported} reported` : "nobody reported"}
      </div>
    </div>
  );
}

export function ProductivityChart({
  data,
  rangeLabel,
}: {
  data: TrendPoint[];
  rangeLabel: string;
}) {
  const totalHours = data.reduce(
    (s, d) => s + d.productiveH + d.neutralH + d.distractingH + d.unclassifiedH,
    0,
  );
  const hasUnclassified = data.some((d) => d.unclassifiedH > 0);
  const anyClassified = data.some(
    (d) => d.productiveH + d.neutralH + d.distractingH > 0,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          Where time went
          <ChartLegendInfo
            label="What the activity mix means"
            terms={[
              {
                term: "Productive / Neutral / Distracting",
                definition:
                  "Active hours split by how your rules classify the apps and sites in use.",
              },
              {
                term: "Unclassified",
                definition: (
                  <>
                    Active time (keyboard/mouse input) the agent recorded but could <em>not</em>{" "}
                    attribute to any app category yet — tracked, but not judged.
                  </>
                ),
              },
            ]}
          />
        </CardTitle>
        {/* Replaces the old dual-axis "score vs. share" line. Both series there shared one 0–100
            axis (a black-box score and a percentage), and the score sat at ~50 on any day apps
            weren't classified — a partial score shown as if real. Concrete hours can't do that. */}
        <CardDescription>Active hours by activity type · {rangeLabel}</CardDescription>
      </CardHeader>
      <CardContent>
        {totalHours === 0 ? (
          <div className="text-muted-foreground flex h-full min-h-[150px] flex-col items-center justify-center gap-1 text-center text-sm">
            <span>No activity reported for this period.</span>
            <span className="text-xs">Days fill in as the desktop agent reports.</span>
          </div>
        ) : (
          <div className="h-full min-h-[150px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={CHART_MARGIN} barCategoryGap="28%">
                <CartesianGrid vertical={false} stroke="var(--border)" />
                {/* Each bar is a week once the month view folds, so the axis has to say what a
                    tick *is* — "8/3" under an axis labelled "this month" reads as a day. */}
                <XAxis
                  dataKey="label"
                  {...xAxisLabel(
                    // The tick now carries the span itself, so the axis only has to name the unit.
                    rangeLabel.includes("by week") ? "Week" : rangeLabel,
                  )}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  {...yAxisLabel("Hours")}
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                />
                <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} content={<MixTooltip />} />
                <Legend
                  verticalAlign="top"
                  height={26}
                  iconType="square"
                  wrapperStyle={{ fontSize: 11 }}
                />
                {CATEGORIES.map((c, i) => (
                  <Bar
                    key={c.key}
                    dataKey={c.key}
                    stackId="hours"
                    name={c.name}
                    fill={c.color}
                    // A thin surface-coloured outline is the 2px gap between stacked fills.
                    stroke="var(--card)"
                    strokeWidth={1.5}
                    fillOpacity={"faded" in c && c.faded ? 0.28 : 1}
                    // Round only the top of the stack (the data-end); baseline stays square.
                    radius={i === CATEGORIES.length - 1 ? [3, 3, 0, 0] : undefined}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {hasUnclassified && anyClassified && (
          <p className="text-muted-foreground mt-2 text-xs">
            Faded = time tracked but not yet classified (needs the desktop agent&rsquo;s app data).
          </p>
        )}
        {hasUnclassified && !anyClassified && totalHours > 0 && (
          <p className="text-muted-foreground mt-2 text-xs">
            Time is being tracked, but no apps are classified yet — install/enable the desktop agent
            to see the productive/neutral/distracting split.
          </p>
        )}

        {/* Below the chart, NOT in the header: on the dashboard this card is a draggable widget whose
            grid overlays a drag handle + remove button at the top-right on hover. Anything placed
            there gets shredded, so the affordance lives where the widget owns no space. */}
        <div className="mt-2 flex justify-end">
          <Link
            href="/insights/activity"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium transition-colors"
          >
            Activity details
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
