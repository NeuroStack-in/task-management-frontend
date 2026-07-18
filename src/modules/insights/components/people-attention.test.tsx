import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the data hook so we test the component's render states (loading/empty/data) in isolation —
// no network, no timers. This locks the honest "all clear" empty state and the flagged-row render.
vi.mock("../use-attention", () => ({ useAttention: vi.fn() }));

import { useAttention } from "../use-attention";
import { PeopleAttentionCard } from "./people-attention";

const mockHook = vi.mocked(useAttention);
const base = { loading: false, error: null, reload: vi.fn() };
beforeEach(() => mockHook.mockReset());

describe("PeopleAttentionCard", () => {
  it("shows an honest 'All clear' when no one is flagged", () => {
    mockHook.mockReturnValue({
      ...base,
      data: { date: "2026-07-17", people: [], narrative: "No one is flagged today." },
    });
    render(<PeopleAttentionCard />);
    expect(screen.getByText(/All clear/i)).toBeInTheDocument();
    expect(screen.getByText(/No one is flagged today\./i)).toBeInTheDocument();
  });

  it("renders a flagged person with score, severity and reasons", () => {
    mockHook.mockReturnValue({
      ...base,
      data: {
        date: "2026-07-17",
        people: [
          {
            user_id: "u1",
            name: "Ada Lovelace",
            score: 42,
            anomaly_count: 2,
            top_severity: "high",
            reasons: ["overtime", "idle"],
            attention: 120,
          },
        ],
        narrative: "Check in with Ada.",
      },
    });
    render(<PeopleAttentionCard />);
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText(/score 42/i)).toBeInTheDocument();
    // Anomaly slugs are mapped to human labels.
    expect(screen.getByText(/Overtime/i)).toBeInTheDocument();
  });

  it("surfaces the error state", () => {
    mockHook.mockReturnValue({ ...base, data: null, error: "Couldn't load the attention list." });
    render(<PeopleAttentionCard />);
    expect(screen.getByText(/Couldn't load the attention list\./i)).toBeInTheDocument();
  });
});
