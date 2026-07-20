"use client";

/**
 * The secondary auth surfaces — forgot password, reset password, MFA, accept invite.
 *
 * This used to be a light, centred card built on the *app* tokens, with no brand panel and none of
 * the auth theme. The effect was that anyone resetting a password or accepting an invite dropped
 * out of the design system halfway through the flow — the same product rendered two different ways,
 * at exactly the moment a user is most alert to whether a page is genuine. A password-reset screen
 * is also among the most-phished surfaces a SaaS has, so "looks exactly like the login page" is a
 * security affordance and not only a tidiness one.
 *
 * It now delegates to `AuthFrame`, so all six screens share one composition, one help affordance in
 * one position (WCAG 2.2 SC 3.2.6 Consistent Help), and one set of field primitives.
 */

import { AuthFrame } from "./auth-frame";

export function AuthShell({
  children,
  headline = "Back to work",
  headlineAccent = "in a moment",
  copy = "We'll get you signed in again. Your organization's data stays exactly where you left it.",
}: {
  children: React.ReactNode;
  /** Per-page brand copy; the defaults suit the recovery flows. */
  headline?: string;
  headlineAccent?: string;
  copy?: string;
}) {
  return (
    <AuthFrame headline={headline} headlineAccent={headlineAccent} copy={copy}>
      {children}
    </AuthFrame>
  );
}
