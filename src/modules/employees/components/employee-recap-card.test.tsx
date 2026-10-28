import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUserRecap: vi.fn(), regenerateUserRecap: vi.fn() }));

vi.mock("@/modules/insights/services/insights.service", () => ({
  getUserRecap: (...a: unknown[]) => mocks.getUserRecap(...a),
  regenerateUserRecap: (...a: unknown[]) => mocks.regenerateUserRecap(...a),
}));
// This file tests the card's rules, not the picker.
vi.mock("@/components/ui/date-picker", () => ({
  DatePicker: (p: { value: string; onChange: (v: string) => void }) => (
    <input aria-label="Day" value={p.value} onChange={(e) => p.onChange(e.target.value)} />
  ),
}));

import { ApiError } from "@/lib/api";
import { EmployeeRecapCard } from "./employee-recap-card";

const OCT_20 = new Date(2026, 9, 20, 9, 0).getTime();
const metrics = {
  attendance: "partial",
  late: false,
  worked_minutes: 60,
  tracked_secs: 3600,
  billable_secs: 0,
  entry_count: 1,
  task_count: 0,
};

beforeEach(() => {
  mocks.getUserRecap.mockReset();
  mocks.regenerateUserRecap.mockReset();
});

/** AI-30: the card reads the server's `ai_generated` / `model`, and keeps no stale text. */
describe("EmployeeRecapCard", () => {
  it("does not call a stamped fallback AI when the server says it wrote it", async () => {
    mocks.getUserRecap.mockResolvedValue({
      date: "2026-10-20",
      metrics,
      narrative: "- Tracked 01:00:00 on the timer.",
      generated_at: OCT_20,
      ai_generated: false,
      model: null,
    });
    render(<EmployeeRecapCard userId="u1" name="Agent Tester" />);
    expect(await screen.findByText("Tracked 01:00:00 on the timer.")).toBeInTheDocument();
    expect(screen.getByText("Summary of the figures · not written by AI")).toBeInTheDocument();
    expect(screen.queryByText("AI summary")).not.toBeInTheDocument();
  });

  it("brands the model's text as AI without printing the model id", async () => {
    mocks.getUserRecap.mockResolvedValue({
      date: "2026-10-20",
      metrics,
      narrative: "- A short, steady day.",
      generated_at: OCT_20,
      ai_generated: true,
      model: "openai/gpt-oss-20b",
    });
    render(<EmployeeRecapCard userId="u1" name="Agent Tester" />);
    expect(await screen.findByText("AI summary")).toBeInTheDocument();
    expect(screen.getByText(/^AI-generated · .+ · may be wrong$/)).toBeInTheDocument();
    expect(screen.queryByText(/openai/)).not.toBeInTheDocument();
  });

  it("still works against a server without the fields — the stamp is the tell", async () => {
    mocks.getUserRecap.mockResolvedValue({
      date: "2026-10-20",
      metrics,
      narrative: "- A short, steady day.",
      generated_at: OCT_20,
    });
    render(<EmployeeRecapCard userId="u1" name="Agent Tester" />);
    expect(await screen.findByText("AI summary")).toBeInTheDocument();
  });

  it("drops the previous period's text when the next period fails to load", async () => {
    mocks.getUserRecap.mockResolvedValueOnce({
      date: "2026-10-20",
      metrics,
      narrative: "- The daily narrative.",
      generated_at: OCT_20,
      ai_generated: true,
    });
    render(<EmployeeRecapCard userId="u1" name="Agent Tester" />);
    expect(await screen.findByText("The daily narrative.")).toBeInTheDocument();

    mocks.getUserRecap.mockRejectedValueOnce(new ApiError("Server error", 500));
    fireEvent.click(screen.getByRole("button", { name: "Weekly" }));
    expect(await screen.findByText("Couldn't load the summary.")).toBeInTheDocument();
    expect(screen.queryByText("The daily narrative.")).not.toBeInTheDocument();
    expect(screen.queryByText("AI summary")).not.toBeInTheDocument();
  });

  it("says the evidence base in words, and the week in plain terms (AI-57)", async () => {
    mocks.getUserRecap
      .mockResolvedValueOnce({ date: "2026-10-20", metrics, narrative: "" })
      .mockResolvedValueOnce({
        aggregate: {},
        narrative: "- Two days logged.",
        generated_at: OCT_20,
        ai_generated: true,
        source_days: 1,
      });
    render(<EmployeeRecapCard userId="u1" name="Agent Tester" />);
    await waitFor(() => expect(mocks.getUserRecap).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Weekly" }));
    expect(await screen.findByText(/^Based on 1 day with a summary · AI-generated/)).toBeInTheDocument();
    expect(screen.getByText("this week, Monday to Sunday")).toBeInTheDocument();
    expect(screen.queryByText(/ISO|day\(s\)/)).not.toBeInTheDocument();
  });
});
