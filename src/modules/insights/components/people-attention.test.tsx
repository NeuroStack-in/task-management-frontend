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
});
