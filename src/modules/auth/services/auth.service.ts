/**
 * Mock authentication service (TDD §20). Simulates login against the static
 * users dataset. Any password is accepted; the email must match a known user.
 */
import { users, delay } from "@/lib/data";
import { createMockToken } from "@/lib/mock-jwt";
import type { AuthSession, User } from "@/types/user";

/** A quick-login shortcut shown on the sign-in screen. */
export interface DemoAccount {
  email: string;
  /** Short label for the button (the role/persona). */
  label: string;
  /** One-line description of what this login can see. */
  hint: string;
}

/**
 * The only two demo logins we surface: an Organization Owner (full access)
 * and a regular Employee (member access). Any password works for either.
 */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: "owner@acme.test", label: "Owner", hint: "Full admin access" },
  { email: "employee@acme.test", label: "Employee", hint: "Member access" },
];

export const DEMO_PASSWORD = "demo1234";

/** Kept for back-compat; the primary (owner) demo email. */
export const DEMO_EMAIL = DEMO_ACCOUNTS[0].email;

export interface LoginResult {
  session: AuthSession;
  user: User;
}

export class AuthError extends Error {}

export async function login(
  email: string,
  _password: string,
): Promise<LoginResult> {
  const user = users.find(
    (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
  );

  if (!user) {
    await delay(null, 400);
    throw new AuthError("No account found for that email.");
  }
  if (user.status === "suspended") {
    await delay(null, 400);
    throw new AuthError("This account is suspended.");
  }

  const issuedAt = Date.now();
  const session: AuthSession = {
    token: createMockToken(user.id, issuedAt),
    userId: user.id,
    issuedAt,
  };

  return delay({ session, user }, 600);
}

export function findUserById(id: string): User | undefined {
  return users.find((u) => u.id === id);
}
