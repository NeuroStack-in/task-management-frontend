/**
 * Enterprise SSO administration — the org-owner/admin surface behind `/v1/security/sso`
 * (identity context, `SecurityManage`-gated). Create a SAML/OIDC connection (which provisions a real
 * per-org Cognito IdP), register + DNS-TXT-verify the email domains that route to it, then enable it.
 *
 * The server never returns secret material; `has_secret` tells the UI a secret/metadata is stored.
 */
import { apiFetch } from "@/lib/api";

export interface SsoConnection {
  protocol: "saml" | "oidc";
  status: "draft" | "enabled" | "disabled";
  cognito_idp_name: string;
  domains: string[];
  issuer?: string;
  client_id?: string;
  has_secret: boolean;
  /** SSO is required for this connection's domains (password login blocked for those users). */
  enforced: boolean;
  /** SAML signing-cert expiry (epoch **seconds**) when known — drives the expiry warning. */
  cert_expires?: number;
  version: number;
}

export interface PutConnectionInput {
  protocol: "saml" | "oidc";
  metadata?: string;
  email_attribute?: string;
  issuer?: string;
  client_id?: string;
  client_secret?: string;
  enabled: boolean;
  /** Require SSO for this connection's verified domains (block password login). */
  enforced?: boolean;
  version: number;
}

export interface DomainChallenge {
  domain: string;
  verified: boolean;
  /** The DNS record name to create: `_workpulse-verify.<domain>`. */
  txt_name: string;
  /** The exact TXT value to publish. */
  txt_value: string;
}

export function listConnections(): Promise<{ connections: SsoConnection[] }> {
  return apiFetch<{ connections: SsoConnection[] }>("/v1/security/sso");
}

export function putConnection(input: PutConnectionInput): Promise<SsoConnection> {
  return apiFetch<SsoConnection>("/v1/security/sso", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function deleteConnection(provider: string): Promise<unknown> {
  return apiFetch(`/v1/security/sso/${encodeURIComponent(provider)}`, { method: "DELETE" });
}

export function registerDomain(provider: string, domain: string): Promise<DomainChallenge> {
  return apiFetch<DomainChallenge>("/v1/security/sso/domains", {
    method: "POST",
    body: JSON.stringify({ provider, domain }),
  });
}

export function verifyDomain(domain: string): Promise<DomainChallenge> {
  return apiFetch<DomainChallenge>(
    `/v1/security/sso/domains/${encodeURIComponent(domain)}/verify`,
    { method: "POST" },
  );
}
