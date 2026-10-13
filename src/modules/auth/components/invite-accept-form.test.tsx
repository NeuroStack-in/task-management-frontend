import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () =>
    new URLSearchParams({ tenant_id: "t1", invite_id: "inv1", token: "tok" }),
}));
vi.mock("@/stores/auth.store", () => ({
  useAuthStore: (select: (s: { logout: () => void }) => unknown) => select({ logout: vi.fn() }),
}));
const acceptInvite = vi.fn();
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  lookupInvite: vi.fn(async () => ({
    org_name: "Acme",
    email: "new@acme.test",
    role_name: "Employee",
    role_id: "role-employee",
    status: "pending",
    expires_at: 4_000_000_000,
  })),
  acceptInvite: (...a: unknown[]) => acceptInvite(...a),
}));

import { InviteAcceptForm } from "./invite-accept-form";

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

/**
 * WP-030 (QA audit 2026-10-08): contact number, location, date of birth and work mode are required,
 * but their errors never reached the summary — the only place errors are visible — so "Create
 * account" did nothing at all when one was missing.
 */
describe("InviteAcceptForm", () => {
  it("says which required profile fields are missing instead of doing nothing", async () => {
    render(<InviteAcceptForm />);
    await screen.findByText("Create account");
    type("Full name", "New Person");
    type("Invite code", "123456");
    type("Password", "Correct-horse-9!");
    type("Confirm password", "Correct-horse-9!");
    fireEvent.click(screen.getByText("Create account"));

    expect(await screen.findByText("Enter your contact number")).toBeInTheDocument();
    expect(screen.getByText("Enter your location")).toBeInTheDocument();
    expect(screen.getByText("Enter your date of birth")).toBeInTheDocument();
    expect(screen.getByText("Choose how you work")).toBeInTheDocument();
    expect(acceptInvite).not.toHaveBeenCalled();
  });
});
