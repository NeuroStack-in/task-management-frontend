import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";

const auth = {
  isAuthenticated: true,
  hydrated: true,
  user: { id: "u1", email: "new@acme.test" },
  logout: vi.fn(),
};
vi.mock("@/stores/auth.store", () => ({
  useAuthStore: (select: (s: typeof auth) => unknown) => select(auth),
}));
vi.mock("@/stores/roles.store", () => ({
  useRolesStore: (select: (s: { customRoles: [] }) => unknown) => select({ customRoles: [] }),
}));
const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
// Whether this org-less account is a support operator (the allowlist). Not one, unless a test says so.
const getOpsMe = vi.fn();
vi.mock("@/modules/ops/services/ops.service", () => ({ getOpsMe: () => getOpsMe() }));
// The two screens this test is not about.
vi.mock("@/modules/auth/components/signup-experience", () => ({
  SignupExperience: () => <p>Request your workspace</p>,
}));
vi.mock("./onboarding-wizard", () => ({ OnboardingWizard: () => null }));

const getMyOrgRequest = vi.fn();
const getMyInvites = vi.fn();
const resendMyInvite = vi.fn();
vi.mock("../services/onboarding.service", () => ({
  getMyOrgRequest: () => getMyOrgRequest(),
  getMyInvites: () => getMyInvites(),
  resendMyInvite: (t: string, i: string) => resendMyInvite(t, i),
  withdrawMyOrgRequest: vi.fn(),
}));

import { OnboardingExperience } from "./onboarding-experience";

const invite = {
  tenant_id: "t1",
  invite_id: "inv-1",
  org_name: "Acme",
  expires_at: Math.floor(Date.now() / 1000) + 86_400,
  locked: false,
};

beforeEach(() => {
  getMyOrgRequest.mockReset().mockResolvedValue(null);
  getOpsMe.mockReset().mockResolvedValue({ platform_admin: false });
  replace.mockReset();
  getMyInvites.mockReset();
  resendMyInvite.mockReset();
});

/**
 * UX audit ONB-03: someone invited who signed in with Google before opening the invite email has no
 * organisation, and this screen offered them a new one. With an invite waiting, it points them at
 * the invite instead — and can send it again.
 */
describe("OnboardingExperience — waiting invites", () => {
  it("shows the invite instead of the workspace request", async () => {
    getMyInvites.mockResolvedValue([invite]);
    render(<OnboardingExperience />);
    expect(await screen.findByText("You've been invited to Acme")).toBeInTheDocument();
    expect(screen.queryByText("Request your workspace")).not.toBeInTheDocument();
  });

  it("sends the invite again to the caller's own address", async () => {
    getMyInvites.mockResolvedValue([invite]);
    resendMyInvite.mockResolvedValue({ sent_to: "new@acme.test", expires_at: invite.expires_at });
    render(<OnboardingExperience />);
    fireEvent.click(await screen.findByRole("button", { name: "Email me the invite again" }));
    expect(resendMyInvite).toHaveBeenCalledWith("t1", "inv-1");
    expect(await screen.findByRole("button", { name: "Sent — send again" })).toBeInTheDocument();
  });

  it("still lets them create their own workspace", async () => {
    getMyInvites.mockResolvedValue([invite]);
    render(<OnboardingExperience />);
    fireEvent.click(await screen.findByRole("button", { name: "Create your own workspace instead" }));
    expect(await screen.findByText("Request your workspace")).toBeInTheDocument();
  });

  it("with no invite, behaves as before", async () => {
    getMyInvites.mockResolvedValue([]);
    render(<OnboardingExperience />);
    expect(await screen.findByText("Request your workspace")).toBeInTheDocument();
  });
});

describe("OnboardingExperience — support operators", () => {
  // 2026-10-28: the support@ login (no organization) was shown "About your organization".
  it("sends an org-less operator to the support desk instead of the request form", async () => {
    getOpsMe.mockResolvedValue({ platform_admin: true });
    getMyInvites.mockResolvedValue([]);
    // Its own id: the allowlist answer is cached per user for the page's lifetime.
    const before = auth.user;
    auth.user = { id: "op-1", email: "support@neurostack.in" };
    onTestFinished(() => {
      auth.user = before;
    });
    const { OnboardingExperience } = await import("./onboarding-experience");
    render(<OnboardingExperience />);
    await vi.waitFor(() => expect(replace).toHaveBeenCalledWith("/ops/support"));
    expect(screen.queryByText("Request your workspace")).toBeNull();
  });
});
