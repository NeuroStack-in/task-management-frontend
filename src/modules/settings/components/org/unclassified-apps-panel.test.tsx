import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getUnclassifiedApps: vi.fn() }));
vi.mock("@/modules/insights/services/insights.service", () => ({
  getUnclassifiedApps: (...a: unknown[]) => mocks.getUnclassifiedApps(...a),
}));

import { useEntitlementsStore } from "@/stores/entitlements.store";
import { UnclassifiedAppsPanel } from "./unclassified-apps-panel";

const list = (over: Record<string, unknown> = {}) => ({
  apps: [{ app: "Figma.exe", total_sec: 3600, first_seen: 1, last_seen: 2 }],
  total_seen: 5,
  no_rules_configured: false,
  ...over,
});

function panel() {
  return render(
    <UnclassifiedAppsPanel canManage isClassified={() => false} onAdd={vi.fn()} onAddMany={vi.fn()} />,
  );
}

function aiInsights(on: boolean) {
  useEntitlementsStore.setState({
    loaded: true,
    allowed: ["ai.insights", "monitoring.activity"],
    enabled: { "ai.insights": on, "monitoring.activity": true },
  });
}

const OFF = /AI suggestions are off because AI insights is turned off/;

beforeEach(() => {
  mocks.getUnclassifiedApps.mockReset();
});

/** AI-48: AI category suggestions follow AI insights, and the panel says so instead of spinning. */
describe("UnclassifiedAppsPanel — AI suggestions (AI-48)", () => {
  it("offers suggestions while AI insights is on", async () => {
    aiInsights(true);
    mocks.getUnclassifiedApps.mockResolvedValue(list());
    panel();
    expect(await screen.findByRole("button", { name: /Suggest categories/ })).toBeInTheDocument();
    expect(screen.queryByText(OFF)).not.toBeInTheDocument();
  });

  it("doesn't offer them, and says why, when the org has AI insights off", async () => {
    aiInsights(false);
    mocks.getUnclassifiedApps.mockResolvedValue(list());
    panel();
    expect(await screen.findByText(OFF)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Suggest categories/ })).not.toBeInTheDocument();
    // Only the plain worklist was read — never a suggestion request.
    expect(mocks.getUnclassifiedApps).toHaveBeenCalledWith(false);
    expect(mocks.getUnclassifiedApps).not.toHaveBeenCalledWith(true);
  });

  it("says why when the server reports suggestions off", async () => {
    aiInsights(true);
    mocks.getUnclassifiedApps
      .mockResolvedValueOnce(list())
      .mockResolvedValueOnce(list({ ai_suggestions_off: true }));
    panel();
    fireEvent.click(await screen.findByRole("button", { name: /Suggest categories/ }));
    expect(await screen.findByText(OFF)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Suggest categories/ })).not.toBeInTheDocument(),
    );
    // The worklist itself stays, to classify by hand.
    expect(screen.getByText("Figma.exe")).toBeInTheDocument();
  });
});
