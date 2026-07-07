"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, Search, X, type LucideIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePermissions } from "@/hooks/use-permissions";
import { useIsSelfScoped } from "@/hooks/use-self-scope";
import { useAuthStore } from "@/stores/auth.store";
import { useUiStore } from "@/stores/ui.store";
import { isNavItemVisible } from "@/lib/rbac";
import {
  INSIGHTS_TABS,
  ADMIN_SECTIONS,
  ACCOUNT_SECTIONS,
  SETTINGS_SUBSECTIONS,
} from "@/constants/navigation";
import { users, projects } from "@/lib/data";
import { initials } from "@/lib/format";
import { scrollToHashAfterNav } from "@/lib/scroll-to-hash";
import { cn } from "@/lib/utils";

interface Result {
  id: string;
  label: string;
  sub?: string;
  group: string;
  icon?: LucideIcon;
  avatarUrl?: string;
  href: string;
}

const MAX_PEOPLE = 5;
const MAX_PROJECTS = 5;
const MAX_PAGES = 6;

/**
 * Inline global search for the sidebar. Type to get live suggestions (people,
 * projects, pages) in a dropdown right under the field — no modal. Keyboard:
 * ↑/↓ to move, ↵ to open, esc to clear.
 */
export function SidebarSearch({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const { can, role, nav } = usePermissions();
  // Self-scoped roles (Employee) only see projects they're a member of — mirror
  // the Projects page so search doesn't surface projects they can't open.
  const selfScoped = useIsSelfScoped();
  const userId = useAuthStore((s) => s.user?.id);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: Result[] = [];

    if (can("employees:view")) {
      out.push(
        ...users
          .filter((u) =>
            `${u.name} ${u.email} ${u.jobTitle} ${u.department}`
              .toLowerCase()
              .includes(q),
          )
          .slice(0, MAX_PEOPLE)
          .map<Result>((u) => ({
            id: `u-${u.id}`,
            label: u.name,
            sub: `${u.jobTitle} · ${u.department}`,
            group: "People",
            avatarUrl: u.avatarUrl,
            href: `/employees/${u.id}`,
          })),
      );
    }

    if (can("projects:view")) {
      out.push(
        ...projects
          .filter(
            (p) =>
              (!selfScoped || (!!userId && p.memberIds.includes(userId))) &&
              `${p.name} ${p.key} ${p.id}`.toLowerCase().includes(q),
          )
          .slice(0, MAX_PROJECTS)
          .map<Result>((p) => ({
            id: `p-${p.id}`,
            label: p.name,
            sub: `${p.key} · ${p.status}`,
            group: "Projects",
            icon: FolderKanban,
            href: `/projects/${p.id}`,
          })),
      );
    }

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
    out.push(
      ...pages
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
        })),
    );

    return out;
  }, [query, can, role, nav, selfScoped, userId]);

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
          placeholder="Search…"
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
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No results for “{query.trim()}”.
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
                    {r.avatarUrl !== undefined ? (
                      <Avatar className="size-7 shrink-0">
                        <AvatarImage src={r.avatarUrl} alt={r.label} />
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
