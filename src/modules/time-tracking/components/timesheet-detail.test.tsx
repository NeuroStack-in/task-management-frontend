/**
 * The range drill-down, opened for a **month**.
 *
 * This exists because the same mistake has now been made twice in this feature: treating the array
 * index as a weekday. It is correct only for a Monday-aligned week, so a month got `DAY_LABELS[i]`
 * — seven names followed by twenty-four `undefined` — and a per-bar `HH:MM:SS` label that could not
 * shrink, which pushed the chart out of the dialog where `overflow-x-hidden` clipped it.
 *
 * August 2026 is the fixture on purpose: it starts on a **Saturday**, so anything that assumes the
 * first column is a Monday is wrong on the very first bar.
 */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { formatDate } from "@/lib/format";
import { ActivityDialog, type ActivityView } from "./timesheet-detail";

/** A bar's date as the shared helper prints it in this environment's locale ("Sat, Aug 1" in en-US). */
const bar = (iso: string) => formatDate(iso, { weekday: true, year: false });

const AUG_2026 = Array.from(
  { length: 31 },
  (_, i) => `2026-08-${String(i + 1).padStart(2, "0")}`,
);

function monthView(overrides: Partial<Extract<ActivityView, { kind: "range" }>> = {}) {
  return {
    kind: "range",
    rowId: "u1",
    name: "Kishore M",
    subtitle: "Engineering",
    isProject: false,
    status: "on-track",
    rangeLabel: "Aug 1 – 31, 2026",
    period: "month",
    dates: AUG_2026,
    // 4.8h every day — a flat month, so any per-bar difference on screen is layout, not data.
    days: AUG_2026.map(() => 4.8),
    entriesByDay: AUG_2026.map(() => [{ label: "Workpulse Testing", hours: 4.8 }]),
    ...overrides,
  } as ActivityView;
}

describe("ActivityDialog · month range", () => {
  it("says month, not week", () => {
    render(<ActivityDialog view={monthView()} onClose={() => {}} />);
    expect(screen.getByText(/Monthly time · Aug 1 – 31, 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/Weekly time/)).not.toBeInTheDocument();
    expect(screen.getByText("Projects this month")).toBeInTheDocument();
  });

  it("labels every bar from its real date — no undefined past the seventh", () => {
    render(<ActivityDialog view={monthView()} onClose={() => {}} />);
    // The dialog renders through a portal, so it is on `document.body`, not the render container.
    // One hoverable track per day, titled with the real weekday: Aug 1 2026 is a Saturday.
    const titles = Array.from(document.body.querySelectorAll("[title]")).map((el) =>
      el.getAttribute("title"),
    );
    expect(titles).toHaveLength(31);
    expect(titles[0]).toBe(`${bar("2026-08-01")} · 04:48:00`);
    expect(titles[0]).toMatch(/^Sat/);
    expect(titles[2]).toBe(`${bar("2026-08-03")} · 04:48:00`);
    expect(titles[2]).toMatch(/^Mon/);
    expect(titles[30]).toBe(`${bar("2026-08-31")} · 04:48:00`);
    expect(titles.some((t) => t?.includes("undefined"))).toBe(false);
  });

  it("ticks the axis as a scale rather than naming all 31 bars", () => {
    render(<ActivityDialog view={monthView()} onClose={() => {}} />);
    // The 1st and every 5th — never a weekday name, which says nothing about *which* Tuesday.
    for (const d of ["1", "5", "10", "15", "20", "25", "30"]) {
      expect(screen.getByText(d)).toBeInTheDocument();
    }
    expect(screen.queryByText("Mon")).not.toBeInTheDocument();
  });

  it("drops the unshrinkable per-bar duration label that overflowed the dialog", () => {
    render(<ActivityDialog view={monthView()} onClose={() => {}} />);
    // The month's hours are still stated — once as the total, once against the only project the
    // fixture logs to. What is gone is the 31 per-bar copies, which is what did not fit.
    expect(screen.getAllByText("148:48:00")).toHaveLength(2);
    const chart = screen.getByText("Hours per day").parentElement!;
    expect(within(chart).queryByText("04:48:00")).not.toBeInTheDocument();
  });

  it("still names all seven bars and shows their durations for a week", () => {
    const week = ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06"];
    render(
      <ActivityDialog
        view={monthView({
          period: "week",
          rangeLabel: "Aug 31 – Sep 6, 2026",
          dates: week,
          days: week.map(() => 4.8),
          entriesByDay: week.map(() => []),
        })}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/Weekly time/)).toBeInTheDocument();
    for (const d of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
      expect(screen.getByText(d)).toBeInTheDocument();
    }
    const chart = screen.getByText("Hours per day").parentElement!;
    expect(within(chart).getAllByText("04:48:00")).toHaveLength(7);
  });

  it("gives every month bar its figure in text, not only in the tooltip (TIME-15)", () => {
    render(<ActivityDialog view={monthView()} onClose={() => {}} />);
    expect(screen.getByText(`${bar("2026-08-01")}: 04:48:00`)).toHaveClass("sr-only");
  });
});

describe("ActivityDialog · low activity (TIME-16)", () => {
  const day = (overrides: Partial<Extract<ActivityView, { kind: "day" }>> = {}) =>
    ({
      kind: "day",
      rowId: "u1",
      name: "Kishore M",
      subtitle: "Engineering",
      isProject: false,
      status: "flagged",
      activity: 42,
      periodLabel: "Oct 12 – 18, 2026",
      dateLabel: "Tue, Oct 13, 2026",
      hours: 2,
      entries: [{ label: "Workpulse Testing", hours: 2 }],
      ...overrides,
    }) as ActivityView;

  it("names the mark and its score in a neutral chip — never a red “Flagged”", () => {
    render(<ActivityDialog view={day()} onClose={() => {}} />);
    expect(screen.queryByText("Flagged")).not.toBeInTheDocument();
    const chip = screen.getByText(/Low activity · avg 42%/);
    expect(chip.className).not.toMatch(/(^|\s)(bg|text)-destructive/);
  });

  it("says what the mark means and which period it covers", () => {
    render(<ActivityDialog view={day()} onClose={() => {}} />);
    expect(
      screen.getByText(/average activity score for Oct 12 – 18, 2026 is 42%, under 50%/),
    ).toBeInTheDocument();
  });

  it("shows nothing for a row that isn't marked", () => {
    render(<ActivityDialog view={day({ status: "on-track", activity: 80 })} onClose={() => {}} />);
    expect(screen.queryByText(/Low activity/)).not.toBeInTheDocument();
  });
});
