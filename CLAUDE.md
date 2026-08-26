# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**WorkPulse** — a Workforce Activity & Productivity Management Platform (SaaS).

> **Updated 2026-08-26 — the migration is DONE and the mock layer is DELETED. Everything is real.**
> - **Real:** authentication (Cognito SRP + Hosted-UI social sign-in) and **every module** — 25 `*.service.ts` files all call `lib/api.ts`, consuming 110+ live `/v1/*` routes (employees, projects, timesheets, attendance, leave, payroll, billing, roles, security, audit, settings/org, insights, integrations, fleet, notifications, assistant, support, exports, avatars, dashboard layouts, …).
> - **No mock remains.** `mock-agents.ts`, `mock-time.ts`, `lib/data.ts`, `src/data/*.json`, `scripts/seed.ts` and the two seeded zustand stores were **deleted 2026-08-26** (~2.3k lines), along with the orphaned `agents-manager.tsx` / `agent-detail-page.tsx` that the routed fleet pages had already replaced. What survived, relocated: the real installer/manifest constants → [lib/agent-release.ts](src/lib/agent-release.ts), `formatHours` → [lib/format.ts](src/lib/format.ts), the project/task **form** shapes → [modules/projects/forms.ts](src/modules/projects/forms.ts). Marketing pages are intentionally static.
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
npm run test         # Vitest (unit/component, run once)
npm run test:watch   # Vitest watch
npm run test:e2e     # Playwright E2E
```

There is no single-test runner script; use `npx vitest run path/to/file.test.ts` or `npx vitest -t "name"`.

> **Both runners are wired and green.** `npm run test` (`vitest run`) executes **313 tests across 45 files** — mostly per-service `*.service.test.ts` plus component/unit tests. `npm run test:e2e` runs **10 Playwright specs** against a real Chromium ([playwright.config.ts](playwright.config.ts), specs in [e2e/](e2e/)); it starts `next dev` itself and reuses one that is already up.
>
> **The e2e specs are credential-free on purpose.** Login is a genuine SRP exchange against the live `dev` Cognito pool, so a signed-in journey would need a real account and would write to the shared tenant. They cover the public marketing surface, the login form's own validation, and the `AuthGuard` redirect — the parts that break silently because no unit test renders a real browser. Timeouts are deliberately generous: `next dev` compiles a route on first request, and a cold `/dashboard` takes >20s.

> `npm run build` (lint + typecheck) remains the primary gate.

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
- `stores/` — Zustand stores: `auth`, `roles`, `notification`, `dashboard`, `assistant`, `features`, `entitlements`, `employees`, `geofence`, `page-header`, and `ui` (sidebar-collapse + ⌘K command-palette open state). **There is no `timer` store** — the web timer is design-forbidden. **There are no `projects`/`tasks` stores either** — they held a session working copy seeded from static JSON and were only ever imported with `import type`; the form shapes they carried now live in [modules/projects/forms.ts](src/modules/projects/forms.ts). Persisted ones use the `persist` middleware with `wp-*` keys (`wp-auth`, `wp-dashboard`, `wp-employees`, `wp-features`, `wp-roles`, `wp-ui`) and `partialize` for durable prefs only. **On logout, `clearWorkPulseState()` ([auth.service.ts](src/modules/auth/services/auth.service.ts)) removes every `wp-*` key except `wp-ui`** (the sidebar rail survives sign-out).
- `lib/` — `api.ts` (**the real backend client** — `apiFetch`, `ApiError`, envelope unwrapping, GET-only retry), `cognito.ts` (**real** user pool, `getIdToken`), `oauth.ts` (Hosted-UI PKCE for social sign-in), `push.ts` (the AWS-IoT/MQTT push doorbell), `rbac.ts` (UI access logic), `permission-bits.ts` (JWT `perm`-bitset → frontend permission ids, the custom-role UI gate — keep in step with `wp-contracts`), `password.ts` (mirrors the pool policy: **min 8** + upper/lower/number), `format.ts` (server-safe helpers, incl. `formatHours`), `agent-release.ts` (the real installer URLs + release manifest the Download page and update dot read), `utils.ts` (`cn`). **No mock files remain** — `mock-agents.ts`, `mock-time.ts` and `data.ts` were deleted 2026-08-26.
- `constants/` — `permissions.ts` (catalog), `roles.ts` (system roles), `navigation.ts` (sidebar tree).
- `components/shared/` (PageHeader, StatCard, EmptyState, Loader, ComingSoon, plus the **pulse-line primitives** `sparkline`, `delta-pill`, `gauge` — the WorkPulse design signature; reuse these instead of new chart one-offs) and `components/layout/` (shell, sidebar, navbar, global timer, etc.). **`product-tour.tsx`** is the guided-walkthrough overlay the Help Center launches — it mounts in the shell rather than on that page because a tour's later steps live on other routes; steps are data in `modules/help/lib/tours.ts` and target `data-tour` attributes, never class names. It is deliberately hand-rolled: `react-joyride` v2 calls React DOM APIs removed in React 18, and v3 parses colours with `hexToRGB`, so the theme's `var(--…)` tokens rendered as `NaN`.
- `e2e/` — Playwright specs (`npm run test:e2e`), credential-free by design. *(`data/` — the Faker-generated JSON fixtures — is gone; nothing imported it any more.)*

### Load-bearing patterns (read before changing)

1. **RBAC drives the UI.** A role holds permission ids (`"<module>:<action>"`) or the wildcard `"*"`. `canAccess(role, permission)` in [src/lib/rbac.ts](src/lib/rbac.ts) is the gate. The sidebar is **generated** by filtering `NAV_GROUPS` through the active role (`getAccessibleNav`), and `AuthGuard` blocks routes via `permissionForPath`. When you add a section: add its permission(s) to `constants/permissions.ts`, a nav entry to `constants/navigation.ts`, and grant it in `constants/roles.ts` where appropriate.

2. **Permission resolution.** `usePermissions()` / `useCurrentRole()` ([src/hooks/use-permissions.ts](src/hooks/use-permissions.ts)) join the auth store's user with the roles store (system + custom roles). Use `can(...)` to gate UI actions, not just routes.

3. **One data path — the service seam is real and universal.** `component → module service (src/modules/<m>/services/*.service.ts) → apiFetch() → live API` ([src/lib/api.ts](src/lib/api.ts)). Every call attaches a fresh Cognito ID token; the server's envelope is `{data, cursor?}` / `{error:{code,message}}` and surfaces as `ApiError`; only GETs retry (writes never do).
   - **`apiFetch` is called from `lib/` and from `*.service.ts` files and nowhere else** (verified 2026-08-26). A hook or component that reaches past its module service is the regression to catch in review. Importing `ApiError` outside a service is fine and expected — it's the error type services throw, not a way around the seam.
   - 25 `*.service.ts` files exist and **none touch mock data** (there is none); the three feature modules without a `services/` layer are `marketing` (static), `onboarding`, and `locations` (served through `insights.service.ts`).
   - **A bare `GET /v1/employees` truncates.** With no `dept`, the server fans out, merges, then `truncate(limit)` with **no cursor** — so a map or picker built from it silently omits everyone past the first page. Use `listAllEmployees` / `employeeNameMap` / `directoryUserMap`, which walk every department partition.
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
- Avoid `Date.now()`/`Math.random()` in render paths — they differ between the server and client render and produce a hydration mismatch.
