# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**WorkPulse** — a Workforce Activity & Productivity Management Platform (SaaS).

> **Updated 2026-07-27 — the migration is essentially DONE. Assume real, not mock.**
> - **Real:** authentication (Cognito SRP + Hosted-UI social sign-in) and **~every module** — 21 module services (23 `*.service.ts` files) all call `lib/api.ts`, consuming 110+ live `/v1/*` routes (employees, projects, timesheets, attendance, leave, payroll, billing, roles, security, audit, settings/org, insights, integrations, fleet, notifications, assistant, support, exports, avatars, dashboard layouts, …).
> - **Remaining mock, all deliberate:** `mock-agents.ts` (static demo fallback for the device-fleet layout — the real fleet loads via `GET /v1/fleet`), `mock-time.ts` (a `formatHours` helper; the web timer is design-forbidden — only the desktop agent tracks time, LLD §4), and `stores/projects.store.ts` / `tasks.store.ts` (form types + seed only; pages fetch real data via hooks). Marketing pages are intentionally static. *(`mock-integrations.ts` is gone — Integrations now has a real `integrations.service.ts` on `/v1/integrations`, Slack config, and calendar.)*
> - **Still genuinely absent:** payments (no provider) and enterprise/SAML SSO. Monitoring surfaces are wired but **honest-empty until a desktop agent reports** — that's a data gap, not a wiring gap.
>
> When a monitoring page shows "—", check the QA plan's honest-empty list before assuming a bug.

**Design:** WorkPulse has its own original visual identity (see [Docs/DESIGN.md](Docs/DESIGN.md)). Do not model the UI/layout/aesthetic on any other product.

The planning docs are canonical and live in [Docs/](Docs/):
- **[Docs/SPEC.md](Docs/SPEC.md) is the single source of truth.** It reconciles PRD/TDD/PAGES and overrides them on any conflict. Read it first.
- PRD.md (product), TDD.md (technical design), PAGES.md (page inventory).

Scope: **29 canonical sections** (SPEC.md §3), built in **5 MVP-first phases** (SPEC.md §6). Phases 1–2 are the demoable MVP. **Most sections are now built and wired to the live API**; a shrinking few unbuilt ones render `<ComingSoon … phase={n} />`.

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

> **Vitest is wired and running; Playwright is not.** `vitest.config.ts` is checked in and `npm run test` (`vitest run`) executes a real suite — ~15 test files, mostly per-service `*.service.test.ts` (approvals, attendance, audit, billing, assistant, employees, insights, notifications, payroll, roles, security, org, timesheet, fleet) plus a couple of component/unit tests (`people-attention.test.tsx`, `search.test.ts`). **Playwright has the dep + `test:e2e` script but no `playwright.config.*` yet**, so E2E won't run until that lands. `npm run build` (lint + typecheck) remains the primary gate.

## Stack (pinned — do not "upgrade" casually)

Next.js **15** (App Router) · React **18.3** · TypeScript · Tailwind **v4** · shadcn/ui (**Base UI** primitives, not Radix) · Zustand · React Hook Form + Zod · TanStack Table · Recharts · dnd-kit · next-themes · Faker (dev). Plus: **amazon-cognito-identity-js** (real SRP auth), **mqtt** (the browser push/doorbell rail over AWS IoT — `lib/push.ts`), **maplibre-gl** (location maps), **qrcode.react** (TOTP enrolment), **sonner** (toasts), **html2canvas + jspdf** (PDF export) and **papaparse** (CSV) for report exports.

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
- `stores/` — Zustand stores: `auth`, `roles`, `notification`, `dashboard`, `projects`, `tasks`, `assistant`, `features`, `entitlements`, `employees`, `geofence`, `page-header`, and `ui` (sidebar-collapse + ⌘K command-palette open state). **There is no `timer` store** — the web timer is design-forbidden. Persisted ones use the `persist` middleware with `wp-*` keys (`wp-auth`, `wp-dashboard`, `wp-employees`, `wp-features`, `wp-roles`, `wp-ui`) and `partialize` for durable prefs only. **On logout, `clearWorkPulseState()` ([auth.service.ts](src/modules/auth/services/auth.service.ts)) removes every `wp-*` key except `wp-ui`** (the sidebar rail survives sign-out).
- `lib/` — `api.ts` (**the real backend client** — `apiFetch`, `ApiError`, envelope unwrapping, GET-only retry), `cognito.ts` (**real** user pool, `getIdToken`), `oauth.ts` (Hosted-UI PKCE for social sign-in), `push.ts` (the AWS-IoT/MQTT push doorbell), `rbac.ts` (UI access logic), `permission-bits.ts` (JWT `perm`-bitset → frontend permission ids, the custom-role UI gate — keep in step with `wp-contracts`), `password.ts` (mirrors the pool policy: **min 8** + upper/lower/number), `format.ts` (server-safe helpers), `utils.ts` (`cn`). Only **2 mock files remain** — `mock-agents.ts` (static demo fallback for the device-fleet layout; the real fleet arrives via `GET /v1/fleet`) and `mock-time.ts` (a `formatHours` helper; the web timer is design-forbidden). `data.ts` survives as types/seed for the projects/tasks stores only.
- `constants/` — `permissions.ts` (catalog), `roles.ts` (system roles), `navigation.ts` (sidebar tree).
- `components/shared/` (PageHeader, StatCard, EmptyState, Loader, ComingSoon, plus the **pulse-line primitives** `sparkline`, `delta-pill`, `gauge` — the WorkPulse design signature; reuse these instead of new chart one-offs) and `components/layout/` (shell, sidebar, navbar, global timer, etc.). **`product-tour.tsx`** is the guided-walkthrough overlay the Help Center launches — it mounts in the shell rather than on that page because a tour's later steps live on other routes; steps are data in `modules/help/lib/tours.ts` and target `data-tour` attributes, never class names. It is deliberately hand-rolled: `react-joyride` v2 calls React DOM APIs removed in React 18, and v3 parses colours with `hexToRGB`, so the theme's `var(--…)` tokens rendered as `NaN`.
- `data/` — generated JSON (git-tracked output of `npm run seed`). **Never edit by hand; never import directly from components** — go through `lib/data.ts` and module services.

