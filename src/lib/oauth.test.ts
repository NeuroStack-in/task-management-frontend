import { describe, expect, it } from "vitest";
import { ssoFailureCode } from "./oauth";

/**
 * A refused Google sign-in comes back to /callback as Cognito's `error_description`. The pre-sign-up
 * trigger's own refusals get their own copy on the sign-in page; everything else stays generic.
 */
describe("ssoFailureCode", () => {
  it("recognises the trigger's 'already registered' refusal", () => {
    const e = new Error(
      "PreSignUp failed with error This email already has a WorkPulse account. Sign in with your email and password, or use 'Forgot password' to set one..",
    );
    expect(ssoFailureCode(e)).toBe("account_exists");
  });

  it("recognises the trigger's 'unverified email' refusal", () => {
    const e = new Error(
      "PreSignUp failed with error Your Google account's email address isn't verified. Verify it with Google, or sign in with your WorkPulse password..",
    );
    expect(ssoFailureCode(e)).toBe("email_unverified");
  });

  it("keeps every other failure generic", () => {
    expect(ssoFailureCode(new Error("PreSignUp failed with error Sign-in couldn't be completed."))).toBe(
      "failed",
    );
    expect(ssoFailureCode(new Error("Invalid or expired SSO callback."))).toBe("failed");
    expect(ssoFailureCode(new Error("SSO token exchange failed."))).toBe("failed");
    // Not from the trigger, so even matching words are not trusted.
    expect(ssoFailureCode(new Error("already has a WorkPulse account"))).toBe("failed");
    expect(ssoFailureCode(undefined)).toBe("failed");
  });
});
