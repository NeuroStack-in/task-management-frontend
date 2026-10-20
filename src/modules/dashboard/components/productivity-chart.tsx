"use client";

import { useId } from "react";
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
import { formatHours } from "@/lib/format";
import { ChartLegendInfo } from "@/components/shared/chart-legend-info";

/**
 * A neutral grey at `pct`% ink — the text colour mixed into the card surface. The same ramp the
 * Analytics → Activity tab uses for app rules (`activity-tab.tsx`), so the two pages agree.
 */
const ink = (pct: number) => `color-mix(in srgb, var(--foreground) ${pct}%, var(--card))`;

/**
 * The stack, bottom → top, in one neutral hue stepped by lightness — an ordered scale, not a
 * green/red verdict (UX audit 2026-10-16, XC-08 / MON-07). These categories come from the org's
 * **app-name rules**, and the owner's decision of 2026-10-13 is that app names decide nothing: the
 * AI judges screenshots against each person's role. Painting a rule-matched app red "Distracting"
 * passed a verdict nobody made. Every segment is still legend- and tooltip-labelled.
 *
 * Unclassified is hatched rather than a fourth grey, so it can never be mistaken for the lightest
 * rule category: active time no app span covered — "unknown", not "zero".
 */
const CATEGORIES = [
  { key: "productiveH", name: "Productive", color: ink(80) },
  { key: "neutralH", name: "Neutral", color: ink(55) },
  { key: "distractingH", name: "Distracting", color: ink(35) },
  { key: "unclassifiedH", name: "Unclassified", color: "var(--muted-foreground)", hatched: true },
] as const;

const fmtHours = (h: number) => formatHours(h);

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
        <span className="font-semibold">{fmtHours(total)} active</span>
      </div>
      <ul className="space-y-1">
        {payload
          .filter((p) => typeof p.value === "number" && p.value > 0)
          .map((p) => (
            <li key={p.name} className="flex items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-[2px]"
                // The hatched band's fill is an SVG pattern reference, which a CSS background can't
                // draw — the same hatch as a gradient.
                style={{
                  background: p.color?.startsWith("url(")
                    ? "repeating-linear-gradient(45deg, var(--muted-foreground) 0 1.5px, transparent 1.5px 4px)"
                    : p.color,
                }}
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
  // One pattern per chart instance — the dashboard can hold more than one.
  const hatchId = `wp-unclassified-${useId().replace(/:/g, "")}`;

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
                  "Active hours split by your organization's own app rules, from each app's name — not the AI's judgement. The AI reviews screenshots against each person's role and ignores app names.",
              },
              {
                term: "Unclassified",
                definition:
                  "Active time the agent recorded but couldn't match to an app — tracked, not rated.",
              },
            ]}
          />
        </CardTitle>
        {/* Replaces the old dual-axis "score vs. share" line. Both series there shared one 0–100
            axis (a black-box score and a percentage), and the score sat at ~50 on any day apps
            weren't classified — a partial score shown as if real. Concrete hours can't do that. */}
        <CardDescription>
          Active hours by your app rules (not AI) · {rangeLabel}
        </CardDescription>
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
                <defs>
                  <pattern
                    id={hatchId}
                    width="6"
                    height="6"
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(45)"
                  >
                    <rect width="6" height="6" fill="var(--card)" />
                    <line x1="0" y1="0" x2="0" y2="6" stroke="var(--muted-foreground)" strokeWidth="2" />
                  </pattern>
                </defs>
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
                  // Recharts inks each label in its series colour — the lightest grey step made
                  // "Distracting" unreadable. The swatch carries the colour; the words stay legible.
                  formatter={(value) => (
                    <span style={{ color: "var(--muted-foreground)" }}>{value}</span>
                  )}
                />
                {CATEGORIES.map((c, i) => (
                  <Bar
                    key={c.key}
                    dataKey={c.key}
                    stackId="hours"
                    name={c.name}
                    fill={"hatched" in c && c.hatched ? `url(#${hatchId})` : c.color}
                    // A thin surface-coloured outline is the 2px gap between stacked fills.
                    stroke="var(--card)"
                    strokeWidth={1.5}
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
            Hatched = time tracked that couldn&rsquo;t be matched to an app.
          </p>
        )}
        {hasUnclassified && !anyClassified && totalHours > 0 && (
          <p className="text-muted-foreground mt-2 text-xs">
            Time is being tracked, but no app data has come with it yet — the split by your app rules
            appears once the desktop agent reports which apps were in use.
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
