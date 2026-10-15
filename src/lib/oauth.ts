/**
 * Cognito Hosted-UI OAuth (authorization-code + PKCE) — the federated / SSO login path.
 *
 * Our SPA client is **public** (no secret), so PKCE — not a client secret — protects the code
 * exchange, and the whole flow runs in the browser: we redirect to the Hosted UI pinned to an
 * identity provider, Cognito bounces back to `/callback?code=…`, and we swap the code for tokens at
 * the token endpoint. The tokens are then written into the **same** `amazon-cognito-identity-js`
 * session store the SRP login uses, so `getIdToken()` / `getCurrentUser()` work unchanged
 * afterwards — SSO and password sign-ins converge on one session model. (WorkPulse-SSO.md §3.)
 */
import {
  CognitoUser,
  CognitoUserSession,
  CognitoIdToken,
  CognitoAccessToken,
  CognitoRefreshToken,
} from "amazon-cognito-identity-js";
import { userPool } from "@/lib/cognito";

const VERIFIER_KEY = "wp-sso-pkce-verifier";
const STATE_KEY = "wp-sso-state";

/** The Hosted-UI base URL (e.g. `https://wp-workpulse-dev.auth.ap-south-1.amazoncognito.com`). */
function hostedUiDomain(): string {
  const d = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
  if (!d) {
    throw new Error(
      "Missing NEXT_PUBLIC_COGNITO_DOMAIN. Set it to the CognitoHostedUiDomain deploy output to use SSO.",
    );
  }
  return d.replace(/\/$/, "");
}

/** Set while the signed-in session came through the Hosted UI (Google/Microsoft). */
const HOSTED_SESSION_KEY = "wp-sso-hosted";

/**
 * The Hosted UI's logout URL when **this browser's session came through it**, else `null` — and the
 * marker is consumed either way.
 *
 * Sign-out cleared this tab's tokens but left the Hosted UI's own session cookie, so the next "Sign
 * in with Google" went straight back into the same account without asking (QA audit 2026-10-08,
 * WP-124). The logout URI (`<origin>/login`) is registered on the app client (auth_stack.py).
 */
export function takeHostedUiLogoutUrl(): string | null {
  if (typeof window === "undefined") return null;
  let hosted = false;
  try {
    hosted = window.localStorage.getItem(HOSTED_SESSION_KEY) === "1";
    window.localStorage.removeItem(HOSTED_SESSION_KEY);
  } catch {
    return null;
  }
  if (!hosted) return null;
  try {
    const q = new URLSearchParams({
      client_id: clientId(),
      logout_uri: `${window.location.origin}/login`,
    });
    return `${hostedUiDomain()}/logout?${q}`;
  } catch {
    return null; // Hosted UI not configured in this build
  }
}

function clientId(): string {
  const id = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
  if (!id) throw new Error("Missing NEXT_PUBLIC_COGNITO_CLIENT_ID.");
  return id;
}

/** The redirect URI Cognito bounces back to — must be registered in the app client's callback URLs. */
function redirectUri(): string {
  return `${window.location.origin}/callback`;
}

// ── PKCE + state helpers (Web Crypto; base64url, no padding) ──

function base64Url(bytes: ArrayBuffer): string {
  const b = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomString(byteLen: number): string {
  const a = new Uint8Array(byteLen);
  crypto.getRandomValues(a);
  return base64Url(a.buffer);
}

async function sha256(input: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
}

/**
 * Begin an SSO sign-in: mint a PKCE verifier + state, stash them for the callback, and redirect the
 * browser to the Hosted UI pinned to `idpName` (`Google`, the only social provider, or a per-org
 * `org-<id>` name).
 * Never resolves — it navigates away.
 */
export async function beginSso(idpName: string): Promise<void> {
  const verifier = randomString(64);
  const state = randomString(16);
  const challenge = base64Url(await sha256(verifier));
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId(),
    redirect_uri: redirectUri(),
    // Not `aws.cognito.signin.user.admin` (yet): the app client allows only these three
    // (`auth_stack.py`), and asking for a scope it doesn't allow fails the whole sign-in. Without it
    // the session can't use Cognito's self-service APIs — see `sessionCanSelfManage`.
    scope: "openid email profile",
    identity_provider: idpName,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  window.location.assign(`${hostedUiDomain()}/oauth2/authorize?${params.toString()}`);
}

/** The scope Cognito's self-service user APIs (`GetUser`, `AssociateSoftwareToken`,
 *  `SetUserMFAPreference`, …) require on the access token. */
export const COGNITO_SELF_SERVICE_SCOPE = "aws.cognito.signin.user.admin";

/**
 * Can this browser's session call Cognito's self-service user APIs?
 *
 * A password (SRP) sign-in's access token carries {@link COGNITO_SELF_SERVICE_SCOPE}; a Hosted-UI
 * (Google) sign-in's carries only what {@link beginSso} asked for. Such a session can't read or
 * change its own MFA, so a screen that said "reload to retry" could never recover (QA audit
 * 2026-10-08, WP-337). Resolves `null` when there is no session to inspect.
 */
export function sessionCanSelfManage(): Promise<boolean | null> {
  return new Promise((resolve) => {
    let user: CognitoUser | null;
    try {
      user = userPool().getCurrentUser();
    } catch {
      return resolve(null);
    }
    if (!user) return resolve(null);
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session) return resolve(null);
      const scope = (session.getAccessToken().decodePayload() as { scope?: unknown }).scope;
      resolve(typeof scope === "string" && scope.split(" ").includes(COGNITO_SELF_SERVICE_SCOPE));
    });
  });
}

