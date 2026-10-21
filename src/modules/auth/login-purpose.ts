/**
 * What the sign-in card says, given the `?from=` that `AuthGuard` puts on `/login` when it turns a
 * signed-out visitor away.
 *
 * A signed-out visitor to `/download` (a link handed around for installing the desktop app) used to
 * land on a plain "Welcome back" with no word about the download they had asked for — it read as
 * though the link were broken (UX audit PUB-09). Only destinations where the plain greeting would
 * confuse get their own wording; everything else keeps the default.
 */
export interface SignInHeading {
  title: string;
  subtitle: string;
}

export const DEFAULT_SIGN_IN_HEADING: SignInHeading = {
  title: "Welcome back",
  subtitle: "Sign in to pick up where your team left off.",
};

const BY_DESTINATION: Record<string, SignInHeading> = {
  "/download": {
    title: "Sign in to download the desktop app",
    subtitle: "Use your WorkPulse account — you'll go straight to the download once you're in.",
  },
};

/** `from` is the raw query value (path plus any query string), or null when there is none. */
export function signInHeading(from: string | null | undefined): SignInHeading {
  if (!from || !from.startsWith("/")) return DEFAULT_SIGN_IN_HEADING;
  const path = from.split(/[?#]/, 1)[0].replace(/\/+$/, "") || "/";
  return BY_DESTINATION[path] ?? DEFAULT_SIGN_IN_HEADING;
}
