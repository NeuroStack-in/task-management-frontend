"use client";

import { useEffect, useState } from "react";
import { getOrg } from "@/modules/settings/services/org.service";
import { useAuthStore } from "@/stores/auth.store";

/**
 * The signed-in org's display name (`GET /v1/org`), for chrome like the sidebar header.
 *
 * Cached at module scope **keyed by tenant** so it's fetched once per session but never leaks across
 * a user/org switch — a different tenant re-fetches rather than showing the previous org's name
 * (consistent with the "same data across logins" stance). Returns `null` until it loads (or if the
 * caller has no session yet), so the header degrades to just the product name.
 */
let cache: { tenant: string; name: string; slug: string } | null = null;

export function useOrgName(): string | null {
  const tenant = useAuthStore((s) => s.user?.organizationId ?? null);
  const [name, setName] = useState<string | null>(
    cache && cache.tenant === tenant ? cache.name : null,
  );

  useEffect(() => {
    if (!tenant) return;
    if (cache && cache.tenant === tenant) {
      setName(cache.name);
      return;
    }
    let live = true;
    getOrg()
      .then((o) => {
        if (!live) return;
        cache = { tenant, name: o.name, slug: o.slug };
        setName(o.name);
      })
      .catch(() => {
        // A missing org name just leaves the header as the product name — not worth surfacing.
      });
    return () => {
      live = false;
    };
  }, [tenant]);

  return name;
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
  const tenant = useAuthStore((s) => s.user?.organizationId ?? null);
  const [slug, setSlug] = useState<string | null>(
    cache && cache.tenant === tenant ? cache.slug : null,
  );

  useEffect(() => {
    if (!tenant) return;
    if (cache && cache.tenant === tenant) {
      setSlug(cache.slug);
      return;
    }
    let live = true;
    getOrg()
      .then((o) => {
        if (!live) return;
        cache = { tenant, name: o.name, slug: o.slug };
        setSlug(o.slug);
      })
      .catch(() => {
        // Falls back to the dialog's plain prompt; the server still validates what is typed.
      });
    return () => {
      live = false;
    };
  }, [tenant]);

  return slug;
}
