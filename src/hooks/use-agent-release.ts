"use client";

import { useEffect, useState } from "react";

import { AGENT_MANIFEST_URL, MANAGED_AGENT_MANIFEST_URL } from "@/lib/agent-release";
import { useUiStore } from "@/stores/ui.store";

interface AgentRelease {
  /** The shipped agent version, e.g. `"0.1.7"` — `null` until the release manifest answers. */
  version: string | null;
  /** Is this a release the user hasn't acknowledged yet? Never true while `version` is unknown. */
  isNew: boolean;
  /** Record that the user has seen this release — the notice stays down until the next one. */
  acknowledge: () => void;
}

interface ManifestRead {
  /** The release's version, or `null` when the manifest didn't answer with one. */
  version: string | null;
  /** The bucket said the manifest isn't there — nothing has been published yet. */
  missing: boolean;
}

/** One read per manifest per page load, shared by every caller (navbar, Download page, fleet). */
const manifestReads = new Map<string, Promise<ManifestRead>>();

function readManifest(url: string): Promise<ManifestRead> {
  let read = manifestReads.get(url);
  if (!read) {
    read = fetch(url, { cache: "no-store" })
      .then(async (r): Promise<ManifestRead> => {
        // The bucket answers 403, not 404, for a file that isn't there: it doesn't allow listing.
        if (r.status === 403 || r.status === 404) return { version: null, missing: true };
        if (!r.ok) return { version: null, missing: false };
        const m = (await r.json()) as { version?: unknown } | null;
        const v = typeof m?.version === "string" && m.version ? m.version : null;
        return { version: v, missing: false };
      })
      // Offline, the bucket is unreachable, or the file isn't JSON.
      .catch(() => ({ version: null, missing: false }))
      .then((res) => {
        if (!res.version) manifestReads.delete(url); // a miss is retried by the next caller
        return res;
      });
    manifestReads.set(url, read);
  }
  return read;
}

function readManifestVersion(): Promise<string | null> {
  return readManifest(AGENT_MANIFEST_URL).then((r) => r.version);
}

/**
 * The current desktop-agent release, and whether to announce it.
 *
 * **Reads the release manifest, and nothing else.** `agent/latest/latest.json` is rewritten by the
 * release pipeline itself, so it is true by construction. The version used to *start* as a
 * hand-maintained fallback constant, so every full page load flashed that older number with the
 * new-release dot for a user who had already acknowledged the real release — and when the fetch
 * failed, the stale number stayed announced as new (QA audit 2026-10-08, WP-367). Until the manifest
 * answers there is simply no version, and nothing to announce.
 *
 * The comparison is against the **acknowledged version**, not a dismissed boolean: any version the
 * user hasn't seen is new, so each release announces itself exactly once with no reset step.
 */
export function useAgentRelease(): AgentRelease {
  const [version, setVersion] = useState<string | null>(null);
  const seen = useUiStore((s) => s.agentReleaseSeen);
  const mark = useUiStore((s) => s.markAgentReleaseSeen);

  useEffect(() => {
    let live = true;
    void readManifestVersion().then((v) => {
      if (live && v) setVersion(v);
    });
    return () => {
      live = false;
    };
  }, []);

  return {
    version,
    isNew: version !== null && seen !== version,
    acknowledge: () => {
      if (version) mark(version);
    },
  };
}

/**
 * The **managed** (machine-mode) service's current release, from the manifest its own release
 * workflow writes (`MANAGED_AGENT_MANIFEST_URL`) — a separate stream from the desktop app's.
 * `missing` is `true` once the bucket has said nothing is published yet; `false` while unknown or
 * when it simply couldn't be reached. Pass `enabled: false` to skip the request (an org with no
 * managed devices needn't ask).
 */
export function useManagedAgentRelease(enabled = true): ManifestRead {
  const [read, setRead] = useState<ManifestRead>({ version: null, missing: false });

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void readManifest(MANAGED_AGENT_MANIFEST_URL).then((r) => {
      if (live) setRead(r);
    });
    return () => {
      live = false;
    };
  }, [enabled]);

  return read;
}
