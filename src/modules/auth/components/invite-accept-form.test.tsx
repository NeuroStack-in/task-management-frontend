import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  params: { tenant_id: "t1", invite_id: "inv1", token: "tok" } as Record<string, string>,
  lookupInvite: vi.fn(),
  acceptInvite: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(mocks.params),
}));
vi.mock("@/stores/auth.store", () => ({
  useAuthStore: (select: (s: { login: () => Promise<void> }) => unknown) =>
    select({ login: vi.fn(async () => undefined) }),
  landAfterSignIn: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  lookupInvite: (...a: unknown[]) => mocks.lookupInvite(...a),
  acceptInvite: (...a: unknown[]) => mocks.acceptInvite(...a),
}));
// Native stand-ins for the custom pickers: this file tests the form's rules, not the controls.
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

import { InviteAcceptForm } from "./invite-accept-form";

const preview = (status = "pending") => ({
  org_name: "Acme",
  email: "new@acme.test",
  role_name: "Employee",
  role_id: "role-employee",
  status,
  expires_at: 4_000_000_000,
});

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function fillAccount() {
  type("Full name", "New Person");
  type("Invite code", "123456");
  type("Password", "Correct-horse-9!");
  type("Confirm password", "Correct-horse-9!");
}

const termsBox = () =>
  screen.getByRole("checkbox", { name: /I agree to the Terms of Service and Privacy Policy/ });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.params = { tenant_id: "t1", invite_id: "inv1", token: "tok" };
  mocks.lookupInvite.mockResolvedValue(preview());
  mocks.acceptInvite.mockResolvedValue({
    user_id: "u1",
    emp_id: "E1",
    email: "new@acme.test",
    role_id: "role-employee",
  });
});

/**
 * WP-030 (QA audit 2026-10-08): the required profile fields' errors never reached the summary — the
 * only place errors are visible — so "Create account" did nothing at all when one was missing.
 */
describe("InviteAcceptForm", () => {
  it("says which required profile fields are missing instead of doing nothing", async () => {
    render(<InviteAcceptForm />);
    await screen.findByText("Create account");
    fillAccount();
    fireEvent.click(screen.getByText("Create account"));

    expect(await screen.findByText("Enter your contact number")).toBeInTheDocument();
    expect(screen.getByText("Enter your location")).toBeInTheDocument();
    expect(screen.getByText("Choose how you work")).toBeInTheDocument();
    // Date of birth is optional now (ONB-08), as in the first-run gate.
    expect(screen.queryByText("Enter your date of birth")).not.toBeInTheDocument();
    expect(mocks.acceptInvite).not.toHaveBeenCalled();
  });

  /** ONB-08: sign-up has a Terms/Privacy agreement; an invitee creating an account had none. */
  it("requires the Terms and Privacy agreement, linked to both documents", async () => {
    render(<InviteAcceptForm />);
    await screen.findByText("Create account");
    const label = termsBox().closest("label")!;
    expect(within(label).getByRole("link", { name: "Terms of Service" })).toHaveAttribute(
      "href",
      "/legal/terms",
    );
    expect(within(label).getByRole("link", { name: "Privacy Policy" })).toHaveAttribute(
      "target",
      "_blank",
    );

    fillAccount();
    type("Contact number", "+919876543210");
    type("Location", "Pune");
    type("Work mode", "remote");
    fireEvent.click(screen.getByText("Create account"));
    expect(
      await screen.findByText("Agree to the Terms of Service and Privacy Policy to continue"),
    ).toBeInTheDocument();
    expect(mocks.acceptInvite).not.toHaveBeenCalled();

    fireEvent.click(termsBox());
    fireEvent.click(screen.getByText("Create account"));
    await waitFor(() => expect(mocks.acceptInvite).toHaveBeenCalledTimes(1));
    const body = mocks.acceptInvite.mock.calls[0][0] as Record<string, unknown>;
    // Optional and left blank: not sent, rather than sent empty.
    expect(body.date_of_birth).toBeUndefined();
    expect(body).toMatchObject({ phone: "+919876543210", location: "Pune", work_mode: "remote" });
  });

  it("says why each personal detail is asked, and what the organization can record", async () => {
    render(<InviteAcceptForm />);
    await screen.findByText("Create account");
    expect(screen.getByText("So your organization can reach you about work.")).toBeInTheDocument();
    expect(screen.getByText("For HR records only. Leave it blank if you prefer.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What Acme can record" })).toBeInTheDocument();
  });
});

/** ONB-05: four link states were text only — no button, no way home, no one to ask. */
describe("InviteAcceptForm — a link that can't be used", () => {
  it("an incomplete link offers sign-in and says who can resend it", async () => {
    mocks.params = { tenant_id: "t1" };
    render(<InviteAcceptForm />);
    expect(await screen.findByRole("link", { name: "Go to sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByText(/Ask the person who invited you to send it again/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the WorkPulse home page" })).toHaveAttribute("href", "/");
  });

  it.each([
    ["expired", "This invite has expired"],
    ["locked", "This invite is locked"],
  ])("a %s invite says how to request a new one, naming the org", async (status, title) => {
    mocks.lookupInvite.mockResolvedValue(preview(status));
    render(<InviteAcceptForm />);
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(screen.getByText("Request a new invite")).toBeInTheDocument();
    expect(screen.getByText(/Ask the person who invited you to Acme/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to sign in" })).toBeInTheDocument();
  });

  it("a load failure offers to try the same link again", async () => {
    const { ApiError } = await import("@/lib/api");
    mocks.lookupInvite.mockRejectedValueOnce(new ApiError("busy", 503, "unavailable"));
    render(<InviteAcceptForm />);
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Create account")).toBeInTheDocument();
    expect(mocks.lookupInvite).toHaveBeenCalledTimes(2);
  });
});
