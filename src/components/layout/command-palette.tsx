"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  FolderKanban,
  Moon,
  Palette,
  Search,
  Square,
  Sun,
  Timer as TimerIcon,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUiStore } from "@/stores/ui.store";
import { useTimerStore } from "@/stores/timer.store";
import { usePermissions } from "@/hooks/use-permissions";
import { isNavItemVisible } from "@/lib/rbac";
import {
  ACCOUNT_SECTIONS,
  ADMIN_SECTIONS,
  INSIGHTS_TABS,
} from "@/constants/navigation";
import { users, projects } from "@/lib/data";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PALETTES, applyPalette } from "./palette-switcher";

interface Result {
  id: string;
  label: string;
  sub?: string;
  group: string;
  icon?: LucideIcon;
  avatarUrl?: string;
  run: () => void;
}

const MAX_PEOPLE = 6;
const MAX_PROJECTS = 6;
const MAX_PAGES_EMPTY = 6;

export function CommandPalette() {
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const toggle = useUiStore((s) => s.toggleCommand);

  const router = useRouter();
  const { can, role, nav } = usePermissions();
  const { setTheme } = useTheme();

  const timerTask = useTimerStore((s) => s.task);
  const timerStatus = useTimerStore((s) => s.status);
  const startTimer = useTimerStore((s) => s.start);
  const stopTimer = useTimerStore((s) => s.stop);

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Global ⌘K / Ctrl+K toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggle]);

  // Reset on each open.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const close = () => setOpen(false);
  const go = (href: string) => {
    router.push(href);
    close();
  };

  const cyclePalette = () => {
    const cur = document.documentElement.getAttribute("data-palette") ?? "indigo";
    const idx = PALETTES.findIndex((p) => p.id === cur);
    const next = PALETTES[(idx + 1) % PALETTES.length];
    applyPalette(next.id);
    toast.success(`Palette: ${next.name}`);
  };

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    const out: Result[] = [];

    // ── Actions ──
    const running = timerTask && timerStatus === "running";
    const actions: Result[] = [
      running
        ? {
            id: "a-stop",
            label: "Stop timer",
            sub: timerTask?.taskTitle,
            group: "Actions",
            icon: Square,
            run: () => {
              stopTimer();
              toast.success("Timer stopped");
              close();
            },
          }
        : {
            id: "a-start",
            label: "Start timer",
            group: "Actions",
            icon: TimerIcon,
            run: () => {
              startTimer({ taskId: "demo-task", taskTitle: "Focus session" });
              toast.success("Timer started");
              close();
            },
          },
      {
        id: "a-light",
        label: "Theme: Light",
        group: "Actions",
        icon: Sun,
        run: () => {
          setTheme("light");
          close();
        },
      },
      {
        id: "a-dark",
        label: "Theme: Dark",
        group: "Actions",
        icon: Moon,
        run: () => {
          setTheme("dark");
          close();
        },
      },
      {
        id: "a-palette",
        label: "Switch colour palette",
        group: "Actions",
        icon: Palette,
        run: () => {
          cyclePalette();
          close();
        },
      },
    ];
    out.push(...actions.filter((a) => q === "" || a.label.toLowerCase().includes(q)));

    // ── People (query only) ──
    if (q !== "" && can("employees:view")) {
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
            run: () => go(`/employees/${u.id}`),
          })),
      );
    }

    // ── Projects (query only) ──
    if (q !== "" && can("projects:view")) {
      out.push(
        ...projects
          .filter((p) =>
            `${p.name} ${p.key} ${p.id}`.toLowerCase().includes(q),
          )
          .slice(0, MAX_PROJECTS)
          .map<Result>((p) => ({
            id: `p-${p.id}`,
            label: p.name,
            sub: `${p.key} · ${p.status}`,
            group: "Projects",
            icon: FolderKanban,
            run: () => go(`/projects/${p.id}`),
          })),
      );
    }

    // ── Pages ──
    const pages = [
      ...nav.flatMap((g) =>
        g.items.map((it) => ({ item: it, group: g.label })),
      ),
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
    ];
    const seen = new Set<string>();
    let pageResults = pages
      .filter(({ item }) => {
        if (seen.has(item.href)) return false;
        seen.add(item.href);
        return true;
      })
      .filter(({ item, group }) =>
        q === ""
          ? true
          : `${item.label} ${group} ${item.description ?? ""} ${item.keywords ?? ""}`
              .toLowerCase()
              .includes(q),
      )
      .map<Result>(({ item, group }) => ({
        id: `nav-${item.href}`,
        label: item.label,
        sub: item.description,
        group,
        icon: item.icon,
        run: () => go(item.href),
      }));
    if (q === "") pageResults = pageResults.slice(0, MAX_PAGES_EMPTY);
    out.push(...pageResults);

    return out;
    // close/go/cyclePalette are stable enough for this derived list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, role, nav, can, timerTask, timerStatus]);

  // Keep the active index valid as results change.
  useEffect(() => {
    setActive(0);
  }, [query]);
  const activeIdx = results.length ? Math.min(active, results.length - 1) : 0;

  // Scroll the active row into view.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-cmd="${activeIdx}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      results[activeIdx]?.run();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="top-[12vh] flex translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>

        {/* Search */}
        <div className="flex items-center gap-2.5 border-b px-3.5">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search people, projects, pages, actions…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {/* Results */}
        <ScrollArea className="max-h-[min(60vh,420px)]">
          <div ref={listRef} className="p-1.5">
            {results.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                No results for “{query}”.
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
                      data-cmd={i}
                      onMouseMove={() => setActive(i)}
                      onClick={() => r.run()}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
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
        </ScrollArea>

        {/* Footer hint */}
        <div className="flex items-center gap-4 border-t px-3.5 py-2 text-[11px] text-muted-foreground">
          <span>
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> navigate
          </span>
          <span>
            <Kbd>↵</Kbd> select
          </span>
          <span>
            <Kbd>esc</Kbd> close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mr-1 inline-flex min-w-4 items-center justify-center rounded border bg-muted px-1 font-sans text-[10px]">
      {children}
    </kbd>
  );
}
