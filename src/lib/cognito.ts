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

/**
 * A **fresh** id token for the signed-in user, refreshing it if it expired.
 * Resolves `null` when nobody is signed in.
 */
export function getIdToken(): Promise<string | null> {
  return new Promise((resolve) => {
    const user: CognitoUser | null = userPool().getCurrentUser();
    if (!user) return resolve(null);
    user.getSession((err: Error | null, session: CognitoUserSession | null) => {
      if (err || !session?.isValid()) return resolve(null);
      resolve(session.getIdToken().getJwtToken());
    });
  });
}

/** Clear the Cognito session (tokens in localStorage). */
export function cognitoSignOut(): void {
  userPool().getCurrentUser()?.signOut();
  // `signOut()` only drops the *current* user's tokens. Sweep the rest so nothing survives.
  clearCognitoCache();
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
