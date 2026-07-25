"use client";

/**
 * The MQTT push rail — browser side (backend/docs/MQTT-MIGRATION.md Phase 2).
 *
 * Push is an ACCELERATOR on top of polling, never a dependency: every message is treated as a
 * doorbell ("something changed for you"), and the consumer re-fetches through the normal HTTP API —
 * so a dropped connection costs one poll interval of freshness and nothing else, and no push
 * payload is ever trusted as state.
 *
 * Connection recipe (each step feeds the next):
 *   1. `POST /v1/me/push-grant` {}            → identity pool id + IoT endpoint + my topic
 *   2. Cognito Identity `GetId`               → my identityId (cached; stable per browser)
 *   3. `POST /v1/me/push-grant` {identity_id} → server attaches my per-user IoT policy
 *   4. `GetCredentialsForIdentity`            → temp AWS creds (cached until expiry)
 *   5. SigV4-presign `wss://<endpoint>/mqtt`  → connect via mqtt.js, subscribe to my topic
 *
 * Reconnects are self-managed (mqtt.js's auto-reconnect can't re-run the async presign), with
 * exponential backoff. Everything here is best-effort and silent: a failure leaves the app exactly
 * as it was before push existed.
 */
import { apiFetch } from "@/lib/api";
import { getIdToken } from "@/lib/cognito";

interface PushGrant {
  identity_pool_id: string;
  iot_endpoint: string;
  topic: string;
  client_id_prefix: string;
  granted: boolean;
}

const REGION = process.env.NEXT_PUBLIC_AWS_REGION ?? "ap-south-1";
const USER_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID ?? "";
const IDENTITY_KEY = "wp-push-identity";

// ── Cognito Identity (raw REST — two tiny unsigned calls; no SDK needed) ────────────────────────

async function cognitoIdentity<T>(target: string, body: unknown): Promise<T> {
  const res = await fetch(`https://cognito-identity.${REGION}.amazonaws.com/`, {
    method: "POST",
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": `AWSCognitoIdentityService.${target}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${target} failed (${res.status})`);
  return (await res.json()) as T;
}

interface TempCreds {
  accessKeyId: string;
  secretKey: string;
  sessionToken: string;
  /** Epoch ms. */
  expiration: number;
}

let cachedCreds: TempCreds | null = null;

async function credentials(grant: PushGrant): Promise<TempCreds> {
  if (cachedCreds && cachedCreds.expiration - Date.now() > 60_000) return cachedCreds;

  const idToken = await getIdToken();
  if (!idToken) throw new Error("no session");
  const provider = `cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`;
  const logins = { [provider]: idToken };

  let identityId = localStorage.getItem(IDENTITY_KEY);
  if (!identityId) {
    const got = await cognitoIdentity<{ IdentityId: string }>("GetId", {
      IdentityPoolId: grant.identity_pool_id,
      Logins: logins,
    });
    identityId = got.IdentityId;
    localStorage.setItem(IDENTITY_KEY, identityId);
    // Tell the server where to attach my topic policy (idempotent server-side).
    await apiFetch<PushGrant>("/v1/me/push-grant", {
      method: "POST",
      body: JSON.stringify({ identity_id: identityId }),
    });
  }

  const out = await cognitoIdentity<{
    Credentials: {
      AccessKeyId: string;
      SecretKey: string;
      SessionToken: string;
      Expiration: number;
    };
  }>("GetCredentialsForIdentity", { IdentityId: identityId, Logins: logins });

  cachedCreds = {
    accessKeyId: out.Credentials.AccessKeyId,
    secretKey: out.Credentials.SecretKey,
    sessionToken: out.Credentials.SessionToken,
    expiration: out.Credentials.Expiration * 1000,
  };
  return cachedCreds;
}

// ── SigV4 presign for the IoT WebSocket (crypto.subtle; no SDK) ─────────────────────────────────

const enc = new TextEncoder();

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(key: ArrayBuffer | Uint8Array, msg: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey(
    "raw",
    key instanceof Uint8Array ? (key.buffer as ArrayBuffer) : key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", k, enc.encode(msg));
}

/** Presigned `wss://…/mqtt` URL per the AWS IoT SigV4 WebSocket recipe. */
async function signedWsUrl(endpoint: string, creds: TempCreds): Promise<string> {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const date = amzDate.slice(0, 8);
  const scope = `${date}/${REGION}/iotdevicegateway/aws4_request`;

  const query =
    "X-Amz-Algorithm=AWS4-HMAC-SHA256" +
    `&X-Amz-Credential=${encodeURIComponent(`${creds.accessKeyId}/${scope}`)}` +
    `&X-Amz-Date=${amzDate}&X-Amz-SignedHeaders=host`;

  const canonical = `GET\n/mqtt\n${query}\nhost:${endpoint}\n\nhost\n${await sha256Hex("")}`;
  const toSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${await sha256Hex(canonical)}`;

  let key: ArrayBuffer = await hmac(enc.encode(`AWS4${creds.secretKey}`), date);
  for (const part of [REGION, "iotdevicegateway", "aws4_request"]) key = await hmac(key, part);
  const sig = [...new Uint8Array(await hmac(key, toSign))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // The session token is appended AFTER signing — that's the documented recipe, not an oversight.
  return (
    `wss://${endpoint}/mqtt?${query}&X-Amz-Signature=${sig}` +
    `&X-Amz-Security-Token=${encodeURIComponent(creds.sessionToken)}`
  );
}

// ── The public surface ──────────────────────────────────────────────────────────────────────────

export type PushHandler = (message: unknown) => void;

let stopCurrent: (() => void) | null = null;

/**
 * Connect and subscribe to the signed-in user's inbox topic. Returns a stop function. Singleton:
 * a second start replaces the first. All failures are silent by contract — the caller's polling
 * continues regardless.
 */
export function startPush(onMessage: PushHandler): () => void {
  let alive = true;
  let attempt = 0;
  let client: { end: (force: boolean) => void } | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  stopCurrent?.();

  async function connect(): Promise<void> {
    if (!alive) return;
    try {
      const grant = await apiFetch<PushGrant>("/v1/me/push-grant", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const creds = await credentials(grant);
      const url = await signedWsUrl(grant.iot_endpoint, creds);
      const mqtt = await import("mqtt");
      if (!alive) return;

      const c = mqtt.default.connect(url, {
        clientId: `${grant.client_id_prefix}-${Math.random().toString(36).slice(2, 8)}`,
        clean: true,
        keepalive: 30,
        // Reconnection is ours: each attempt needs a freshly signed URL (async), which mqtt.js's
        // built-in reconnect cannot produce.
        reconnectPeriod: 0,
        connectTimeout: 10_000,
      });
      client = c;

      c.on("connect", () => {
        attempt = 0;
        c.subscribe(grant.topic, { qos: 1 });
      });
      c.on("message", (_topic: string, payload: Uint8Array) => {
        try {
          onMessage(JSON.parse(new TextDecoder().decode(payload)));
        } catch {
          onMessage(null);
        }
      });
      c.on("close", scheduleRetry);
      c.on("error", () => c.end(true));
    } catch {
      scheduleRetry();
    }
  }

  function scheduleRetry(): void {
    if (!alive || retryTimer) return;
    attempt += 1;
    const backoff = Math.min(60_000, 2_000 * 2 ** Math.min(attempt, 5));
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void connect();
    }, backoff);
  }

  void connect();

  const stop = () => {
    alive = false;
    if (retryTimer) clearTimeout(retryTimer);
    client?.end(true);
    if (stopCurrent === stop) stopCurrent = null;
  };
  stopCurrent = stop;
  return stop;
}
