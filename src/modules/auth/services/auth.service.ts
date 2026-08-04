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
import { claimsOf, clearCognitoCache, cognitoSignOut, userPool } from "@/lib/cognito";
import { completeSsoExchange } from "@/lib/oauth";
import { friendlyError } from "@/lib/errors";
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

/**
 * Thrown by `login` when the password was correct but Cognito demands a TOTP code
 * (the user enrolled MFA in Settings → Login & security). The half-authenticated
 * `CognitoUser` is stashed module-side; the /mfa page finishes via `completeTotpChallenge`.
 */
export class TotpChallengeError extends Error {
  constructor() {
    super("A verification code from your authenticator app is required.");
  }
}

/**
 * The `CognitoUser` mid-challenge. Module-level (not a store): it holds live SRP state that
 * cannot be serialised, so a hard refresh on /mfa intentionally loses it — the user just
 * signs in again.
 */
let pendingTotpUser: CognitoUser | null = null;

export function hasPendingTotpChallenge(): boolean {
  return pendingTotpUser !== null;
}

/** Answer the TOTP challenge (`sendMFACode(code, …, "SOFTWARE_TOKEN_MFA")`) and finish sign-in. */
export async function completeTotpChallenge(code: string): Promise<LoginResult> {
  const user = pendingTotpUser;
  if (!user) throw new AuthError("Your sign-in expired. Please sign in again.", "state");
  const session = await new Promise<CognitoUserSession>((resolve, reject) => {
    user.sendMFACode(
      code,
      {
        onSuccess: (s) => resolve(s),
        onFailure: (err: { code?: string }) => {
          if (err?.code === "CodeMismatchException")
            // Keep the pending user — the challenge is still answerable, let them retry.
            return reject(
              new AuthError("That code didn't match. Try again.", "credentials"),
            );
          pendingTotpUser = null;
          reject(new AuthError("Verification failed. Please sign in again.", "state"));
        },
      },
      "SOFTWARE_TOKEN_MFA",
    );
  });
  pendingTotpUser = null;
  return { session: toSession(session), user: toUser(session) };
}

/**
 * `kind` decides how loudly the UI may speak.
 *
 * - `credentials` — the sign-in was refused. **Every cause collapses to one message**, because a
 *   response that distinguishes "no such account" from "wrong password" is an account-enumeration
 *   oracle: an attacker learns which work emails exist by watching which one comes back. OWASP asks
 *   for identical messaging across all failure outcomes, and the same applies to signup and reset.
 * - `state` — the account exists and is reachable, but is in a state the user must be told about
 *   (needs a permanent password, MFA is required). Withholding these strands someone with no route
 *   forward, so the trade lands the other way.
 */
export class AuthError extends Error {
  constructor(
    message: string,
    readonly kind: "credentials" | "state" = "credentials",
  ) {
    super(message);
  }
}

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
    // Every Cognito custom claim is a STRING — comparing to the literal, never a truthiness check.
    isOwner: c.is_owner === "true",
    jobTitle: "",
    department: "",
    team: "",
    status: "active",
    productivityScore: 0,
    organizationId: c.tenant_id || c["custom:orgId"],
    // The raw bitset claim — lets the UI gate derive permissions for server-created custom roles
    // the local store has never heard of (see lib/permission-bits.ts).
    perm: c.perm,
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

export async function login(email: string, password: string): Promise<LoginResult> {
  const username = email.trim().toLowerCase();
  // Start every sign-in from a clean slate. A previous session's cached Cognito artefacts (clock
  // drift, device keys, a half-finished MFA exchange) survive in localStorage and get replayed into
  // this SRP handshake, which Cognito then rejects as `NotAuthorizedException` — reported to the
  // user as "your password is incorrect", for a password that is perfectly correct.
  clearCognitoCache();
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
        // `NotAuthorizedException` (wrong password) and `UserNotFoundException` (no such account)
        // MUST be indistinguishable. Splitting them — as this used to — hands out a directory of
        // which work emails are registered, one guess at a time.
        //
        // `UserNotConfirmedException` and `PasswordResetRequiredException` also imply the account
        // exists, so they leak the same way but narrower; they stay specific because the user is
        // otherwise stranded with no way to act, and both are only reachable for an account an
        // admin already invited.
        if (code === "UserNotConfirmedException")
          return reject(
            new AuthError("This account hasn't been confirmed yet.", "state"),
          );
        if (code === "PasswordResetRequiredException")
          return reject(
            new AuthError("You need to reset your password before signing in.", "state"),
          );
        // ONLY these two are enumeration-sensitive, so only these two collapse to one message.
        if (code === "NotAuthorizedException" || code === "UserNotFoundException")
          return reject(
            new AuthError("Your email or password is incorrect.", "credentials"),
          );
        // Anything else is a real fault — an unsupported challenge, a misconfigured app client, a
        // failing trigger, a network error. Reporting those as "wrong password" is what sent MFA
        // users round in circles resetting a password that was never the problem: surface them.
        // Surfaced, but in the user's language: `friendlyError` knows the Cognito codes, and its
        // fallback beats `Sign-in failed (InvalidLambdaResponseException).` — which told the user
        // nothing and looked like a crash. The raw code still reaches the console below.
        console.error("Cognito sign-in failure", code, err?.message);
        return reject(
          new AuthError(
            friendlyError(
              err,
              "We couldn't sign you in just now. Try again in a moment.",
            ),
            "state",
          ),
        );
      },
      // The pool allows TOTP MFA; surface these rather than silently hanging.
      newPasswordRequired: () =>
        reject(
          new AuthError(
            "This account needs a permanent password set before it can sign in.",
            "state",
          ),
        ),
      // SMS MFA is not offered by this app — only TOTP (enrolled in Settings → Login & security).
      mfaRequired: () =>
        reject(
          new AuthError("This account requires SMS MFA, which isn't supported.", "state"),
        ),
      // Password was right; a TOTP code is now needed. Stash the half-authenticated user and
      // hand off to /mfa (which calls `completeTotpChallenge`).
      totpRequired: () => {
        pendingTotpUser = user;
        reject(new TotpChallengeError());
      },
      // Cognito can also answer with MFA_SETUP (must enrol before signing in) or SELECT_MFA_TYPE
      // (more than one factor configured). Without these the library has no callback to call and
      // the failure surfaces as something unrelated — name them so the user is told what happened.
      mfaSetup: () =>
        reject(
          new AuthError(
            "This account must finish setting up multi-factor authentication before signing in.",
            "state",
          ),
        ),
      selectMFAType: () =>
        reject(
          new AuthError(
            "This account has more than one MFA method configured, which isn't supported yet.",
            "state",
          ),
        ),
    });
  });

  return { session: toSession(session), user: toUser(session) };
}

