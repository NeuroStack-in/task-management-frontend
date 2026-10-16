import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  signUp: vi.fn(),
  confirm: vi.fn(),
  resend: vi.fn(),
  requestOrg: vi.fn(),
  login: vi.fn(),
  auth: {
    isAuthenticated: false,
    hydrated: true,
    user: null as null | { name: string; email: string },
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/stores/auth.store", () => ({
  useAuthStore: (select: (s: unknown) => unknown) =>
    select({ ...mocks.auth, login: mocks.login }),
}));
// Every sign-up is a request now (owner decision 2026-10-17, ONB-01): the email path creates a
// login, confirms the emailed code, then submits the same org request a Google returnee does.
vi.mock("@/modules/auth/services/auth.service", async (orig) => ({
  ...(await orig<typeof import("@/modules/auth/services/auth.service")>()),
  signUpWithEmail: (...a: unknown[]) => mocks.signUp(...a),
  confirmEmailSignUp: (...a: unknown[]) => mocks.confirm(...a),
  resendSignUpCode: (...a: unknown[]) => mocks.resend(...a),
}));
vi.mock("@/modules/onboarding/services/onboarding.service", () => ({
  requestOrg: (...a: unknown[]) => mocks.requestOrg(...a),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// The custom controls are replaced with native ones: this file tests the wizard's rules, not the
// pickers (which have their own tests). Same ids and accessible names, so the form wires up as usual.
vi.mock("@/modules/auth/components/auth-modals", async (orig) => ({
  ...(await orig<typeof import("@/modules/auth/components/auth-modals")>()),
  MSelect: (p: {
    id?: string;
    value: string;
    onChange: (v: string) => void;
    options: string[];
    ariaLabel?: string;
  }) => (
    <select
      id={p.id}
      aria-label={p.ariaLabel}
      value={p.value}
      onChange={(e) => p.onChange(e.target.value)}
    >
      <option value="">Select…</option>
      {p.options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  ),
}));
vi.mock("@/components/ui/phone-input", () => ({
  PhoneInput: (p: { id?: string; value: string; onChange: (v: string) => void }) => (
    <input id={p.id} value={p.value} onChange={(e) => p.onChange(e.target.value)} />
  ),
}));
vi.mock("@/components/ui/date-picker", () => ({
  DatePicker: (p: { id?: string; value: string; onChange: (v: string) => void }) => (
    <input id={p.id} value={p.value} onChange={(e) => p.onChange(e.target.value)} />
  ),
}));
vi.mock("./sso-provider-buttons", () => ({ SsoProviderButtons: () => null }));
vi.mock("./plan-details-dialog", () => ({ PlanDetailsDialog: () => null }));

import { SignupExperience } from "./signup-experience";

const TERMS_ERROR = "Agree to the Terms of Service and Privacy Policy to continue";

function fill(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

async function continueTo(heading: string) {
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: heading });
}

/** Steps 2–4 (Organization, Region, Your profile), shared by both variants. */
async function fillOrgRegionProfile(lastHeading: string) {
  fill("Organization name", "Acme");
  fill("Industry", "Software");
  fill("Organization size", "11-50");
  await continueTo("Region & localization");
  fill("Headquarters country", "India");
  await continueTo("Your profile");
  fill("Job title", "CTO");
  fill("Work location", "Pune");
  fill("Contact number", "+919876543210");
  fill("Date of birth", "1990-01-01");
  fill("Work mode", "remote");
  await continueTo(lastHeading);
}

const termsBox = () =>
  screen.getByRole("checkbox", {
    name: /I agree to the Terms of Service and Privacy Policy/,
  });
const monitoringBox = () =>
  screen.getByRole("checkbox", { name: /authorized to enable workforce monitoring/ });

/**
 * WP-115 (QA audit 2026-10-08): the Terms/Privacy box was required but linked to nothing, so it was
 * removed. It is back, linked to the drafts at /legal/*, and required in both variants of the flow.
 */
describe("SignupExperience — Terms of Service and Privacy Policy consent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.isAuthenticated = false;
    mocks.auth.user = null;
    mocks.signUp.mockResolvedValue(undefined);
    mocks.confirm.mockResolvedValue(undefined);
    mocks.requestOrg.mockResolvedValue(undefined);
    mocks.login.mockResolvedValue(undefined);
  });

  it("links both documents, opening each in a new tab", async () => {
    render(<SignupExperience />);
    fill("Full name", "Ada Lovelace");
    fill("Work email", "ada@acme.test");
    fill("Password", "Correct9horse");
    fill("Confirm password", "Correct9horse");
    await continueTo("About your organization");
    await fillOrgRegionProfile("Your plan");

    const label = termsBox().closest("label");
    expect(label).not.toBeNull();
    const terms = within(label!).getByRole("link", { name: "Terms of Service" });
    const privacy = within(label!).getByRole("link", { name: "Privacy Policy" });
    expect(terms).toHaveAttribute("href", "/legal/terms");
    expect(privacy).toHaveAttribute("href", "/legal/privacy");
    for (const link of [terms, privacy]) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
    }
  });

  it("won't create the account until the box is ticked", async () => {
    render(<SignupExperience />);
    fill("Full name", "Ada Lovelace");
    fill("Work email", "ada@acme.test");
    fill("Password", "Correct9horse");
    fill("Confirm password", "Correct9horse");
    await continueTo("About your organization");
    await fillOrgRegionProfile("Your plan");

    fireEvent.click(monitoringBox());
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    expect(await screen.findByText(TERMS_ERROR)).toHaveAttribute("href", "#signup-terms");
    expect(termsBox()).toHaveAttribute("aria-invalid", "true");
    expect(mocks.signUp).not.toHaveBeenCalled();

    fireEvent.click(termsBox());
    expect(screen.queryByText(TERMS_ERROR)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    await waitFor(() => expect(mocks.signUp).toHaveBeenCalledWith("ada@acme.test", "Correct9horse"));
  });

  /** ONB-01: an email sign-up no longer creates the organization — it waits for approval. */
  it("sends an email sign-up for approval once the emailed code is confirmed", async () => {
    render(<SignupExperience />);
    fill("Full name", "Ada Lovelace");
    fill("Work email", "ada@acme.test");
    fill("Password", "Correct9horse");
    fill("Confirm password", "Correct9horse");
    await continueTo("About your organization");
    // No workspace ID or prefix to choose: approval assigns them.
    expect(screen.queryByLabelText("Workspace ID")).not.toBeInTheDocument();
    await fillOrgRegionProfile("Your plan");
    fireEvent.click(monitoringBox());
    fireEvent.click(termsBox());
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    expect(await screen.findByText("Check your email")).toBeInTheDocument();
    expect(mocks.requestOrg).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Confirmation code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirm and send request" }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/onboarding"));
    expect(mocks.confirm).toHaveBeenCalledWith("ada@acme.test", "123456");
    expect(mocks.login).toHaveBeenCalledWith("ada@acme.test", "Correct9horse");
    expect(mocks.requestOrg).toHaveBeenCalledWith(
      expect.objectContaining({ org_name: expect.any(String), monitoring_consent: true }),
    );
  });

  it("also gates a signed-in Google returnee's workspace request", async () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.user = { name: "Ada Lovelace", email: "ada@acme.test" };
    render(<SignupExperience authenticated />);
    await fillOrgRegionProfile("Your plan");

    fireEvent.click(monitoringBox());
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    expect(await screen.findByText(TERMS_ERROR)).toBeInTheDocument();
    expect(mocks.requestOrg).not.toHaveBeenCalled();

    fireEvent.click(termsBox());
    fireEvent.click(screen.getByRole("button", { name: "Submit request" }));

    await waitFor(() => expect(mocks.requestOrg).toHaveBeenCalledTimes(1));
  });
});
