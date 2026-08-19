"use client";

/**
 * App/URL tracking rules — the real backend (`identity`, LLD §14). `GET/PUT /v1/org/rules`, and its
 * per-department twin `GET/PUT /v1/org/departments/{id}/rules`.
 *
 * The rules are the config the **desktop agent** pulls on its next heartbeat: how apps/urls are
 * classified, what's blocked, what's exempt, and the productivity-score weights. The write is
 * **version-conditioned** (optimistic lock) — a stale save 409s, and we reload so the admin re-applies
 * onto the current version rather than clobbering a concurrent change.
 *
 * The document is opaque server-side, but the agent expects specific keys, so we normalize to them:
 * `apps[]` (classification), `urls[]`, `blocked/exceptions {apps,urls}`, and `category_weights`.
 * (Effects are agent-gated — the agent isn't running yet — but the config is real and persisted.)
 *
 * `useRulesDoc(path)` is the generic hook (org **or** department); `useOrgRules()` is the org-scoped
 * shorthand. Both go through the `org.service` rules helpers rather than `apiFetch` directly.
 */
import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  ORG_RULES_PATH,
  getRulesEnvelope,
  putRulesEnvelope,
} from "./services/org.service";

export type RuleCategory = "productive" | "neutral" | "distracting";

export interface AppRule {
  process_name: string;
  display_name: string;
  category: RuleCategory;
  tracked: boolean;
}

export interface UrlRule {
  domain: string;
  category: RuleCategory;
  tracked: boolean;
}

export interface RulesDoc {
  apps: AppRule[];
  urls: UrlRule[];
  blocked: { apps: string[]; urls: string[] };
  exceptions: { apps: string[]; urls: string[] };
  category_weights: Record<RuleCategory, number>;
}

const DEFAULT_DOC: RulesDoc = {
  apps: [],
  urls: [],
  blocked: { apps: [], urls: [] },
  exceptions: { apps: [], urls: [] },
  category_weights: { productive: 1, neutral: 0.5, distracting: 0 },
};

/** Coerce the opaque server document into our normalized shape, tolerating missing/legacy keys. */
function normalize(raw: unknown): RulesDoc {
  const d = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const cat = (v: unknown): RuleCategory =>
    v === "productive" || v === "distracting" ? v : "neutral";
  const strList = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const apps = Array.isArray(d.apps)
    ? d.apps.map((a) => {
        const o = (a ?? {}) as Record<string, unknown>;
        return {
          process_name: String(o.process_name ?? ""),
          display_name: String(o.display_name ?? o.process_name ?? ""),
          category: cat(o.category),
          tracked: o.tracked !== false,
        };
      })
    : [];
  const urls = Array.isArray(d.urls)
    ? d.urls.map((u) => {
        const o = (u ?? {}) as Record<string, unknown>;
        return {
          domain: String(o.domain ?? o.url ?? ""),
          category: cat(o.category),
          tracked: o.tracked !== false,
        };
      })
    : [];
  const blocked = (d.blocked ?? {}) as Record<string, unknown>;
  const exceptions = (d.exceptions ?? {}) as Record<string, unknown>;
  const weights = (d.category_weights ?? {}) as Record<string, unknown>;
  const num = (v: unknown, dflt: number) => (typeof v === "number" ? v : dflt);
  return {
    apps,
    urls,
    blocked: { apps: strList(blocked.apps), urls: strList(blocked.urls) },
    exceptions: { apps: strList(exceptions.apps), urls: strList(exceptions.urls) },
    category_weights: {
      productive: num(weights.productive, DEFAULT_DOC.category_weights.productive),
      neutral: num(weights.neutral, DEFAULT_DOC.category_weights.neutral),
      distracting: num(weights.distracting, DEFAULT_DOC.category_weights.distracting),
    },
  };
}

export interface OrgRulesState {
  doc: RulesDoc | null;
  version: number;
  loading: boolean;
  error: string | null;
  reload: () => void;
  /** Persist under the current version (optimistic lock). Throws on failure; 409 means reload first. */
  save: (next: RulesDoc) => Promise<void>;
}

/**
 * Load + save a rules document at `path` (org or per-department). `path` is a primitive so the load
 * effect's dependency stays stable across renders — callers pass a constant string (org) or a
 * `deptRulesPath(id)` string (department).
 */
export function useRulesDoc(path: string): OrgRulesState {
  const [doc, setDoc] = useState<RulesDoc | null>(null);
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    getRulesEnvelope(path)
      .then((env) => {
        if (!live) return;
        setDoc(normalize(env.rules));
        setVersion(env.version);
      })
      .catch((e) => {
        if (live) setError(messageOf(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [path, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const save = useCallback(
    async (next: RulesDoc) => {
      const env = await putRulesEnvelope(path, next, version);
      setDoc(normalize(env.rules));
      setVersion(env.version);
    },
    [path, version],
  );

  return { doc, version, loading, error, reload, save };
}

/** Org-scoped shorthand for {@link useRulesDoc}. */
export function useOrgRules(): OrgRulesState {
  return useRulesDoc(ORG_RULES_PATH);
}

function messageOf(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again.";
    if (e.status === 403) return "You don't have access to tracking rules.";
    return e.message;
  }
  return "Couldn't load tracking rules. Check your connection and retry.";
}
