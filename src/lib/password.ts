/**
 * Password policy — mirrors the Cognito user-pool policy exactly (min 12 · upper · lower · number,
 * symbols optional). Every form that sets a Cognito password (signup, invite-accept, reset) must
 * validate against this BEFORE submit — otherwise Cognito rejects the password server-side and the
 * caller gets a confusing generic failure (e.g. org-create 500s after provisioning). Keep in lockstep
 * with the pool's PasswordPolicy.
 */

export const PASSWORD_MIN = 12;

/** Human-readable requirements, for a hint under the field. */
export const PASSWORD_RULES = [
  `At least ${PASSWORD_MIN} characters`,
  "An uppercase and a lowercase letter",
  "A number",
] as const;

/** Returns a specific error message, or `null` when the password satisfies the pool policy. */
export function validatePassword(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (!/[A-Z]/.test(pw)) return "Add an uppercase letter.";
  if (!/[a-z]/.test(pw)) return "Add a lowercase letter.";
  if (!/[0-9]/.test(pw)) return "Add a number.";
  return null;
}
