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

/** Tell the server where to attach my topic policy (idempotent server-side). */
async function attachPolicy(identityId: string): Promise<void> {
  await apiFetch<PushGrant>("/v1/me/push-grant", {
    method: "POST",
    body: JSON.stringify({ identity_id: identityId }),
  });
}

/**
 * Temporary AWS credentials for my identity. `reattach` re-sends the policy attach for a cached
 * identity — used once, after a connection that never got its subscription, in case the identity was
 * cached by a build that stored it before its attach had succeeded.
 */
async function credentials(grant: PushGrant, reattach = false): Promise<TempCreds> {
  if (!reattach && cachedCreds && cachedCreds.expiration - Date.now() > 60_000) return cachedCreds;

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
    // Attach first, cache after. The identity used to be cached before the attach, and the attach
    // only ran when nothing was cached — so one failed POST left this browser holding an identity
    // with no IoT policy for good, retrying a connection IoT would always refuse (QA audit
    // 2026-10-08, WP-237).
    await attachPolicy(got.IdentityId);
    identityId = got.IdentityId;
    localStorage.setItem(IDENTITY_KEY, identityId);
  } else if (reattach) {
    await attachPolicy(identityId);
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

/**
 * Everyone listening, sharing **one** connection. `startPush` used to be a singleton that a second
 * caller silently took over: Capture now ended the notification bell's connection, stopped its own on
 * unmount, and the bell kept a dead handle for the rest of the session (QA audit 2026-10-08, WP-236).
 * Each caller now subscribes; the connection opens with the first and closes with the last.
 */
const subscribers = new Set<{ onMessage: PushHandler }>();
let stopConnection: (() => void) | null = null;

/**
 * Subscribe to the signed-in user's inbox topic. Returns an unsubscribe function — call it exactly
 * when the caller stops listening; the shared connection ends when the last subscriber leaves. All
 * failures are silent by contract — the caller's polling continues regardless.
 */
export function startPush(onMessage: PushHandler): () => void {
  // A wrapper per call, so two subscriptions with the same handler stay two subscriptions.
  const sub = { onMessage };
  subscribers.add(sub);
  if (!stopConnection) stopConnection = connectRail(deliver);
  return () => {
    if (!subscribers.delete(sub)) return;
    if (subscribers.size === 0) {
      stopConnection?.();
      stopConnection = null;
    }
  };
}

/** Ring every subscriber's doorbell. One consumer's bug must not starve the others. */
function deliver(message: unknown): void {
  for (const sub of [...subscribers]) {
    try {
      sub.onMessage(message);
    } catch {
      /* best-effort by contract */
    }
  }
}

/** The connection itself — one per page, owned by {@link startPush}. Returns its stop function. */
function connectRail(onMessage: PushHandler): () => void {
  let alive = true;
  let attempt = 0;
  let client: { end: (force: boolean) => void } | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  /** The next connect re-sends the policy attach (at most once per connection lifetime). */
  let reattachNext = false;
  let reattached = false;

  async function connect(): Promise<void> {
    if (!alive) return;
    try {
      const grant = await apiFetch<PushGrant>("/v1/me/push-grant", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const creds = await credentials(grant, reattachNext);
      reattachNext = false;
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
      let subscribed = false;

      c.on("connect", () => {
        c.subscribe(grant.topic, { qos: 1 }, (err, granted) => {
          // A refused subscription is a failed connection, not a healthy one — and the backoff
          // resets only once the inbox is really ours, so a refusal can't loop every 4 s (WP-237).
          if (err || granted?.some((g) => g.qos === 128)) {
            c.end(true);
            return;
          }
          subscribed = true;
          attempt = 0;
        });
      });
      c.on("message", (_topic: string, payload: Uint8Array) => {
        try {
          onMessage(JSON.parse(new TextDecoder().decode(payload)));
        } catch {
          onMessage(null);
        }
      });
      c.on("close", () => {
        // Never got the inbox: the cached identity may be one whose policy attach never landed.
        // Re-attach once — it is idempotent server-side — rather than retry a refusal forever.
        if (!subscribed && !reattached) {
          reattached = true;
          reattachNext = true;
        }
        scheduleRetry();
      });
      c.on("error", () => c.end(true));
    } catch {
      scheduleRetry();
    }
  }

  /** A retry that comes due in a hidden tab waits until the tab is looked at again. */
  function onVisible(): void {
    if (document.visibilityState === "hidden") return;
    document.removeEventListener("visibilitychange", onVisible);
    void connect();
  }

  function scheduleRetry(): void {
    if (!alive || retryTimer) return;
    attempt += 1;
    const backoff = Math.min(60_000, 2_000 * 2 ** Math.min(attempt, 5));
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (!alive) return;
      if (document.visibilityState === "hidden") {
        document.addEventListener("visibilitychange", onVisible);
      } else {
        void connect();
      }
    }, backoff);
  }

  void connect();

  return () => {
    alive = false;
    if (retryTimer) clearTimeout(retryTimer);
    document.removeEventListener("visibilitychange", onVisible);
    client?.end(true);
  };
}
