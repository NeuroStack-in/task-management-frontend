/**
 * SSO discovery — the email-first routing call (`GET /v1/auth/sso/discover`, public).
 *
 * The login page asks this before showing any credential field: it returns whether the email's
 * **domain** is bound to a verified enterprise IdP (→ redirect to the Hosted UI) or not (→ password
 * form). It is a **public** endpoint (the caller has no session yet), so this uses a bare `fetch`
 * against the API base rather than `apiFetch` (which would attach a Cognito token there is none of).
 * The response reveals only domain routing, never whether the account exists.
 */

export interface SsoDiscovery {
  sso: boolean;
  provider?: string;
  /** The Cognito IdP name to pin on the authorize URL (`identity_provider=<idp_name>`). */
  idp_name?: string;
  /** The org requires SSO for this domain — the login page must block password entry. */
  enforced?: boolean;
}

function apiBase(): string {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) throw new Error("Missing NEXT_PUBLIC_API_URL.");
  return base.replace(/\/$/, "");
}

/**
 * Resolve how `email` should sign in. Fails **soft** to the password path: any network/parse error
 * returns `{ sso: false }` so a discovery hiccup never blocks password login.
 */
export async function discoverSso(email: string): Promise<SsoDiscovery> {
  try {
    const res = await fetch(
      `${apiBase()}/v1/auth/sso/discover?email=${encodeURIComponent(email.trim())}`,
      { headers: { Accept: "application/json" } },
    );
    if (!res.ok) return { sso: false };
    const body = (await res.json()) as { data?: SsoDiscovery } | SsoDiscovery;
    // The server wraps success in `{ data }`; tolerate a bare object too.
    const data = "data" in body && body.data ? body.data : (body as SsoDiscovery);
    return {
      sso: Boolean(data?.sso),
      provider: data?.provider,
      idp_name: data?.idp_name,
      enforced: Boolean(data?.enforced),
    };
  } catch {
    return { sso: false };
  }
}
