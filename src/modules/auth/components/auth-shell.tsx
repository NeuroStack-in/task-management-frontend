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
 *
 * In its **compact** variant: these are short, single-purpose screens, and repeating the four-item
 * feature list beside a one-field form was marketing at someone who is only trying to get back in.
 * The panel keeps the brand and one reassuring line (UX audit PUB-07); the frame itself is unchanged,
 * so the page still looks exactly like the sign-in screen.
 */

import { AuthFrame } from "./auth-frame";

export function AuthShell({
  children,
  headline = "Back to work",
  headlineAccent = "in a moment",
  copy = "Your organization's data stays exactly where you left it.",
}: {
  children: React.ReactNode;
  /** Per-page brand copy; the defaults suit the recovery flows. `copy` is the one line shown. */
  headline?: string;
  headlineAccent?: string;
  copy?: string;
}) {
  return (
    <AuthFrame headline={headline} headlineAccent={headlineAccent} copy={copy} variant="compact">
      {children}
    </AuthFrame>
  );
}
