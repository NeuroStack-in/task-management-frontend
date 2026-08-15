/**
 * Axis labels for Recharts charts — one definition, so every chart in the app names its axes the
 * same way.
 *
 * **Why this exists.** Every chart here plots something a reader cannot guess. A bare "20" on a
 * monitoring chart reads equally well as hours, percent, people or events; "Mon" on an x-axis could
 * be a day of the week or a week starting Monday. The app had charts titled "Activity by hour"
 * whose y-axis counted *screenshot captures* — not minutes, not people — with nothing on the chart
 * saying so. Someone seeing it for the first time had no way to know what they were looking at.
 *
 * So: **every axis names its quantity, and the unit is part of the name.** Titles and captions
 * explain intent; the axis states the measure.
 *
 * ```tsx
 * <XAxis dataKey="label" {...xAxisLabel("Hour of day")} />
 * <YAxis {...yAxisLabel("Captures")} />
 * <AreaChart margin={CHART_MARGIN}> // room for both labels
 * ```
 */

const AXIS_LABEL_STYLE = {
  fontSize: 11,
  fill: "var(--muted-foreground)",
} as const;

/**
 * Label under the x-axis, e.g. `"Hour of day"`, `"Day"`, `"Week starting"`.
 *
 * Spread onto `<XAxis>`; it supplies only `label`, so the chart keeps its own `dataKey`, ticks and
 * formatting.
 */
export function xAxisLabel(value: string) {
  return {
    label: {
      value,
      position: "insideBottom" as const,
      offset: -4,
      style: AXIS_LABEL_STYLE,
    },
  };
}

/**
 * Rotated label beside the y-axis, e.g. `"Captures"`, `"Score (0–100)"`, `"Hours"`.
 *
 * **Include the unit.** "Score" and "Score (0–100)" are not equally useful: the second tells a
 * reader whether 60 is good without them having to infer it from the axis ticks.
 */
export function yAxisLabel(value: string) {
  return {
    label: {
      value,
      angle: -90 as const,
      position: "insideLeft" as const,
      style: { ...AXIS_LABEL_STYLE, textAnchor: "middle" as const },
    },
  };
}

/**
 * Margins that leave room for both labels.
 *
 * Charts here often used a negative left margin to pull the plot area tight against the card. That
 * clips a rotated y-axis label entirely — the label renders, off-canvas, and the chart looks
 * unlabelled while the code says otherwise. Bottom room is for the x-axis label sitting under the
 * ticks.
 */
export const CHART_MARGIN = { top: 8, right: 12, bottom: 18, left: 4 } as const;

/** As {@link CHART_MARGIN}, with room for a legend rendered above the plot. */
export const CHART_MARGIN_WITH_LEGEND = {
  top: 4,
  right: 12,
  bottom: 18,
  left: 4,
} as const;