### Load-bearing patterns (read before changing)

1. **RBAC drives the UI.** A role holds permission ids (`"<module>:<action>"`) or the wildcard `"*"`. `canAccess(role, permission)` in [src/lib/rbac.ts](src/lib/rbac.ts) is the gate. The sidebar is **generated** by filtering `NAV_GROUPS` through the active role (`getAccessibleNav`), and `AuthGuard` blocks routes via `permissionForPath`. When you add a section: add its permission(s) to `constants/permissions.ts`, a nav entry to `constants/navigation.ts`, and grant it in `constants/roles.ts` where appropriate.

2. **Permission resolution.** `usePermissions()` / `useCurrentRole()` ([src/hooks/use-permissions.ts](src/hooks/use-permissions.ts)) join the auth store's user with the roles store (system + custom roles). Use `can(...)` to gate UI actions, not just routes.

3. **One data path — the service seam is real and nearly universal.** `component → module service (src/modules/<m>/services/*.service.ts) → apiFetch() → live API` ([src/lib/api.ts](src/lib/api.ts)). Every call attaches a fresh Cognito ID token; the server's envelope is `{data, cursor?}` / `{error:{code,message}}` and surfaces as `ApiError`; only GETs retry (writes never do).
   - 21 module services (23 `*.service.ts` files) exist and **none touch mock data**; the three feature modules without a `services/` layer are `marketing` (static), `onboarding`, and `locations` (served through `insights.service.ts`).
   - Services carry a JSDoc noting the route + required permission — follow that style ([employees.service.ts](src/modules/employees/services/employees.service.ts) is the reference).
   - **The server's shape wins.** Mirror the backend DTO (read the Rust `dto.rs` in `backend/crates/<ctx>/src/features/<slice>/`) — never reshape the API to fit a frontend type.
   - Two hazards that have caused real bugs: bound per-item API fan-outs (parallel bursts trip the 503/429 throttle), and guard `META[serverValue]` lookups (an unknown server value must degrade, not crash).

4. **Auth is REAL.** Login is a genuine **SRP exchange against the live Cognito pool** ([src/modules/auth/services/auth.service.ts](src/modules/auth/services/auth.service.ts), [src/lib/cognito.ts](src/lib/cognito.ts)) — **a wrong password fails**. Needs `.env.local` (copy `.env.example`); without `NEXT_PUBLIC_API_URL` the client throws. The ID token carries the RBAC claims the pre-token trigger stamps (`tenant_id`, `perm` bitset, `is_owner`, `scope`, `custom:roleId`), projected onto the app's `User` so the existing permission/nav gating works unchanged. `AuthGuard` still waits for the `hydrated` flag to avoid SSR/hydration flicker.
   - **`owner@acme.test` is a real seeded Cognito user** in the live `dev` pool, not a fixture — it has a real password.
   - **Social sign-in is real and invited-users-only:** Google/Microsoft via the Cognito Hosted UI (PKCE in [lib/oauth.ts](src/lib/oauth.ts) → `sso-provider-buttons.tsx`, completed at `/callback` by `sso-callback.tsx`). **Enterprise/SAML SSO is not present** (removed 2026-07-24). The older `sso-buttons.tsx` (a simulated toast, still imported by `login-form.tsx`/`register-form.tsx`) is legacy demo UI, not the live path.
   - **Profile has real `/me` routes now** (`GET/PATCH /v1/me/profile`, `/v1/me/avatar` — [profile.service.ts](src/modules/profile/services/profile.service.ts)); job title / department / team come from `workforce`, not just the token.
   - **RBAC parity, and which side is authoritative:** the UI gates on permission-id strings for convenience; **the server gates on the `perm` bitset and is the real boundary.** `canAccess` is UX only — never treat it as security.

5. **Server vs client.** Server components must not import value exports from `"use client"` modules (e.g. don't import a helper defined in a client component into a page). Put shared helpers in non-client `lib/` files (see `lib/format.ts`).

## Conventions

- Theme tokens are CSS variables in [src/app/globals.css](src/app/globals.css) (hex, light + `.dark`). Palette is **Graphite & Indigo**: cool graphite neutrals + an indigo `--primary` (see [Docs/DESIGN.md](Docs/DESIGN.md)). `--feature`/`--feature-tint` are the featured-card accent surfaces; `--chart-1..5` is an indigo-led categorical palette; `--success`/`--warning`/`--positive`/`--negative` exist. Use token classes (`bg-primary`, `bg-feature`, `text-muted-foreground`), not hardcoded colors.
- Keep every route navigable (PRD metric: "100% clickable workflows"). New, unbuilt sections render `<ComingSoon … phase={n} />`.
- **No duplicate pages.** Every page must have a distinct purpose and present a distinct slice of data — no two pages should show the same data for the same purpose. When a view already exists elsewhere, link to it or compose a different cut; do not clone it. **The only exception is the Dashboard**, which intentionally aggregates at-a-glance summaries pulled from other pages so users can see everything at once (it still links out to the canonical page for each). This applies to drifted duplicate *components* too (e.g. the old `*-tab`/`*-view` split): consolidate into one, don't maintain two.
- Avoid `Date.now()`/`Math.random()` in render paths; the seed script is deterministic (`faker.seed(...)`-pinned), so regenerating data is stable.
