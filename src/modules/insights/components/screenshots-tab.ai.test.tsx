import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const EMP = "u-emp";
const DATE = "2026-10-20";

const mocks = vi.hoisted(() => ({
  perms: new Set<string>(),
  getScreenshotDeptSummary: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(`date=2026-10-20`),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/insights/screenshots",
}));
vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: () => ({
    role: null,
    can: (p: string) => mocks.perms.has(p),
    canAny: (ps: string[]) => ps.some((p) => mocks.perms.has(p)),
  }),
}));
vi.mock("@/hooks/use-assistant-access", () => ({ useAssistantAccess: () => ({ chat: false, help: false }) }));
vi.mock("@/hooks/use-directory", () => ({
  useDirectory: () => ({
    employees: [{ user_id: EMP, name: "Agent Tester", department_id: "d1", status: "active" }],
  }),
}));
vi.mock("@/modules/employees/services/employees.service", () => ({
  departmentMap: () => Promise.resolve(new Map([["d1", "Engineering"]])),
  getEmployeeAvatarUrls: () => Promise.resolve({}),
}));
vi.mock("@/modules/agents/services/fleet.service", () => ({
  getTrackingPolicy: () => Promise.resolve({ tracking: { retention_days: 90 } }),
}));
vi.mock("@/modules/agents/components/capture-now-button", () => ({ CaptureNowButton: () => null }));
vi.mock("./capture-empty-state", () => ({ CaptureEmptyState: () => null }));
vi.mock("../use-screenshots", () => ({
  useScreenshots: () => ({
    shots: ["s1", "s2", "s3"].map((id, i) => ({
      shot_id: id,
      user_id: EMP,
      captured_at: Date.UTC(2026, 9, 20, 5, i * 10),
      app: "Code",
      category: "neutral",
      flagged: false,
      reviewed: true,
      blur_level: 0,
      phash: "0",
      url: `https://stub.invalid/${id}.png`,
      display: 0,
    })),
    loading: false,
    loadingMore: false,
    error: null,
    hasMore: false,
    loadMore: vi.fn(),
    reload: vi.fn(),
    loadedAt: Date.now(),
  }),
}));
vi.mock("../services/insights.service", async (orig) => ({
  ...(await orig<typeof import("../services/insights.service")>()),
  getScreenshotDeptSummary: (...a: unknown[]) => mocks.getScreenshotDeptSummary(...a),
  regenerateScreenshotDeptSummary: vi.fn(),
}));

import { ScreenshotsTab } from "./screenshots-tab";

const summary = (metrics: Record<string, unknown>) => ({
  department: "all",
  date: DATE,
  ai_generated: true,
  model: "openai/gpt-oss-20b",
  generated_at: Date.UTC(2026, 9, 20, 9),
  narrative: "- One person was captured.",
  metrics: {
    people_captured: 1,
    people_total: 1,
    captured: 3,
    frames: 3,
    productive: 1,
    neutral: 1,
    distracting: 0,
    work_related: 1,
    flagged: 0,
    avg_productivity: 60,
    on_task_pct: 50,
    notable: [],
    ...metrics,
  },
});

beforeEach(() => {
  mocks.perms = new Set(["screenshots:view"]);
  mocks.getScreenshotDeptSummary.mockReset();
});

/**
 * AI-46: the screenshot department summary needs View AI insights, like every AI summary. A role with
 * screenshot access alone gets the card's own figures — no AI request, no AI text, no On-task figure.
 */
describe("ScreenshotsTab — AI summary access (AI-46)", () => {
  it("never asks for the AI summary without View AI insights", async () => {
    render(<ScreenshotsTab />);
    // The first render in a file pays for loading the whole tab, so give it longer than 1 s. Asserted
    // inside `waitFor`: the card's Markdown re-renders as the department names arrive, so a node found
    // once can be replaced before a later assertion reads it.
    await waitFor(
      () => expect(screen.getByText(/3 screenshots captured across 1 employee/)).toBeInTheDocument(),
      { timeout: 8000 },
    );
    expect(mocks.getScreenshotDeptSummary).not.toHaveBeenCalled();
    expect(screen.queryByText("On-task")).not.toBeInTheDocument();
    expect(screen.getByText("Summary of the figures · not written by AI")).toBeInTheDocument();
  });

  it("asks for it, and shows it, with View AI insights", async () => {
    mocks.perms.add("ai:view");
    mocks.getScreenshotDeptSummary.mockResolvedValue(summary({}));
    render(<ScreenshotsTab />);
    expect(await screen.findByText("One person was captured.")).toBeInTheDocument();
    expect(mocks.getScreenshotDeptSummary).toHaveBeenCalled();
    expect(screen.getByText("On-task")).toBeInTheDocument();
  });
});

/**
 * AI-47: blank, locked or unreadable screenshots aren't judged; on-task is a share of the judged ones,
 * and the not-judged ones are counted on their own.
 */
describe("ScreenshotsTab — screenshots the AI couldn't judge (AI-47)", () => {
  it("says on-task of the judged ones, and counts the rest as not judged", async () => {
    mocks.perms.add("ai:view");
    mocks.getScreenshotDeptSummary.mockResolvedValue(summary({ not_judged: 1, on_task_pct: 50 }));
    render(<ScreenshotsTab />);
    expect(await screen.findByText("of 2 judged")).toBeInTheDocument();
    expect(screen.getByText("Not judged")).toBeInTheDocument();
    expect(screen.getByText("blank, locked or unreadable")).toBeInTheDocument();
  });

  it("keeps the old wording against a server without the field", async () => {
    mocks.perms.add("ai:view");
    mocks.getScreenshotDeptSummary.mockResolvedValue(summary({}));
    render(<ScreenshotsTab />);
    expect(await screen.findByText("of 3 analyzed")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Not judged")).not.toBeInTheDocument());
  });
});
