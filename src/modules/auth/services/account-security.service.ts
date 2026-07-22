/**
 * Self-service account security against the signed-in user's Cognito session.
 *
 * Everything here is client-side Cognito (amazon-cognito-identity-js) — there is deliberately no
 * backend REST route for MFA enrollment or password change; Cognito is the system of record.
 * Callback-style Cognito APIs are wrapped into promises, same style as `auth.service.ts`.
 *
 * Every operation starts from `signedInUser()`, which revalidates the current session (refreshing
 * the tokens if needed). A missing/expired session rejects with `SessionExpiredError` so the UI can
 * prompt a re-login instead of surfacing a raw Cognito error.
 */
import type { CognitoUser, CognitoUserSession } from "amazon-cognito-identity-js";
import { claimsOf, userPool } from "@/lib/cognito";

/** Nobody signed in (or the refresh token died) — the UI should route back to /login. */
export class SessionExpiredError extends Error {
  constructor() {
    super("Your session has expired. Please sign in again.");
  }
}

/** Cognito error shape (`code` is the Cognito exception name). */
interface CognitoError {
  code?: string;
  message?: string;
}

/**
 * The signed-in `CognitoUser` with a **validated** session attached.
 * `getSession()` must run before any user-API call — it hydrates `signInUserSession`
 * (and silently refreshes an expired id token via the refresh token).
 */
function signedInUser(): Promise<{ user: CognitoUser; session: CognitoUserSession }> {
  return new Promise((resolve, reject) => {
    const user = userPool().getCurrentUser();
    if (!user) return reject(new SessionExpiredError());
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session?.isValid()) return reject(new SessionExpiredError());
      resolve({ user, session });
    });
  });
}

/* ------------------------------- TOTP MFA ---------------------------------- */

export interface TotpEnrollment {
  /** Base32 secret from Cognito — show it as the manual-entry fallback. */
  secret: string;
  /** otpauth:// URI for the QR code (authenticator apps). */
  otpauthUri: string;
}

/** Whether TOTP MFA is currently enabled for the signed-in user (fresh, cache bypassed). */
export async function fetchTotpEnabled(): Promise<boolean> {
  const { user } = await signedInUser();
  return new Promise((resolve, reject) => {
    user.getUserData(
      (err, data) => {
        if (err || !data) return reject(new Error("Couldn't load your MFA status."));
        resolve((data.UserMFASettingList ?? []).includes("SOFTWARE_TOKEN_MFA"));
      },
      { bypassCache: true },
    );
  });
}

/**
 * Step 1 of enrollment: ask Cognito for a fresh TOTP secret
 * (`associateSoftwareToken`) and build the otpauth URI for the QR code.
 */
export async function beginTotpEnrollment(): Promise<TotpEnrollment> {
  const { user, session } = await signedInUser();
  const email = claimsOf(session).email;
  const secret = await new Promise<string>((resolve, reject) => {
    user.associateSoftwareToken({
      associateSecretCode: (secretCode) => resolve(secretCode),
      onFailure: () => reject(new Error("Couldn't start MFA setup. Try again.")),
    });
  });
  const otpauthUri =
    `otpauth://totp/WorkPulse:${encodeURIComponent(email)}` +
    `?secret=${secret}&issuer=WorkPulse&algorithm=SHA1&digits=6&period=30`;
  return { secret, otpauthUri };
}

/**
 * Step 2 of enrollment: verify the 6-digit code from the authenticator
 * (`verifySoftwareToken`), then mark TOTP as the preferred MFA method
 * (`setUserMfaPreference`). From the next sign-in on, login gets a TOTP challenge.
 */
export async function confirmTotpEnrollment(code: string): Promise<void> {
  const { user } = await signedInUser();
  await new Promise<void>((resolve, reject) => {
    user.verifySoftwareToken(code, "WorkPulse web", {
      onSuccess: () => resolve(),
      onFailure: (err: CognitoError) => {
        // EnableSoftwareTokenMFAException = wrong/expired code (Cognito's CodeMismatch for TOTP).
        if (err?.code === "EnableSoftwareTokenMFAException" || err?.code === "CodeMismatchException")
          return reject(new Error("That code didn't match. Check your app and try again."));
        reject(new Error("Couldn't verify the code. Try again."));
      },
    });
  });
  await setTotpPreference(user, true);
}

/** Turn TOTP MFA off for the signed-in user. */
export async function disableTotp(): Promise<void> {
  const { user } = await signedInUser();
  await setTotpPreference(user, false);
}

function setTotpPreference(user: CognitoUser, enabled: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    user.setUserMfaPreference(
      null, // SMS MFA — not offered.
      { PreferredMfa: enabled, Enabled: enabled },
      (err) => {
        if (err)
          return reject(
            new Error(
              enabled ? "Verified, but enabling MFA failed. Try again." : "Couldn't turn off MFA. Try again.",
            ),
          );
        resolve();
      },
    );
  });
}

/* ----------------------------- Password change ----------------------------- */

/**
 * Change the signed-in user's password (`changePassword` on the current session).
 * The new password must already satisfy the pool policy (`lib/password.ts`) —
 * validate before calling so users get a specific message, not Cognito's generic one.
 */
export async function changePassword(oldPassword: string, newPassword: string): Promise<void> {
  const { user } = await signedInUser();
  await new Promise<void>((resolve, reject) => {
    user.changePassword(oldPassword, newPassword, (err) => {
      if (!err) return resolve();
      const code = (err as CognitoError).code ?? "";
      if (code === "NotAuthorizedException")
        return reject(new Error("Your current password is incorrect."));
      if (code === "LimitExceededException")
        return reject(new Error("Too many attempts. Wait a bit, then try again."));
      if (code === "InvalidPasswordException")
        return reject(new Error("The new password doesn't meet the password policy."));
      reject(new Error("Couldn't update your password. Try again."));
    });
  });
}
