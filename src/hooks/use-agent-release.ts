"use client";

import { useEffect, useState } from "react";

import { AGENT_MANIFEST_URL } from "@/lib/agent-release";
import { useUiStore } from "@/stores/ui.store";

interface AgentRelease {
  /** The shipped agent version, e.g. `"0.1.7"` — `null` until the release manifest answers. */
  version: string | null;
  /** Is this a release the user hasn't acknowledged yet? Never true while `version` is unknown. */
  isNew: boolean;
  /** Record that the user has seen this release — the notice stays down until the next one. */
  acknowledge: () => void;
}

/** One manifest read per page load, shared by the navbar and the Download page. */
let manifestVersion: Promise<string | null> | null = null;

function readManifestVersion(): Promise<string | null> {
  if (!manifestVersion) {
    manifestVersion = fetch(AGENT_MANIFEST_URL, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((m: { version?: unknown } | null) =>
        typeof m?.version === "string" && m.version ? m.version : null,
      )
      // Offline, or the bucket is unreachable.
      .catch(() => null)
      .then((v) => {
        if (!v) manifestVersion = null; // a miss is retried by the next caller, not cached
        return v;
      });
  }
  return manifestVersion;
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
