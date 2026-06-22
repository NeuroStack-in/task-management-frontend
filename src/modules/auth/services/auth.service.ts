/**
 * Mock authentication service (TDD §20). Simulates login against the static
 * users dataset. Any password is accepted; the email must match a known user.
 */
import { users, delay } from "@/lib/data";
import { createMockToken } from "@/lib/mock-jwt";
import type { AuthSession, User } from "@/types/user";

export const DEMO_EMAIL = "owner@acme.test";

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
