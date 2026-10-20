"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban, Search, X, type LucideIcon } from "lucide-react";
import { UserAvatar } from "@/components/shared/user-avatar";
import { usePermissions } from "@/hooks/use-permissions";
import { useUiStore } from "@/stores/ui.store";
import { useUnsavedStore } from "@/stores/unsaved.store";
import { isNavItemVisible } from "@/lib/rbac";
import { useIsFeatureOn, useIsPageOn, useTrackingMode } from "@/hooks/use-features";
import { isPathModeHidden } from "@/constants/features";
import { INSIGHTS_TABS, ADMIN_SECTIONS, ACCOUNT_SECTIONS, SETTINGS_SUBSECTIONS } from "@/constants/navigation";
import { searchAll, type SearchHit, type SearchResults } from "@/lib/search";

import { scrollToHashAfterNav } from "@/lib/scroll-to-hash";
import { cn } from "@/lib/utils";

interface Result {
  id: string;
  label: string;
  sub?: string;
  group: string;
  icon?: LucideIcon;
  /** Present (even if undefined) on people rows so they render an avatar rather than an icon. */
  isPerson?: boolean;
  /** Set with `isPerson`, so the result can show their photo rather than initials. */
  personId?: string;
  href: string;
}

const EMPTY_REMOTE: SearchResults = { employees: [], projects: [], tasks: [] };

const MAX_PEOPLE = 5;
const MAX_PROJECTS = 5;
const MAX_PAGES = 6;

const LIST_ID = "sidebar-search-results";
const optionId = (i: number) => `sidebar-search-option-${i}`;

/**
 * The last focus request (`searchFocusNonce`) any SidebarSearch acted on. Module-level, so a remount
 * doesn't act on it again: the collapsed and expanded rails are separate subtrees, and every
 * collapse→expand remounted this input with the old counter still above 0 — so once the rail's
 * Search button had been used, the box stole focus on every later expand (QA audit 2026-10-08,
 * WP-540).
 */
let focusHandled = 0;

/**
 * Could a previous answer's hit still be right for what's typed now? People are matched on a name
 * prefix and projects on a name *substring* server-side, so "contains every typed word" is the loose
 * test that never drops a hit the server would return — the server's answer replaces it anyway.
 */
function matchesWords(label: string, q: string): boolean {
  const l = label.toLowerCase();
  return q.split(/\s+/).every((t) => l.includes(t));
}

/** True when focus is somewhere typing happens — a bare "/" there is a character, not a shortcut. */
export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Inline global search for the sidebar. Type to get live suggestions (people,
 * projects, pages) in a dropdown right under the field — no modal. Keyboard:
 * ↑/↓ to move, ↵ to open, esc to clear. ⌘K / Ctrl+K or "/" anywhere focuses it, and on a phone
 * the top bar's search button opens the menu straight onto it (`top-navbar.tsx`, UX audit SHELL-11).
 */
