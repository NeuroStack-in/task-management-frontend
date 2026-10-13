"use client";

import { useEffect, useState } from "react";
import { getOrg, type OrgView } from "@/modules/settings/services/org.service";
import { useAuthStore } from "@/stores/auth.store";

/**
 * Cached at module scope **keyed by tenant** so `GET /v1/org` is fetched once per session but never
 * leaks across a user/org switch — a different tenant re-fetches rather than showing the previous
 * org's name (consistent with the "same data across logins" stance). One read serves all three hooks
 * below, and every mounted hook follows {@link updateOrgCache}.
 */
interface OrgCache {
  tenant: string;
  name: string;
  slug: string;
  currency: string | null;
}
let cache: OrgCache | null = null;
const listeners = new Set<() => void>();

function remember(tenant: string, o: OrgView): void {
  cache = { tenant, name: o.name, slug: o.slug, currency: o.currency ?? null };
  listeners.forEach((notify) => notify());
}

/**
 * Put a fresh org view (from a successful `PATCH /v1/org`) into the cache. Nothing invalidated it,
 * so a rename showed "Changes are live" while the sidebar header and the Company rail item kept the
 * old name until a full reload (QA audit 2026-10-08, WP-534).
 */
export function updateOrgCache(o: OrgView): void {
  const tenant = useAuthStore.getState().user?.organizationId;
  if (tenant) remember(tenant, o);
}

/** One field of the cached org for the signed-in tenant; `null` until it loads (or when it fails). */
function useOrgField<K extends "name" | "slug" | "currency">(key: K): OrgCache[K] | null {
  const tenant = useAuthStore((s) => s.user?.organizationId ?? null);
  const [value, setValue] = useState<OrgCache[K] | null>(
    cache && cache.tenant === tenant ? cache[key] : null,
  );

  useEffect(() => {
    if (!tenant) return;
    const sync = () => {
      if (cache && cache.tenant === tenant) setValue(cache[key]);
    };
    listeners.add(sync);
    if (cache && cache.tenant === tenant) sync();
    else {
      getOrg()
        .then((o) => remember(tenant, o))
        .catch(() => {
          // Each caller degrades on its own: the header to the product name, the slug dialog to
          // its plain prompt (the server still validates what is typed), money to the default
          // currency. Not worth surfacing.
        });
    }
    return () => {
      listeners.delete(sync);
    };
  }, [tenant, key]);

  return value;
}

/**
 * The signed-in org's display name (`GET /v1/org`), for chrome like the sidebar header. Returns
 * `null` until it loads (or if the caller has no session yet), so the header degrades to just the
 * product name.
 */
export function useOrgName(): string | null {
  return useOrgField("name");
}

/**
 * The org's **workspace slug** (`GET /v1/org`) — the string the destructive confirmations ask the
 * owner to re-type.
 *
 * It exists because those dialogs demanded something the product never showed anywhere. The slug is
 * not the org's name and not guessable from it: `provision_my_org` builds it as
 * `<name>-<last 6 of the tenant id>`, so an owner asked to "type your workspace slug" had no way to
 * learn it and simply could not close or export their organization.
 *
 * Shares the same tenant-keyed cache as {@link useOrgName} — one `GET /v1/org` serves both.
 */
export function useOrgSlug(): string | null {
  return useOrgField("slug");
}

/**
 * The org's currency (ISO 4217, from `GET /v1/org`), for formatting money in it — `null` until it
 * loads or when the org never set one (callers then fall back to the formatter's default).
 *
 * Shares the tenant-keyed cache with {@link useOrgName} — one `GET /v1/org` serves all three.
 */
export function useOrgCurrency(): string | null {
  return useOrgField("currency");
}
