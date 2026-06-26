# PLAN — Header search → global ⌘K command palette

## What the header search does today

The search box in the top bar ([src/components/layout/top-navbar.tsx](../src/components/layout/top-navbar.tsx)) is a **non-functional placeholder**:

- It's a plain `<button>` showing "Search people, projects, reports…" plus a `⌘K` badge.
- It has **no `onClick`**, and there is **no global keyboard listener** anywhere in `src/` (the only `keydown` handler in the codebase is the Escape-to-close in `date-picker.tsx`).

So clicking it or pressing ⌘K does nothing — the `⌘K` hint is purely cosmetic scaffolding for a planned feature. (Phase 1 is frontend-only, and several surfaces are intentionally navigable-but-stubbed.)

## Goal

Make it a real **global command palette** (open with ⌘K or by clicking the search) that lets you fuzzy-search and jump to **people, projects, and pages**, and run **quick actions** (start timer, switch theme/palette). Results are **permission-filtered** — users only ever see what their role can access.

No new dependencies (no `cmdk`); reuse the existing `Dialog`, data accessors, nav constants, and `usePermissions`.

## Result model

A single `useMemo`, keyed on the query, builds a flat ordered list (grouped for display). Each group is gated by `usePermissions().can(...)`:

| Group | Source | Filter | Activates |
|---|---|---|---|
| **Actions** | static list | by label | run handler |
| **Pages** | `usePermissions().nav` + `INSIGHTS_TABS` + `ADMIN_SECTIONS` (each permission-filtered) | label / description | `router.push(href)` |
| **People** (needs `employees:view`) | `users` ([src/lib/data.ts](../src/lib/data.ts)) | `name/email/jobTitle/department` | `/employees/{id}` |
| **Projects** (needs `projects:view`) | `projects` ([src/lib/data.ts](../src/lib/data.ts)) | `name/key/id` | `/projects/{id}` |

Quick **Actions**: `Start timer` (or `Stop timer` when running, via `useTimerStore`), `Theme: Light` / `Theme: Dark` (`next-themes` `setTheme`), `Switch palette` (palette store used by `palette-switcher.tsx`).

With an empty query, show Actions + a short list of common Pages so the palette is useful before typing.

## Interaction

- **Open/close**: a global `keydown` listener toggles on `(metaKey || ctrlKey) && key === "k"` with `preventDefault()`. The navbar button calls `setCommandOpen(true)`. `Dialog` handles Escape/overlay-close.
- **Keyboard nav**: an `activeIndex` over the visible results; `↑/↓` move (wrapping), hover sets active, `Enter` activates, then close + clear query.
- **Empty state** when nothing matches.

## Styling

Reuse `Dialog`, top-aligned (override the centered `DialogContent` via `className`, e.g. `top-[12vh] translate-y-0 max-w-xl p-0`, `showCloseButton={false}`). Header = borderless `Input` with a leading `Search` icon; body = `ScrollArea` of grouped rows (uppercase muted group eyebrow; row = icon + label + muted sub; active row `bg-accent`); footer hint = `↑↓ navigate · ↵ select · esc close`. All WorkPulse tokens — consistent with the calendar/time-picker popovers.

## Files

- **New** `src/components/layout/command-palette.tsx` — palette UI, global ⌘K listener, grouped results, keyboard nav, routing + action handlers (`"use client"`).
- **Modify** `src/stores/ui.store.ts` — add `commandOpen` / `setCommandOpen` / `toggleCommand` (mirrors the existing `sidebarCollapsed` slice) so navbar, listener, and palette share state.
- **Modify** `src/components/layout/top-navbar.tsx` — wire the search button `onClick` to `setCommandOpen(true)` (keep its look).
- **Modify** `src/components/layout/dashboard-shell.tsx` — mount `<CommandPalette />` once (next to `<ChatBot />`) so it's on every authenticated route.

## Reuse (don't re-implement)

- Permissions: `usePermissions()` (`.can`, `.nav`), `isNavItemVisible` — [src/hooks/use-permissions.ts](../src/hooks/use-permissions.ts), [src/lib/rbac.ts](../src/lib/rbac.ts).
- Destinations: `NAV_GROUPS`, `INSIGHTS_TABS`, `ADMIN_SECTIONS` — [src/constants/navigation.ts](../src/constants/navigation.ts).
- Actions: `useTimerStore` ([global-timer.tsx](../src/components/layout/global-timer.tsx)), `useTheme` ([theme-switcher.tsx](../src/components/layout/theme-switcher.tsx)), palette store (`palette-switcher.tsx`).
- Search idiom: `query.trim().toLowerCase().includes(...)` + `useMemo` from `employees-view.tsx` / `projects-view.tsx`.
- UI: `Dialog`, `Input`, `ScrollArea`, `Avatar` from `src/components/ui/`.

## Verification

1. `npm run dev`; log in as `owner@acme.test` (wildcard role).
2. **⌘K / Ctrl+K** opens the palette; clicking the navbar search also opens it; **Esc** closes.
3. `al` → **Alex Morgan** (People); `acme` → project (Projects); `rep` → **Reports** (Pages); `tim` → **Start timer** (Actions) + Time Tracking.
4. `↑/↓` move selection; `Enter` routes/runs (person → `/employees/[id]`, project → `/projects/[id]`, page → href, Start timer → navbar timer begins, Theme → toggles).
5. Permission check: a role without `employees:view` / `projects:view` no longer shows those groups.
6. `npm run build` (lint + typecheck) clean; no console errors (Playwright screenshot harness).
