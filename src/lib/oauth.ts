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
 * browser to the Hosted UI pinned to `idpName` (`Google` | `Microsoft` | a per-org `org-<id>` name).
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
    scope: "openid email profile",
    identity_provider: idpName,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  window.location.assign(`${hostedUiDomain()}/oauth2/authorize?${params.toString()}`);
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

  return persistSession(tokens);
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
