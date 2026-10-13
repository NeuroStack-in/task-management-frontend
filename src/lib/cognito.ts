/**
 * Cognito wiring — the real auth provider (replaces the old mock JWT).
 *
 * The user pool + SPA client are created by the backend's `auth` stack; the pre-token-generation
 * trigger stamps the RBAC claims we read below. Login uses **SRP** (the client's enabled flow), so
 * the password never leaves the browser in the clear.
 *
 * `getIdToken()` is the accessor every API call should use: it pulls from the *current Cognito
 * session*, which transparently refreshes the short-lived (15 min) id token via the refresh token.
 * Never read the persisted store's token for an API call — it goes stale.
 */
import {
  CognitoUserPool,
  CognitoUser,
  CognitoUserSession,
} from "amazon-cognito-identity-js";

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.example to .env.local and fill in the backend deploy outputs.`,
    );
  }
  return value;
}

/** Lazily built so a missing env var throws at use-time, not at module import (breaks SSR/build). */
let pool: CognitoUserPool | null = null;

export function userPool(): CognitoUserPool {
  if (!pool) {
    pool = new CognitoUserPool({
      UserPoolId: required(
        "NEXT_PUBLIC_COGNITO_USER_POOL_ID",
        process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
      ),
      ClientId: required(
        "NEXT_PUBLIC_COGNITO_CLIENT_ID",
        process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
      ),
    });
  }
  return pool;
}

/**
 * The claims the pre-token-generation trigger stamps (backend `crates/pretoken`).
 * Cognito serialises every custom claim as a **string** — hence `is_owner: "true"`.
 */
export interface WorkPulseClaims {
  sub: string;
  email: string;
  /** The login's display name — the standard attribute the server sets when it creates a login. */
  name?: string;
  tenant_id: string;
  /** Permission bitset (u128) as a decimal string — the server's authorization source of truth. */
  perm: string;
  is_owner: string;
  scope: "self" | "team" | "org";
  "custom:roleId": string;
  "custom:orgId": string;
  exp: number;
  iat: number;
}

export function claimsOf(session: CognitoUserSession): WorkPulseClaims {
  return session.getIdToken().payload as unknown as WorkPulseClaims;
}

type FreshSessionListener = (session: CognitoUserSession) => void;
const freshSessionListeners = new Set<FreshSessionListener>();
/** `iat` of the newest id token listeners have been told about. */
let lastAnnouncedIat = 0;

/**
 * Be told whenever a **newer** id token is in use — the first one this page load sees, and every
 * silent refresh after it. The auth store re-projects role, permissions and owner flag from it:
 * they were read once at sign-in and persisted, so a role change reached the server within 15
 * minutes but the UI kept the old permission set for the whole 30-day session, across reloads
 * (QA audit 2026-10-08, WP-093). Returns an unsubscribe.
 */
export function onFreshSession(listener: FreshSessionListener): () => void {
  freshSessionListeners.add(listener);
  return () => freshSessionListeners.delete(listener);
}

function announceIfNewer(session: CognitoUserSession): void {
  const iat = session.getIdToken().getIssuedAt();
  if (iat <= lastAnnouncedIat) return;
  lastAnnouncedIat = iat;
  for (const listener of freshSessionListeners) {
    try {
      listener(session);
    } catch {
      // A listener's failure must never cost the caller its token.
    }
  }
}

/** The lookup in flight, shared by every caller that asks meanwhile (see `getIdToken`). */
let pendingToken: Promise<string | null> | null = null;

/**
 * A **fresh** id token for the signed-in user, refreshing it if it expired.
 * Resolves `null` when nobody is signed in.
 *
 * One lookup at a time. Each call used to build its own `CognitoUser` and call `getSession`, so when
 * the 15-minute token lapsed every request in flight ran its own refresh-token exchange at once
 * (QA audit 2026-10-08, WP-391). Callers that arrive while one is running share its answer.
 */
export function getIdToken(): Promise<string | null> {
  if (pendingToken) return pendingToken;
  const lookup = new Promise<string | null>((resolve) => {
    const user: CognitoUser | null = userPool().getCurrentUser();
    if (!user) return resolve(null);
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session?.isValid()) return resolve(null);
      announceIfNewer(session);
      resolve(session.getIdToken().getJwtToken());
    });
  });
  pendingToken = lookup.finally(() => {
    pendingToken = null;
  });
  return pendingToken;
}

/**
 * Is there still a Cognito session behind the app?
 *
 * - `"active"` — a valid id token, refreshed if it had expired.
 * - `"gone"` — nobody is signed in on this browser (signed out, or signed out in another tab), or
 *   Cognito refused the refresh token: it expired (30 days), was revoked, or the user was disabled.
 * - `"offline"` — the refresh could not reach Cognito, so there is no verdict. Callers keep the
 *   session rather than signing someone out because the train went into a tunnel.
 *
 * The SDK reports an unreachable endpoint as `{ code: "NetworkError" }`; every other refusal means
 * the session cannot come back without signing in again.
 */
export type SessionStatus = "active" | "gone" | "offline";

export function sessionStatus(): Promise<SessionStatus> {
  return new Promise((resolve) => {
    let user: CognitoUser | null;
    try {
      user = userPool().getCurrentUser();
    } catch {
      // Not configured (a test, a broken build): no verdict, so nothing is torn down on its account.
      return resolve("offline");
    }
    if (!user) return resolve("gone");
    user.getSession(
      (err: { code?: string } | null, session: CognitoUserSession | null) => {
        if (err) return resolve(err.code === "NetworkError" ? "offline" : "gone");
        resolve(session?.isValid() ? "active" : "gone");
      },
    );
  });
}

/**
 * **Force** a new id token by exchanging the refresh token, re-running the pre-token trigger.
 *
 * `getIdToken` only refreshes when the cached token has *expired*, so a claim that changed
 * server-side (e.g. `custom:orgId` after self-service org provisioning) would not appear for up to
 * the token's lifetime. This bypasses the cache: it re-mints immediately so the new tenant/role
 * claims take effect at once. Resolves `null` when nobody is signed in or the refresh fails.
 */
export function refreshSession(): Promise<CognitoUserSession | null> {
  return new Promise((resolve) => {
    const user: CognitoUser | null = userPool().getCurrentUser();
    if (!user) return resolve(null);
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session) return resolve(null);
      user.refreshSession(session.getRefreshToken(), (e2: Error | null, fresh) => {
        resolve(e2 || !fresh ? null : (fresh as CognitoUserSession));
      });
    });
  });
}

/** End the Cognito session: revoke its refresh token server-side, then clear it locally. */
export function cognitoSignOut(): void {
  revokeRefreshToken();
  userPool().getCurrentUser()?.signOut();
  // `signOut()` only drops the *current* user's tokens. Sweep the rest so nothing survives.
  clearCognitoCache();
}

/**
 * Revoke the stored refresh token (`RevokeToken`). Sign-out used to delete local data only, so a
 * refresh token copied before it kept minting tokens for up to 30 days (QA audit 2026-10-08,
 * WP-124). Fire-and-forget with `keepalive`, so the request survives the navigation to /login; the
 * token is read from storage directly — refreshing a session here could write fresh tokens back
 * after the local clear.
 */
function revokeRefreshToken(): void {
  if (typeof window === "undefined") return;
  try {
    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
    const poolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
    const user = userPool().getCurrentUser();
    if (!clientId || !poolId || !user) return;
    const token = window.localStorage.getItem(
      `CognitoIdentityServiceProvider.${clientId}.${user.getUsername()}.refreshToken`,
    );
    if (!token) return;
    const region = poolId.split("_")[0];
    void fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Target": "AWSCognitoIdentityProviderService.RevokeToken",
      },
      body: JSON.stringify({ Token: token, ClientId: clientId }),
      keepalive: true,
    }).catch(() => {
      // Offline: the local clear below still signs this browser out.
    });
  } catch {
    // Storage blocked or pool unconfigured — nothing to revoke.
  }
}

/**
 * Remove every cached Cognito artefact for this app's client id.
 *
 * The SDK caches more than tokens under `CognitoIdentityServiceProvider.<clientId>.*` — the last
 * authenticated user, clock drift, and device keys. Those are written during a session and are NOT
 * all cleared by `signOut()`, so they can outlive it and be replayed into the next SRP exchange.
 * When that happens Cognito rejects the attempt with `NotAuthorizedException`, which is
 * indistinguishable from a wrong password — a sign-in that cannot succeed no matter how many times
 * the password is reset. Starting every sign-in from a clean slate removes that whole failure mode.
 */
export function clearCognitoCache(): void {
  if (typeof window === "undefined") return;
  try {
    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
    if (!clientId) return;
    const prefix = `CognitoIdentityServiceProvider.${clientId}`;
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(prefix)) window.localStorage.removeItem(key);
    }
  } catch {
    // Storage blocked/unavailable — there is nothing cached to poison the exchange.
  }
}

/**
 * Remove every cached Cognito artefact that belongs to anyone but the user signed in now. For the
 * SSO path, whose token exchange writes the new session before anything else can run: sign-in with a
 * password clears the whole cache first (`clearCognitoCache`), this one can only clear afterwards.
 */
export function clearOtherCognitoUsers(): void {
  if (typeof window === "undefined") return;
  try {
    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
    const current = userPool().getCurrentUser()?.getUsername();
    if (!clientId || !current) return;
    const prefix = `CognitoIdentityServiceProvider.${clientId}.`;
    const lastUser = `${prefix}LastAuthUser`;
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith(prefix) && key !== lastUser && !key.startsWith(`${prefix}${current}.`)) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // Storage blocked/unavailable — nothing of anyone's is cached.
  }
}
