import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttentionState } from "../use-attention";

// The panel's reads are its hook; mock it so each state can be rendered directly.
vi.mock("../use-attention", () => ({ useAttention: vi.fn() }));
vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({ can: () => true }),
}));

import { useAttention } from "../use-attention";
import { AttentionPanel } from "./attention-panel";

const mockAttention = vi.mocked(useAttention);

const base = (over: Partial<AttentionState>): AttentionState => ({
  flags: { status: "off" },
  alerts: { status: "off" },
  people: { status: "off" },
  agents: { status: "off" },
  reload: vi.fn(),
  ...over,
});

beforeEach(() => mockAttention.mockReset());

describe("AttentionPanel (UX audit MON-03 / MON-06)", () => {
  it("says a failed signal failed — never a count of 0", () => {
    mockAttention.mockReturnValue(
      base({
        alerts: { status: "error", message: "Couldn't load alerts.", denied: false },
        people: { status: "ready", data: [] },
      }),
    );
    render(<AttentionPanel date="2026-10-16" today="2026-10-20" />);
    const tile = screen.getByText("Alerts").closest("div.rounded-2xl") as HTMLElement;
    expect(within(tile).getByText("—")).toBeTruthy();
    expect(within(tile).queryByText("0")).toBeNull();
    expect(within(tile).getByRole("button", { name: "Try again" })).toBeTruthy();
    // And the empty list doesn't claim the failed signal was clear.
    expect(screen.getByText(/Couldn't check alerts/)).toBeTruthy();
  });

  it("leaves out a signal the role can't read, and claims nothing about it", () => {
    mockAttention.mockReturnValue(base({ people: { status: "ready", data: [] } }));
    render(<AttentionPanel date="2026-10-16" today="2026-10-20" />);
    expect(screen.queryByText("Awaiting review")).toBeNull();
    expect(screen.queryByText("Agents not reporting")).toBeNull();
    const clear = screen.getByText(/score fell below 60/);
    expect(clear.textContent).not.toMatch(/review|alert/);
  });

  it("lists who needs attention with the reason, and links them", () => {
    mockAttention.mockReturnValue(
      base({
        alerts: {
          status: "ready",
          data: [
            {
              user_id: "u1",
              name: "Ada",
              score: 70,
              anomaly_count: 1,
              top_severity: "high",
              reasons: ["overtime"],
              attention: 60,
            },
          ],
        },
      }),
    );
    render(<AttentionPanel date="2026-10-16" today="2026-10-20" />);
    const list = document.getElementById("alerts") as HTMLElement;
    expect(within(list).getByText("High alert")).toBeTruthy();
    expect(within(list).getByText("Worked past the overtime threshold")).toBeTruthy();
    expect(within(list).getByRole("link", { name: "Ada" }).getAttribute("href")).toBe(
      "/insights/activity?emp=u1",
    );
    expect(
      within(list).getByRole("link", { name: /Ada's screenshots/ }).getAttribute("href"),
    ).toBe("/insights/screenshots?emp=u1&date=2026-10-16");
  });

  it("renders nothing when the viewer can read none of the signals", () => {
    mockAttention.mockReturnValue(base({}));
    const { container } = render(<AttentionPanel date="2026-10-16" today="2026-10-20" />);
    expect(container.innerHTML).toBe("");
  });
});
