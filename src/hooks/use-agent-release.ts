"use client";

import { useEffect, useState } from "react";

import { AGENT_MANIFEST_URL, AGENT_RELEASE_VERSION } from "@/lib/mock-agents";
import { useUiStore } from "@/stores/ui.store";

interface AgentRelease {
  /** The shipped agent version, e.g. `"0.1.7"`. */
  version: string;
  /** Is this a release the user hasn't acknowledged yet? */
  isNew: boolean;
  /** Record that the user has seen this release — the notice stays down until the next one. */
  acknowledge: () => void;
}

/**
 * The current desktop-agent release, and whether to announce it.
 *
 * **Reads the release manifest, not a constant.** `AGENT_RELEASE_VERSION` is hand-maintained and the
 * file that defines it already records going "stale twice in a day" — it was still `0.1.3` while
 * 0.1.6 was shipping. Since the requirement is that the notice appears *after every release*, keying
 * it to a number somebody has to remember to edit would break on the first release anyone forgot.
 * `agent/latest/latest.json` is rewritten by the release pipeline itself, so it is true by
 * construction, and the constant survives only as the offline fallback.
 *
 * The comparison is against the **acknowledged version**, not a dismissed boolean: any version the
 * user hasn't seen is new, so each release announces itself exactly once with no reset step.
 */
export function useAgentRelease(): AgentRelease {
  const [version, setVersion] = useState(AGENT_RELEASE_VERSION);
  const seen = useUiStore((s) => s.agentReleaseSeen);
  const mark = useUiStore((s) => s.markAgentReleaseSeen);

  useEffect(() => {
    let live = true;
    fetch(AGENT_MANIFEST_URL, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((m: { version?: string } | null) => {
        if (live && m?.version) setVersion(m.version);
      })
      .catch(() => {
        // Offline, or the bucket is unreachable. The fallback constant is already in state — a
        // slightly old number beats claiming there is no agent.
      });
    return () => {
      live = false;
    };
  }, []);

  return {
    version,
    isNew: seen !== version,
    acknowledge: () => mark(version),
  };
}
