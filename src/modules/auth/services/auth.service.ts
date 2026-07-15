/**
 * Authentication against the real Cognito user pool (backend `auth` stack).
 *
 * Login is a genuine SRP exchange — a wrong password now fails for real. The id token carries the
 * RBAC claims stamped by the pre-token-generation trigger (`tenant_id`, `perm` bitset, `is_owner`,
 * `scope`, `custom:roleId`), and we project those onto the app's `User` so the existing
 * permission/nav gating keeps working unchanged: the backend seeds the same role ids the frontend
 * knows (`role-owner` / `role-admin` / `role-employee`).
 *
 * The two RBAC models are intentionally parallel (SPEC "RBAC parity"): the UI gates on the role's
 * permission strings for convenience; the **server** gates on the `perm` bitset and is the real
 * boundary. There is no `/me` endpoint yet, so profile fields the token doesn't carry (job title,
 * department, team) stay empty until `workforce` ships.
 */
import {
  AuthenticationDetails,
  CognitoUser,
  CognitoUserSession,
} from "amazon-cognito-identity-js";
import { claimsOf, cognitoSignOut, userPool } from "@/lib/cognito";
import type { AuthSession, User } from "@/types/user";

/** A quick-login shortcut shown on the sign-in screen (email prefill only — a real password is required). */
export interface DemoAccount {
  email: string;
  /** Short label for the button (the role/persona). */
  label: string;
  /** One-line description of what this login can see. */
  hint: string;
}

/** The seeded owner account (`just seed` + `just bootstrap-owner`). The password is NOT hardcoded. */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  { email: "owner@acme.test", label: "Owner", hint: "Full admin access" },
];

/** Kept for back-compat; the primary (owner) demo email. */
export const DEMO_EMAIL = DEMO_ACCOUNTS[0].email;

export interface LoginResult {
  session: AuthSession;
  user: User;
}

export class AuthError extends Error {}

/** Derive a display name from the email local-part until `workforce` serves real profiles. */
function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function toUser(session: CognitoUserSession): User {
  const c = claimsOf(session);
  return {
    id: c.sub,
    name: nameFromEmail(c.email),
    email: c.email,
    // Same ids the backend seeds — the roles store resolves the permission set from this.
    roleId:
      c["custom:roleId"] || (c.is_owner === "true" ? "role-owner" : "role-employee"),
    jobTitle: "",
    department: "",
    team: "",
    status: "active",
    productivityScore: 0,
    organizationId: c.tenant_id || c["custom:orgId"],
  };
}

function toSession(session: CognitoUserSession): AuthSession {
  const c = claimsOf(session);
  return {
    token: session.getIdToken().getJwtToken(),
    userId: c.sub,
    issuedAt: c.iat * 1000,
  };
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResult> {
  const username = email.trim().toLowerCase();
  const user = new CognitoUser({ Username: username, Pool: userPool() });
  const details = new AuthenticationDetails({
    Username: username,
    Password: password,
  });

  const session = await new Promise<CognitoUserSession>((resolve, reject) => {
    user.authenticateUser(details, {
      onSuccess: (s) => resolve(s),
      onFailure: (err: { code?: string; message?: string }) => {
        const code = err?.code ?? "";
        if (code === "NotAuthorizedException")
          return reject(new AuthError("Incorrect email or password."));
        if (code === "UserNotFoundException")
          return reject(new AuthError("No account found for that email."));
        if (code === "UserNotConfirmedException")
          return reject(new AuthError("This account is not confirmed yet."));
        if (code === "PasswordResetRequiredException")
          return reject(new AuthError("A password reset is required."));
        return reject(new AuthError(err?.message ?? "Sign-in failed."));
      },
      // The pool allows TOTP MFA; surface these rather than silently hanging.
      newPasswordRequired: () =>
        reject(
          new AuthError(
            "A new password is required for this account. Set a permanent password first.",
          ),
        ),
      mfaRequired: () =>
        reject(
          new AuthError("MFA is required for this account — not wired up yet."),
        ),
      totpRequired: () =>
        reject(
          new AuthError("MFA is required for this account — not wired up yet."),
        ),
    });
  });

  return { session: toSession(session), user: toUser(session) };
}

/** Clear the Cognito session (the auth store clears its own state). */
export function logout(): void {
  cognitoSignOut();
}
