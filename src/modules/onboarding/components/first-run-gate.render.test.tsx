import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = { isAuthenticated: true, hydrated: true, user: { id: "u1" } };
vi.mock("@/stores/auth.store", () => ({
  useAuthStore: (select: (s: typeof auth) => unknown) => select(auth),
}));
const getMyProfile = vi.fn();
vi.mock("@/modules/profile/services/profile.service", () => ({
  getMyProfile: () => getMyProfile(),
  updateMyProfile: vi.fn(),
}));
vi.mock("@/modules/settings/use-appearance", () => ({ useAppearance: () => ({}) }));

import { FirstRunGate } from "./first-run-gate";

const incomplete = { phone: "", location: "", date_of_birth: "", work_mode: "" };

beforeEach(() => getMyProfile.mockReset());

/**
 * WP-033 (QA audit 2026-10-08): the gate stored "already checked" as state inside its own effect's
 * dependency list, so the re-render it caused cancelled the read it had just started. Every answer
 * was discarded and the dialog could never open. These render the real component.
 */
describe("FirstRunGate", () => {
  it("opens for an account whose profile is incomplete", async () => {
    getMyProfile.mockResolvedValue(incomplete);
    render(<FirstRunGate />);
    expect(await screen.findByText("Finish setting up your profile")).toBeInTheDocument();
    expect(getMyProfile).toHaveBeenCalledTimes(1);
  });

  /** Next runs development under StrictMode, which mounts every effect twice. */
  it("still opens, and reads once, under StrictMode", async () => {
    getMyProfile.mockResolvedValue(incomplete);
    render(
      <StrictMode>
        <FirstRunGate />
      </StrictMode>,
    );
    expect(await screen.findByText("Finish setting up your profile")).toBeInTheDocument();
    expect(getMyProfile).toHaveBeenCalledTimes(1);
  });

  it("stays closed for a complete profile", async () => {
    getMyProfile.mockResolvedValue({
      phone: "+919629287989",
      location: "Chengalpattu",
      date_of_birth: "2005-06-24",
      work_mode: "on-site",
    });
    let container!: HTMLElement;
    // `act` flushes the resolved read, so "nothing rendered" is checked after the answer, not before.
    await act(async () => {
      ({ container } = render(<FirstRunGate />));
    });
    expect(getMyProfile).toHaveBeenCalledTimes(1);
    expect(container).toBeEmptyDOMElement();
  });
});