/**
 * Why a Google sign-in came back refused, as a fixed code the sign-in page has its own words for.
 *
 * The pre-sign-up trigger refuses some sign-ins on purpose and says why ("this email already has an
 * account", "Google hasn't verified this address"); Cognito hands that back on `/callback` as
 * `error_description=PreSignUp failed with error <message>`. Every failure used to collapse into one
 * generic "couldn't complete your sign-in", so someone told to use their password was never told.
 *
 * A code, not the text: the sign-in page never shows words taken from its URL, so a crafted link
 * cannot put its own message there (QA audit 2026-10-08, WP-107).
 */
export type SsoFailure = "account_exists" | "email_unverified" | "failed";

export function ssoFailureCode(err: unknown): SsoFailure {
  const text = err instanceof Error ? err.message : String(err ?? "");
  if (!/PreSignUp failed/i.test(text)) return "failed";
  if (/already has a WorkPulse account/i.test(text)) return "account_exists";
  if (/isn.?t verified/i.test(text)) return "email_unverified";
  return "failed";
}

interface TokenResponse {
  id_token: string;
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

/**
 * Complete the code→token exchange on the `/callback` route: validate `state`, POST the code +
 * PKCE verifier to the token endpoint, then write the resulting tokens into the Cognito session
 * store (so the rest of the app is signed in). Returns the persisted `CognitoUserSession`.
 *
 * Throws on a mismatched/absent state (possible CSRF or a stale tab) or an OAuth error — the caller
 * shows a generic "couldn't complete sign-in" and routes back to `/login`.
 */
export async function completeSsoExchange(): Promise<CognitoUserSession> {
  const url = new URL(window.location.href);
  const err = url.searchParams.get("error");
  if (err) throw new Error(url.searchParams.get("error_description") || err);

  const code = url.searchParams.get("code");
  const returnedState = url.searchParams.get("state");
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const expectedState = sessionStorage.getItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);

  if (!code || !verifier || !returnedState || returnedState !== expectedState) {
    throw new Error("Invalid or expired SSO callback.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId(),
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  });
  const res = await fetch(`${hostedUiDomain()}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new Error("SSO token exchange failed.");
  const tokens = (await res.json()) as TokenResponse;

  const session = persistSession(tokens);
  // Remember that this sign-in went through the Hosted UI, so sign-out can end that session too.
  try {
    window.localStorage.setItem(HOSTED_SESSION_KEY, "1");
  } catch {
    /* storage off: sign-out then only clears this tab's session, as before */
  }
  return session;
}

/**
 * Write the OAuth tokens into `amazon-cognito-identity-js`'s localStorage session (the same store the
 * SRP path uses), so `getCurrentUser()`/`getSession()` transparently see a signed-in user and
 * silently refresh the 15-minute id token via the refresh token.
 */
function persistSession(tokens: TokenResponse): CognitoUserSession {
  const idToken = new CognitoIdToken({ IdToken: tokens.id_token });
  const accessToken = new CognitoAccessToken({ AccessToken: tokens.access_token });
  const refreshToken = new CognitoRefreshToken({
    RefreshToken: tokens.refresh_token ?? "",
  });
  const session = new CognitoUserSession({
    IdToken: idToken,
    AccessToken: accessToken,
    RefreshToken: refreshToken,
  });

  // Cognito keys its localStorage entries by username; the id token carries it as `cognito:username`.
  const payload = idToken.decodePayload() as Record<string, unknown>;
  const username = String(payload["cognito:username"] ?? payload["sub"] ?? "");
  const user = new CognitoUser({ Username: username, Pool: userPool() });
  user.setSignInUserSession(session);
  return session;
}
