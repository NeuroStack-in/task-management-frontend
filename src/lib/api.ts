/**
 * The real backend HTTP client.
 *
 * This is the seam the mock services are migrating onto: `component → module service → apiFetch`.
 * Every call carries a **fresh** Cognito id token (see `lib/cognito.getIdToken`) — the API Gateway
 * JWT authorizer verifies it and the Lambda reads the RBAC claims from it. A 401 means the session
 * is gone/expired; a 403 means the server denied the permission (the server is the real gate).
 */
import { getIdToken } from "@/lib/cognito";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

function baseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    throw new ApiError(
      "Missing NEXT_PUBLIC_API_URL. Copy .env.example to .env.local.",
      0,
    );
  }
  return url.replace(/\/$/, "");
}

/** The backend's success envelope: `{ data, cursor? }`; errors are `{ error: { code, message } }`. */
interface Envelope<T> {
  data: T;
  cursor?: string;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getIdToken();
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  const body: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } })?.error;
    throw new ApiError(
      err?.message ?? `Request failed (${res.status}).`,
      res.status,
      err?.code,
    );
  }
  return (body as Envelope<T>).data;
}

/** Plan entitlements for the signed-in user's org — `GET /v1/org/entitlements` (identity context). */
export interface Entitlements {
  plan: string;
  /** Feature keys the plan permits (the ceiling). */
  allowed: string[];
  /** Feature key → owner-activated flag. */
  enabled: Record<string, boolean>;
  version: number;
}

export function getEntitlements(): Promise<Entitlements> {
  return apiFetch<Entitlements>("/v1/org/entitlements");
}