/**
 * Complete a federated (SSO) sign-in on the `/callback` route: finish the PKCE code exchange, which
 * also writes the tokens into the Cognito session store, then project the same `User`/`AuthSession`
 * the password path returns. Throws on an invalid/expired callback (caller routes back to /login).
 */
export async function completeSso(): Promise<LoginResult> {
  const session = await completeSsoExchange();
  return { session: toSession(session), user: toUser(session) };
}

/**
 * Remove **all** WorkPulse local state (the persisted Zustand stores, keyed by static `wp-*` names).
 *
 * These caches are keyed by store, not by user — so without this, the next person to sign in on the
 * same browser inherits the previous user's cached org state (feature toggles, custom roles,
 * dashboard layout, directory edits), and the two logins disagree. The server is the single source
 * of truth; every login must start clean and re-hydrate from it. Cognito's own tokens
 * (`CognitoIdentityServiceProvider.*`) are not `wp-*` and are cleared separately by `cognitoSignOut`.
 */
export function clearWorkPulseState(): void {
  if (typeof window === "undefined") return;
  // Device-only UI prefs (not account data) are safe to keep across accounts — leaking "the sidebar
  // was collapsed" to the next user is harmless, and resetting it every login is a needless regression.
  const KEEP = new Set(["wp-ui"]);
  try {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("wp-") && !KEEP.has(key)) window.localStorage.removeItem(key);
    }
  } catch {
    // Storage disabled / private mode — nothing cached to clear.
  }
}

/** Clear the Cognito session and every WorkPulse local cache (the auth store clears its own state). */
export function logout(): void {
  cognitoSignOut();
  clearWorkPulseState();
}

/* ------------------------------ Password reset ------------------------------ */
//
// The logged-out "forgot password" flow — two steps against a fresh CognitoUser (there is no
// session yet): `forgotPassword` emails a one-time code, then `confirmPassword` sets the new
// password with that code. This is distinct from the signed-in `changePassword`
// (account-security.service.ts), which needs the *current* password instead of an emailed code.

/**
 * Step 1: ask Cognito to email a password-reset code to `email`. Resolves once the code is on its
 * way. A non-existent account resolves the same way on purpose — telling the caller "no such user"
 * would turn this into an account-enumeration oracle (same stance as {@link login}); the reset page
 * asks for the code regardless.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const username = email.trim().toLowerCase();
  const user = new CognitoUser({ Username: username, Pool: userPool() });
  await new Promise<void>((resolve, reject) => {
    user.forgotPassword({
      onSuccess: () => resolve(),
      // Fires when the code has been delivered — that's our success signal for step 1.
      inputVerificationCode: () => resolve(),
      onFailure: (err: Error) => {
        const code = (err as { code?: string })?.code ?? "";
        // Don't reveal whether the account exists.
        if (code === "UserNotFoundException") return resolve();
        if (code === "LimitExceededException")
          return reject(
            new AuthError("Too many attempts. Wait a bit, then try again.", "state"),
          );
        reject(new AuthError("Couldn't start the reset. Please try again.", "state"));
      },
    });
  });
}

/**
 * Step 2: complete the reset with the emailed `code` and the chosen `newPassword`. Validate the
 * password against the pool policy (`lib/password.ts`) before calling so the user gets a specific
 * message, not Cognito's generic one. A wrong code and an unknown account collapse to the same
 * "code is incorrect" message (enumeration again).
 */
export async function confirmPasswordReset(
  email: string,
  code: string,
  newPassword: string,
): Promise<void> {
  const username = email.trim().toLowerCase();
  const user = new CognitoUser({ Username: username, Pool: userPool() });
  await new Promise<void>((resolve, reject) => {
    user.confirmPassword(code.trim(), newPassword, {
      onSuccess: () => resolve(),
      onFailure: (err: Error) => {
        const c = (err as { code?: string })?.code ?? "";
        if (c === "CodeMismatchException" || c === "UserNotFoundException")
          return reject(
            new AuthError(
              "That code is incorrect. Check your email and try again.",
              "credentials",
            ),
          );
        if (c === "ExpiredCodeException")
          return reject(
            new AuthError("That code has expired. Request a new one.", "state"),
          );
        if (c === "InvalidPasswordException")
          return reject(
            new AuthError("That password doesn't meet the password policy.", "state"),
          );
        if (c === "LimitExceededException")
          return reject(
            new AuthError("Too many attempts. Wait a bit, then try again.", "state"),
          );
        reject(new AuthError("Couldn't reset your password. Please try again.", "state"));
      },
    });
  });
}