export function SidebarSearch({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const { can, role, nav } = usePermissions();
  const isFeatureOn = useIsFeatureOn();
  const mode = useTrackingMode();
  // Page-visibility toggles too: a page the org hid was still offered here — and people results
  // linked into a hidden Employees page — each leading to "This page is turned off"
  // (QA audit 2026-10-08, WP-326). Owners are exempt inside `isPageOn`.
  const isPageOn = useIsPageOn();
  const hideHref = useCallback(
    (href: string) => isPathModeHidden(href, mode) || !isPageOn(href),
    [mode, isPageOn],
  );

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // People + projects come from the real backend (`GET /v1/search`, name-matched, perm-gated
  // server-side). Pages stay client-side (they're the static nav tree). Debounced so a type-ahead
  // doesn't fire a request per keystroke. Kept **with the query it answered**: the previous query's
  // people used to sit under a new query until its response arrived, and Enter opened one of them —
  // type "anna", then "bob" + Enter, and Anna's profile opened (WP-365).
  const [remote, setRemote] = useState<{ q: string; r: SearchResults }>({
    q: "",
    r: EMPTY_REMOTE,
  });
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Only the server can return people/projects, so skip the round-trip entirely for callers who
  // can see neither — they still get page results.
  const canPeople = can("employees:view") && !hideHref("/employees");
  const canProjects = can("projects:view") && !hideHref("/projects");
  const canSearchRemote = can("employees:view") || can("projects:view");
  // Says what this box can actually find, for this caller — "Search…" said nothing (SHELL-11).
  // Short enough to fit the 240 px rail (the magnifier already says "search"); the full sentence is
  // the accessible name.
  const finds =
    canPeople && canProjects
      ? ["People, projects, pages", "people, projects and pages"]
      : canPeople
        ? ["People and pages", "people and pages"]
        : canProjects
          ? ["Projects and pages", "projects and pages"]
          : ["Search pages", "pages"];

  // The shortcut, in this platform's notation, for the field's tooltip. Resolved after mount so the
  // server render and the first client render agree.
  const [shortcut, setShortcut] = useState("Ctrl+K");
  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) setShortcut("⌘K");
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q || !canSearchRemote) {
      setRemote({ q: "", r: EMPTY_REMOTE });
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      searchAll(q).then((r) => {
        if (live) setRemote({ q, r });
      });
    }, 180);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [query, canSearchRemote]);

  // Focus the field when the collapsed rail's search button asks for it (after it expands the
  // sidebar) — once per request, however many times this input mounts (see `focusHandled`).
  const searchFocusNonce = useUiStore((s) => s.searchFocusNonce);
  useEffect(() => {
    if (searchFocusNonce > focusHandled) {
      focusHandled = searchFocusNonce;
      inputRef.current?.focus();
    }
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

    // People + projects are already matched and permission-scoped by the server; render them
    // straight through (the server's shape is `{ id, label }` only — no title/department/avatar).
    // Until the answer for *this* query arrives, only the previous answer's hits that still match
    // what's typed are shown — never one that doesn't.
    const current = remote.q.toLowerCase() === q;
    const hits = (list: SearchHit[]) =>
      current ? list : list.filter((h) => matchesWords(h.label, q));
    if (can("employees:view") && !hideHref("/employees")) {
      out.push(
        ...hits(remote.r.employees).slice(0, MAX_PEOPLE).map<Result>((h) => ({
          id: `u-${h.id}`,
          label: h.label,
          group: "People",
          isPerson: true,
          personId: h.id,
          href: `/employees/${h.id}`,
        })),
      );
    }

    // Projects are hidden entirely in machine mode — don't surface their deep-links either.
    if (can("projects:view") && !hideHref("/projects")) {
      out.push(
        ...hits(remote.r.projects).slice(0, MAX_PROJECTS).map<Result>((h) => ({
          id: `p-${h.id}`,
          label: h.label,
          group: "Projects",
          icon: FolderKanban,
          href: `/projects/${h.id}`,
        })),
      );
    }

    const pages = [
      ...nav.flatMap((g) => g.items.map((it) => ({ item: it, group: g.label }))),
      ...INSIGHTS_TABS.filter(
        (t) => can(t.permission) && isNavItemVisible(role, t, isFeatureOn, hideHref),
      ).map((it) => ({
        item: it,
        group: "Analytics",
      })),
      ...ADMIN_SECTIONS.flatMap((g) =>
        g.items
          .filter((it) => isNavItemVisible(role, it, isFeatureOn, hideHref))
          .map((it) => ({ item: it, group: g.label })),
      ),
      // Personal account settings — all `permission: null` today, but filtered anyway so a
      // permissioned entry added later can never leak into every user's search results.
      ...ACCOUNT_SECTIONS.filter((it) => isNavItemVisible(role, it, isFeatureOn, hideHref)).map((it) => ({
        item: it,
        group: "Account",
      })),
      // Deep-link sub-sections within a settings page (e.g. Security → MFA).
      ...SETTINGS_SUBSECTIONS.filter((it) => isNavItemVisible(role, it, isFeatureOn, hideHref)).map(
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
        .filter(({ item, group }) => {
          // Token-AND match: every word of the query must appear somewhere in the haystack, in any
          // order — "download agent" finds "Device agents" via its keywords, where whole-phrase
          // `includes()` found nothing unless the exact phrase existed contiguously.
          const hay =
            `${item.label} ${group} ${item.description ?? ""} ${item.keywords ?? ""}`.toLowerCase();
          return q.split(/\s+/).every((token) => hay.includes(token));
        })
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
    // `isFeatureOn` belongs here: it changes identity when entitlements land, and without it the
    // results stay computed against the fail-open default — search would keep offering sections the
    // org has switched off.
  }, [query, can, role, nav, remote, isFeatureOn, hideHref]);

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
    // Unsaved settings edits ask first; the settings layout navigates once the user confirms
    // (QA audit 2026-10-08, WP-347).
    if (useUnsavedStore.getState().requestLeave(href)) {
      router.push(href);
      scrollToHashAfterNav(href);
    }
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
  /**
   * The server's answer for exactly what's typed hasn't arrived. "No results" used to flash for the
   * debounce + round trip on every keystroke, then flip to a list (SHELL-11) — so until it lands an
   * empty list reads "Searching…", and a list of page hits says more may follow.
   */
  const trimmed = query.trim();
  const searching =
    canSearchRemote && trimmed.length > 0 && remote.q.toLowerCase() !== trimmed.toLowerCase();
  const remoteNoun = canPeople && canProjects ? "people and projects" : canPeople ? "people" : "projects";
  const status = !showPanel
    ? ""
    : results.length === 0
      ? searching
        ? "Searching…"
        : `No results for “${trimmed}”.`
      : `${results.length} ${results.length === 1 ? "result" : "results"}${searching ? `, still searching ${remoteNoun}` : ""}.`;

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-2.5 rounded-full border border-sidebar-border bg-sidebar-accent/40 px-3.5 transition-colors focus-within:border-primary/40">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        {/* A combobox over the results listbox, so arrowing through them is announced — the
            selection used to be a background colour only (QA audit 2026-10-08, WP-546). */}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => query.trim() && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={finds[0]}
          aria-label={`Search ${finds[1]}`}
          title={`Search ${finds[1]} (${shortcut} or /)`}
          aria-keyshortcuts="Control+K Meta+K /"
          data-search-input=""
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showPanel}
          aria-controls={showPanel ? LIST_ID : undefined}
          aria-activedescendant={
            showPanel && results.length > 0 ? optionId(activeIdx) : undefined
          }
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

      {/* Announces the state the list can't: searching, how many, or none. */}
      <p role="status" className="sr-only">
        {status}
      </p>

      {showPanel ? (
        <div
          ref={listRef}
          id={LIST_ID}
          role="listbox"
          aria-label="Search results"
          className="absolute inset-x-0 top-full z-50 mt-2 max-h-[24rem] overflow-y-auto rounded-2xl border border-border bg-popover p-1.5 shadow-soft"
        >
          {results.length === 0 ? (
            <p role="presentation" className="px-3 py-6 text-center text-sm text-muted-foreground">
              {searching ? "Searching…" : `No results for “${trimmed}”.`}
            </p>
          ) : (
            results.map((r, i) => {
              const prev = results[i - 1];
              const showHeader = !prev || prev.group !== r.group;
              const Icon = r.icon;
              return (
                <div key={r.id} role="presentation">
                  {showHeader ? (
                    <p
                      role="presentation"
                      className="px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground first:pt-1"
                    >
                      {r.group}
                    </p>
                  ) : null}
                  {/* An option, not a tab stop: focus stays in the input and moves through the
                      list by `aria-activedescendant`. The group rides in the name, since the
                      header above it is presentational. */}
                  <button
                    type="button"
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === activeIdx}
                    aria-label={`${r.label}, ${r.group}`}
                    tabIndex={-1}
                    data-row={i}
                    onMouseMove={() => setActive(i)}
                    onClick={() => select(r.href)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                      i === activeIdx ? "bg-accent" : "hover:bg-muted/60",
                    )}
                  >
                    {r.isPerson ? (
                      <UserAvatar
                        userId={r.personId ?? ""}
                        name={r.label}
                        className="size-7 shrink-0"
                        fallbackClassName="text-[10px]"
                      />
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
          {results.length > 0 && searching ? (
            <p role="presentation" className="text-muted-foreground px-2.5 pt-2 pb-1 text-xs">
              Searching {remoteNoun}…
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
