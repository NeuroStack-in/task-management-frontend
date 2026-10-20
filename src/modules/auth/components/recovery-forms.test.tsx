import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
  completeMfa: vi.fn(),
  hasChallenge: true,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/stores/auth.store", () => ({
  useAuthStore: (select: (s: { completeMfa: typeof mocks.completeMfa }) => unknown) =>
    select({ completeMfa: mocks.completeMfa }),
}));
vi.mock("@/hooks/use-permissions", () => ({ currentRoleSnapshot: () => null }));
vi.mock("@/modules/auth/services/auth.service", async (orig) => ({
  ...(await orig<typeof import("@/modules/auth/services/auth.service")>()),
  requestPasswordReset: (e: string) => mocks.requestPasswordReset(e),
  confirmPasswordReset: (e: string, c: string, p: string) => mocks.confirmPasswordReset(e, c, p),
  hasPendingTotpChallenge: () => mocks.hasChallenge,
}));

import { AuthError } from "@/modules/auth/services/auth.service";
import { ForgotPasswordForm } from "./forgot-password-form";
import { ResetPasswordForm } from "./reset-password-form";
import { MfaForm } from "./mfa-form";

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hasChallenge = true;
  sessionStorage.clear();
});

/** UX audit ONB-09 / ONB-10: one form system, and a refusal that stays on screen with focus. */
describe("ForgotPasswordForm", () => {
  it("has no placeholder and marks a bad address on the field", async () => {
    render(<ForgotPasswordForm />);
    const input = screen.getByLabelText("Work email");
    expect(input).not.toHaveAttribute("placeholder");
    type("Work email", "not-an-email");
    fireEvent.click(screen.getByRole("button", { name: "Send reset code" }));
    expect(await screen.findByRole("link", { name: /correct format/ })).toHaveAttribute("href", "#fp-email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain("fp-email-error");
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
  });

  it("keeps a server refusal on screen and focused instead of a toast", async () => {
    mocks.requestPasswordReset.mockRejectedValueOnce(
      new AuthError("Too many attempts. Wait a few minutes, then try again.", "state"),
    );
    render(<ForgotPasswordForm />);
    type("Work email", "a@b.co");
    fireEvent.click(screen.getByRole("button", { name: "Send reset code" }));
    expect(await screen.findByText("Too many attempts. Wait a few minutes, then try again.")).toBeInTheDocument();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("alert")));
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("hands the address over and moves on when the code is sent", async () => {
    mocks.requestPasswordReset.mockResolvedValueOnce(undefined);
    render(<ForgotPasswordForm />);
    type("Work email", "A@B.co");
    fireEvent.click(screen.getByRole("button", { name: "Send reset code" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/reset-password"));
    expect(sessionStorage.getItem("wp-email-handoff")).toBe("a@b.co");
  });
});

describe("ResetPasswordForm", () => {
  it("shows the live password checklist before any submit", () => {
    render(<ResetPasswordForm />);
    expect(screen.getByText("Password requirements")).toBeInTheDocument();
    type("New password", "Abcdefg1");
    expect(screen.getByText("One number").closest("li")).toHaveClass("is-ok");
  });

  it("says where the code went when the previous step handed the address over", async () => {
    sessionStorage.setItem("wp-email-handoff", "me@acme.test");
    render(<ResetPasswordForm />);
    expect(await screen.findByText(/If me@acme.test has a WorkPulse account/)).toBeInTheDocument();
    expect(screen.getByLabelText("Work email")).toHaveValue("me@acme.test");
  });

  it("puts a wrong code beside the code field, focused, and keeps it until the code changes", async () => {
    mocks.confirmPasswordReset.mockRejectedValueOnce(
      new AuthError("That code is incorrect. Check your email and try again.", "credentials", "code"),
    );
    render(<ResetPasswordForm />);
    type("Work email", "me@acme.test");
    type("Verification code", "123456");
    type("New password", "Abcdefg1");
    type("Confirm new password", "Abcdefg1");
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    const link = await screen.findByRole("link", { name: "That code is incorrect. Check your email and try again." });
    expect(link).toHaveAttribute("href", "#rp-code");
    expect(screen.getByLabelText("Verification code")).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("alert")));

    type("Verification code", "654321");
    expect(screen.queryByText(/That code is incorrect/)).not.toBeInTheDocument();
  });

  it("confirms a resent code on the page, not in a toast", async () => {
    mocks.requestPasswordReset.mockResolvedValueOnce(undefined);
    render(<ResetPasswordForm />);
    type("Work email", "me@acme.test");
    fireEvent.click(screen.getByRole("button", { name: "Send a new code" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/We sent a new code to me@acme.test/);
  });
});

/** UX audit ONB-11 — one code input the platform can autofill, and a way forward without the app. */
describe("MfaForm", () => {
  it("is one input with one-time-code autofill", () => {
    render(<MfaForm />);
    const input = screen.getByLabelText("Verification code");
    expect(input).toHaveAttribute("autocomplete", "one-time-code");
    expect(input).toHaveAttribute("inputmode", "numeric");
    expect(screen.queryAllByRole("textbox")).toHaveLength(1);
  });

  it("explains the recovery path when the authenticator is lost", () => {
    render(<MfaForm />);
    expect(screen.getByText("Can't use your authenticator app?")).toBeInTheDocument();
    expect(screen.getByText(/ask an owner or admin in your organization to reset your two-step sign-in/)).toBeInTheDocument();
    expect(screen.getByText(/If you're the only owner or admin,/)).toBeInTheDocument();
  });

  it("keeps a wrong code on screen and clears the field for the next one", async () => {
    mocks.completeMfa.mockRejectedValueOnce(new AuthError("Incorrect code.", "credentials"));
    render(<MfaForm />);
    type("Verification code", "12 34 56");
    expect(screen.getByLabelText("Verification code")).toHaveValue("123456");
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(await screen.findByRole("link", { name: /That code didn't match/ })).toHaveAttribute("href", "#mfa-code");
    expect(screen.getByLabelText("Verification code")).toHaveValue("");
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("offers a fresh sign-in once the challenge itself is gone", async () => {
    mocks.completeMfa.mockRejectedValueOnce(new AuthError("Your sign-in session expired.", "state"));
    render(<MfaForm />);
    type("Verification code", "123456");
    fireEvent.click(screen.getByRole("button", { name: "Verify" }));
    expect(await screen.findByRole("link", { name: "Sign in again" })).toHaveAttribute("href", "/login");
  });

  it("says the page expired when there is no challenge", () => {
    mocks.hasChallenge = false;
    render(<MfaForm />);
    expect(screen.getByRole("heading", { name: "Verification expired" })).toBeInTheDocument();
    expect(screen.getByText("Can't use your authenticator app?")).toBeInTheDocument();
  });
});
