import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the data sources so we test the component's render states in isolation — no network, no timers.
// The card reads attendance status (absent / partial) + the directory for names.
vi.mock("@/modules/attendance/services/attendance.service", () => ({
  getDayOversight: vi.fn(),
}));
vi.mock("@/modules/employees/services/employees.service", () => ({
  listAllEmployees: vi.fn(),
}));

import { getDayOversight } from "@/modules/attendance/services/attendance.service";
import { listAllEmployees } from "@/modules/employees/services/employees.service";
import { PeopleAttentionCard } from "./people-attention";

const mockDay = vi.mocked(getDayOversight);
const mockRoster = vi.mocked(listAllEmployees);

/** A `GET /v1/attendance/day` response with the given per-user statuses. */
const day = (users: { user_id: string; status: string }[]) =>
  ({
    date: "2026-07-17",
    users,
    summary: { present: 0, partial: 0, absent: 0, leave: 0, non_workday: 0, counted: 0 },
  }) as never;

beforeEach(() => {
  mockDay.mockReset();
  mockRoster.mockReset();
  mockRoster.mockResolvedValue([
    { user_id: "u1", name: "Ada Lovelace", status: "active", department_id: "d1" },
    { user_id: "u2", name: "Alan Turing", status: "active", department_id: "d1" },
  ] as never);
});

describe("PeopleAttentionCard", () => {
  it("lists absent-without-leave and partial-day people, ignoring present ones", async () => {
    mockDay.mockResolvedValue(
      day([
        { user_id: "u1", status: "absent" },
        { user_id: "u2", status: "partial" },
        { user_id: "u3", status: "present" },
      ]),
    );
    render(<PeopleAttentionCard />);
    // Query the reason lines (unique) rather than the badges, which collide with the filter chips.
    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Alan Turing")).toBeInTheDocument();
    expect(screen.getByText(/no leave applied/i)).toBeInTheDocument();
    expect(screen.getByText(/fewer hours than a full workday/i)).toBeInTheDocument();
  });

  it("shows an honest 'Everyone's accounted for' when all present", async () => {
    mockDay.mockResolvedValue(day([{ user_id: "u1", status: "present" }]));
    render(<PeopleAttentionCard />);
    expect(await screen.findByText(/Everyone's accounted for/i)).toBeInTheDocument();
  });

  it("says the day isn't closed yet when there is no attendance", async () => {
    mockDay.mockResolvedValue(day([]));
    render(<PeopleAttentionCard />);
    expect(await screen.findByText(/isn't closed yet/i)).toBeInTheDocument();
  });

  /**
   * The AI reports tab owns the date and passes it down. It used to have two pagers, so the
   * executive summary could describe one day while the list below described another — with
   * nothing on screen admitting it. Given a `date`, this card must render no date control at all.
   */
  describe("when a page owns the date", () => {
    it("renders no date control of its own", async () => {
      mockDay.mockResolvedValue(day([{ user_id: "u1", status: "absent" }]));
      render(<PeopleAttentionCard date="2026-07-17" onDateChange={vi.fn()} />);

      expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
      expect(screen.queryByLabelText("Previous day")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Next day")).not.toBeInTheDocument();
    });

    /** Uncontrolled it still owns its pager — the standalone use must not lose it. */
    it("keeps its own pager when no date is given", async () => {
      mockDay.mockResolvedValue(day([{ user_id: "u1", status: "absent" }]));
      render(<PeopleAttentionCard />);

      expect(await screen.findByLabelText("Previous day")).toBeInTheDocument();
    });

    /**
     * The page defaults to today, which is never closed, so the default view of this card is the
     * empty state. It has to offer a way out rather than just explaining itself.
     */
    it("offers a jump to the last day that has data", async () => {
      mockDay.mockResolvedValue(day([]));
      const onDateChange = vi.fn();
      render(<PeopleAttentionCard date="2026-07-17" onDateChange={onDateChange} />);

      expect(await screen.findByText(/isn't closed yet/i)).toBeInTheDocument();
      expect(screen.getByText(/Pick an earlier date above/i)).toBeInTheDocument();
    });
  });
});
