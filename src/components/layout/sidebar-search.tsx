"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, Search, X, type LucideIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { usePermissions } from "@/hooks/use-permissions";
import { useUiStore } from "@/stores/ui.store";
import { isNavItemVisible } from "@/lib/rbac";
import {
  INSIGHTS_TABS,
  ADMIN_SECTIONS,
  ACCOUNT_SECTIONS,
  SETTINGS_SUBSECTIONS,
} from "@/constants/navigation";
import { useGlobalSearch } from "@/modules/search/use-global-search";
import { initials } from "@/lib/format";
import { scrollToHashAfterNav } from "@/lib/scroll-to-hash";
import { cn } from "@/lib/utils";

interface Result {
  id: string;
  label: string;
  sub?: string;
  group: string;
  icon?: LucideIcon;
  /** Present (even if empty) for a person — drives the avatar vs icon branch. */
  avatar?: boolean;
  href: string;
}

const MAX_PAGES = 6;

/**
 * Inline global search for the sidebar. Type to get live suggestions in a dropdown right under the
 * field — no modal. Keyboard: ↑/↓ to move, ↵ to open, esc to clear.
 *
 * Two different sources, deliberately:
 * - **Pages** are matched locally against the nav constants. They're a static client-side catalog,
 *   already permission-filtered by `usePermissions`, so there's nothing to fetch.
 * - **Records** come from `GET /v1/search?q=` via {@link useGlobalSearch} — debounced, stale
 *   responses aborted. The server is the permission gate (it drops hits the caller may not read),
 *   so this component doesn't pre-filter records by role.
 *
 * Honesty notes: server matching is **prefix-only** over the employee name, so "smith" won't find
 * "John Smith" — the placeholder says "starts with" rather than promising general search. A record
 * hit is only `{id, label}`; job title, department and avatar image aren't on the search index, so
 * people rows show initials and no subtitle rather than invented detail. The server's `projects`
 * and `tasks` buckets are always empty until Dev A's GSI1 lands, so those groups simply never
 * render — no empty "Projects" heading implying they're searchable today.
 */
export function SidebarSearch({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const { can, role, nav } = usePermissions();

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, loading, error } = useGlobalSearch(query);

  // Focus the field when the collapsed rail's search button asks for it (after
  // it expands the sidebar). Skips the initial mount (nonce starts at 0).
  const searchFocusNonce = useUiStore((s) => s.searchFocusNonce);
  useEffect(() => {
    if (searchFocusNonce > 0) inputRef.current?.focus();
  }, [searchFocusNonce]);

  // Close the suggestions when clicking outside the search.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  /** Local nav-page matches — a static catalog, so no request. */
  const pageResults = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const pages = [
      ...nav.flatMap((g) => g.items.map((it) => ({ item: it, group: g.label }))),
      ...INSIGHTS_TABS.filter((t) => can(t.permission)).map((it) => ({
        item: it,
        group: "Analytics",
      })),
      ...ADMIN_SECTIONS.flatMap((g) =>
        g.items
          .filter((it) => isNavItemVisible(role, it))
          .map((it) => ({ item: it, group: g.label })),
      ),
      // Personal account settings — always accessible, so no permission filter.
      ...ACCOUNT_SECTIONS.map((it) => ({ item: it, group: "Account" })),
      // Deep-link sub-sections within a settings page (e.g. Security → MFA).
      ...SETTINGS_SUBSECTIONS.filter((it) => isNavItemVisible(role, it)).map(
        (it) => ({ item: it, group: "Settings" }),
      ),
    ];
    const seen = new Set<string>();
    return pages
      .filter(({ item }) => {
        if (seen.has(item.href)) return false;
        seen.add(item.href);
        return true;
      })
      .filter(({ item, group }) =>
        `${item.label} ${group} ${item.description ?? ""} ${item.keywords ?? ""}`
          .toLowerCase()
          .includes(q),
      )
      .slice(0, MAX_PAGES)
      .map<Result>(({ item, group }) => ({
        id: `nav-${item.href}`,
        label: item.label,
        sub: item.description,
        group,
        icon: item.icon,
        href: item.href,
      }));
  }, [query, can, role, nav]);

  /**
   * Server hits. Both buckets are rendered generically — `projects` is empty today, so the group
   * just doesn't appear; it will light up unchanged once the backend can fill it. `tasks` is skipped
   * entirely: a hit is only `{id, label}`, and a task isn't addressable without its project.
   */
  const remoteResults = useMemo<Result[]>(() => {
    if (!data) return [];
    return [
      ...data.employees.map<Result>((h) => ({
        id: `u-${h.id}`,
        label: h.label,
        group: "People",
        avatar: true,
        href: `/employees/${h.id}`,
      })),
      ...data.projects.map<Result>((h) => ({
        id: `p-${h.id}`,
        label: h.label,
        group: "Projects",
        icon: FolderKanban,
        href: `/projects/${h.id}`,
      })),
    ];
  }, [data]);

  const results = useMemo<Result[]>(
    () => [...remoteResults, ...pageResults],
    [remoteResults, pageResults],
  );

  const activeIdx = results.length ? Math.min(active, results.length - 1) : 0;

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-row="${activeIdx}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const select = (href: string) => {
    router.push(href);
    scrollToHashAfterNav(href);
    setQuery("");
    setOpen(false);
    onNavigate?.();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setQuery("");
      setOpen(false);
      return;
    }
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[activeIdx];
      if (r) select(r.href);
    }
  };

  const showPanel = open && query.trim().length > 0;
  // Only claim "no results" once the in-flight lookup has settled.
  const settled = !loading;

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-2.5 rounded-full border border-sidebar-border bg-sidebar-accent/40 px-3.5 transition-colors focus-within:border-primary/40">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => query.trim() && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search name or page…"
          aria-label="Search"
          className="h-9 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {showPanel ? (
        <div
          ref={listRef}
          className="absolute inset-x-0 top-full z-50 mt-2 max-h-[24rem] overflow-y-auto rounded-2xl border border-border bg-popover p-1.5 shadow-soft"
        >
          {error && results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {error}
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {settled
                ? `No matches starting with “${query.trim()}”.`
                : "Searching…"}
            </p>
          ) : (
            results.map((r, i) => {
              const prev = results[i - 1];
              const showHeader = !prev || prev.group !== r.group;
              const Icon = r.icon;
              return (
                <div key={r.id}>
                  {showHeader ? (
                    <p className="px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground first:pt-1">
                      {r.group}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    data-row={i}
                    onMouseMove={() => setActive(i)}
                    onClick={() => select(r.href)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                      i === activeIdx ? "bg-accent" : "hover:bg-muted/60",
                    )}
                  >
                    {r.avatar ? (
                      <Avatar className="size-7 shrink-0">
                        <AvatarFallback className="text-[10px]">
                          {initials(r.label)}
                        </AvatarFallback>
                      </Avatar>
                    ) : Icon ? (
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-feature-tint text-primary">
                        <Icon className="size-4" />
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {r.label}
                      </span>
                      {r.sub ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {r.sub}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
