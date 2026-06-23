# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**WorkPulse** — a Workforce Activity & Productivity Management Platform (SaaS). **Phase 1 is frontend-only**: every feature runs on mock data, static JSON, and simulated workflows. There is no backend, no real monitoring, and no payments.

**Design:** WorkPulse has its own original visual identity (see [Docs/DESIGN.md](Docs/DESIGN.md)). Do not model the UI/layout/aesthetic on any other product.

The planning docs are canonical and live in [Docs/](Docs/):
- **[Docs/SPEC.md](Docs/SPEC.md) is the single source of truth.** It reconciles PRD/TDD/PAGES and overrides them on any conflict. Read it first.
- PRD.md (product), TDD.md (technical design), PAGES.md (page inventory).

Scope: **29 canonical sections** (SPEC.md §3), built in **5 MVP-first phases** (SPEC.md §6). Phases 1–2 are the demoable MVP. Phase 1 (Core Foundation) is implemented; later sections are navigable stubs (`ComingSoon`).

## Commands

```bash
npm run dev          # dev server (http://localhost:3000)
npm run build        # production build (also runs lint + typecheck — the real gate)
npm run start        # serve the production build
npm run lint         # ESLint (next lint)
npm run format       # Prettier write
npm run seed         # regenerate mock data in src/data/ via Faker
npm run test         # Vitest (unit/component, run once)
npm run test:watch   # Vitest watch
npm run test:e2e     # Playwright E2E
```

There is no single-test runner script; use `npx vitest run path/to/file.test.ts` or `npx vitest -t "name"`.

> **Tests are scaffolded, not yet wired.** The deps and `package.json` scripts exist, but there is no `vitest.config.*` or `playwright.config.*` (nor a test setup file) checked in yet, so `npm run test` / `npm run test:e2e` won't run a real suite until those are added. Today the dependable gate is `npm run build` (it runs lint + typecheck).

## Stack (pinned — do not "upgrade" casually)

Next.js **15** (App Router) · React **18.3** · TypeScript · Tailwind **v4** · shadcn/ui (**Base UI** primitives, not Radix) · Zustand · React Hook Form + Zod · TanStack Table · Recharts · dnd-kit · next-themes · Faker (dev). Plus: **sonner** (toasts), **react-joyride** (onboarding tour), **html2canvas + jspdf** (PDF export) and **papaparse** (CSV) for report exports.

Imports use the `@/*` path alias → `./src/*` (tsconfig).

`create-next-app` pulls Next 16 + React 19; this project is intentionally on Next 15 + React 18.3 for library compatibility. Keep it there.

### shadcn/Base UI gotcha
Components use **Base UI**, whose composition API differs from Radix:
- Use the **`render` prop**, not `asChild`: `<DropdownMenuTrigger render={<Button ... />}>…</DropdownMenuTrigger>`.
- When a `Button` renders as a link (anchor), add **`nativeButton={false}`**: `<Button render={<Link href="/x" />} nativeButton={false}>Label</Button>` — otherwise Base UI logs a console error about losing native button semantics.
- `TooltipProvider` takes **`delay`**, not `delayDuration`.
- There is **no `form` component** (Base UI omits it) — wire forms with React Hook Form directly.

## Architecture

Module-first, mirroring TDD §4. Key directories under `src/`:

- `app/` — App Router. Route groups: `(auth)` (login/mfa/etc.), `(app)` (everything authenticated, wrapped by `AuthGuard` + `DashboardShell`). `/` (landing) and `/onboarding` are standalone.
- `modules/<name>/` — feature code (`auth`, `dashboard`, `roles`, …), each with `components/`, `services/`, etc. **Pages stay thin** and delegate to module components.
- `stores/` — Zustand stores: `auth`, `roles`, `notification`, `timer`, `dashboard`. Persisted ones use the `persist` middleware with `wp-*` storage keys.
- `lib/` — `rbac.ts` (access logic), `data.ts` (typed mock-data accessors), `format.ts` (server-safe helpers), `mock-jwt.ts`, `utils.ts` (`cn`).
- `constants/` — `permissions.ts` (catalog), `roles.ts` (system roles), `navigation.ts` (sidebar tree).
- `components/shared/` (PageHeader, StatCard, EmptyState, Loader, ComingSoon, plus the **pulse-line primitives** `sparkline`, `delta-pill`, `gauge` — the WorkPulse design signature; reuse these instead of new chart one-offs) and `components/layout/` (shell, sidebar, navbar, global timer, etc.).
- `data/` — generated JSON (git-tracked output of `npm run seed`). **Never edit by hand; never import directly from components** — go through `lib/data.ts` and module services.

### Load-bearing patterns (read before changing)

1. **RBAC drives the UI.** A role holds permission ids (`"<module>:<action>"`) or the wildcard `"*"`. `canAccess(role, permission)` in [src/lib/rbac.ts](src/lib/rbac.ts) is the gate. The sidebar is **generated** by filtering `NAV_GROUPS` through the active role (`getAccessibleNav`), and `AuthGuard` blocks routes via `permissionForPath`. When you add a section: add its permission(s) to `constants/permissions.ts`, a nav entry to `constants/navigation.ts`, and grant it in `constants/roles.ts` where appropriate.

2. **Permission resolution.** `usePermissions()` / `useCurrentRole()` ([src/hooks/use-permissions.ts](src/hooks/use-permissions.ts)) join the auth store's user with the roles store (system + custom roles). Use `can(...)` to gate UI actions, not just routes.

3. **Mock service seam.** Data access goes `component → module service → lib/data.ts → JSON`, with simulated latency via `delay()`. This is the boundary a real API drops into later — keep it intact.

4. **Auth is simulated.** Login matches an email in `users.json` (any password); demo user `owner@acme.test` is the Organization Owner (wildcard). A mock JWT is stored in `localStorage` via the persisted auth store. `AuthGuard` waits for the `hydrated` flag before deciding, to avoid SSR/hydration flicker.

5. **Server vs client.** Server components must not import value exports from `"use client"` modules (e.g. don't import a helper defined in a client component into a page). Put shared helpers in non-client `lib/` files (see `lib/format.ts`).

## Conventions

- Theme tokens are CSS variables in [src/app/globals.css](src/app/globals.css) (hex, light + `.dark`). Palette is **Graphite & Indigo**: cool graphite neutrals + an indigo `--primary` (see [Docs/DESIGN.md](Docs/DESIGN.md)). `--feature`/`--feature-tint` are the featured-card accent surfaces; `--chart-1..5` is an indigo-led categorical palette; `--success`/`--warning`/`--positive`/`--negative` exist. Use token classes (`bg-primary`, `bg-feature`, `text-muted-foreground`), not hardcoded colors.
- Keep every route navigable (PRD metric: "100% clickable workflows"). New, unbuilt sections render `<ComingSoon … phase={n} />`.
- **No duplicate pages.** Every page must have a distinct purpose and present a distinct slice of data — no two pages should show the same data for the same purpose. When a view already exists elsewhere, link to it or compose a different cut; do not clone it. **The only exception is the Dashboard**, which intentionally aggregates at-a-glance summaries pulled from other pages so users can see everything at once (it still links out to the canonical page for each). This applies to drifted duplicate *components* too (e.g. the old `*-tab`/`*-view` split): consolidate into one, don't maintain two.
- Avoid `Date.now()`/`Math.random()` in render paths; the seed script is deterministic (`faker.seed(...)`-pinned), so regenerating data is stable.
