# WorkPulse — Technical Design Document (TDD)

> **Handoff edition (as-built).** Describes the technical design **as implemented**, for the team taking it forward. Companion to **[PRD-HANDOFF.md](PRD-HANDOFF.md)**. Supersedes the planning-era `Docs/TDD.md` (kept for history).

---

## 1. Architecture at a glance

A **module-first Next.js 15 App-Router SPA-style app**, frontend-only in Phase 1. All data is **deterministic mock data** read through a thin **service/accessor seam** with simulated latency — the single place a real backend plugs in later. Pages stay thin and delegate to feature modules; cross-cutting concerns (auth, RBAC, theming, layout) live in shared layers.

```
Browser
  └─ Next.js App Router (src/app)
       ├─ (auth) routes  ── split-screen auth shell
       ├─ (app) routes   ── AuthGuard → DashboardShell (sidebar+topbar+main)
       │     └─ settings/* ── nested Settings rail layout
       └─ / (landing), /onboarding ── standalone
  Feature modules (src/modules/<name>)  ── components / services / types
  State: Zustand stores (src/stores)    ── persisted with wp-* keys
  Access: RBAC (src/lib/rbac, constants) ── nav-gen + route guard + UI gates
  Data seam: src/lib/data.ts + delay() + src/lib/mock-*.ts + src/data/*.json
  Design system: src/components/{ui,shared,layout} on Base UI + Tailwind v4 tokens
```

---

## 2. Stack (pinned — do not casually upgrade)

| Concern | Choice |
|---|---|
| Framework | **Next.js 15** (App Router), **React 18.3** |
| Language | TypeScript 5 (strict) |
| Styling | **Tailwind v4** (CSS-first `@theme inline`; tokens in `globals.css`) |
| Components | shadcn/ui on **Base UI** primitives (`@base-ui/react`) — **not Radix** |
| State | **Zustand 5** (+ `persist` middleware) |
| Forms | React Hook Form 7 + Zod 3 (`@hookform/resolvers`) |
| Charts | Recharts 2 |
| Tables | TanStack Table 8 |
| Drag & drop | dnd-kit (core/sortable/utilities) |
| Theming | next-themes (dark/light) + custom `data-palette` system |
| Toasts | sonner · **Tours** react-joyride |
| Exports | papaparse (CSV) + jsPDF (+ html2canvas) |
| Icons | lucide-react |
| Dev data | Faker (`@faker-js/faker`, seed script via tsx) |

- **Path alias:** `@/*` → `./src/*`.
- **Pinned on Next 15 / React 18.3** for Base UI / library compatibility — `create-next-app` would pull Next 16 + React 19; keep it here.
- **Base UI gotchas:** use the **`render` prop** (not `asChild`); `Button` rendering an anchor needs `nativeButton={false}`; `TooltipProvider` takes `delay`; there is **no `form` primitive** (wire RHF directly).

### Scripts / gate
`dev`, `build` (lint+typecheck — **the real gate**), `start`, `lint`, `format`, `seed` (regenerate mock data), `test`/`test:watch` (Vitest), `test:e2e` (Playwright). **Note:** no `vitest.config`/`playwright.config` is committed yet, so `npm run build` is today's dependable gate.

---

## 3. App structure & rendering

- **Route groups** under `src/app/`:
  - `(auth)` — login/register/mfa/forgot/reset (passthrough layout → branded split screen).
  - `(app)` — everything authenticated; its `layout.tsx` wraps children in **`AuthGuard` → `DashboardShell`**.
  - `settings/*` — a **nested layout** (`settings/layout.tsx`) adds a permission-filtered **rail** with its own independent themed scroll (`.wp-rail-scroll`); the six admin pages (roles/security/audit-logs/integrations/remote-support/agents) live here, with the old top-level routes kept as `redirect()` shims.
  - `/` (landing) and `/onboarding` — standalone.
- **Root layout** (`src/app/layout.tsx`): fonts (Inter / Plus Jakarta Sans / JetBrains Mono), metadata, an **inline pre-paint script** that applies the persisted `data-palette`, and `AppProviders` (next-themes `ThemeProvider`, `TooltipProvider`, sonner `Toaster`).
- **`AuthGuard`** (`components/layout/auth-guard.tsx`): waits for the auth store's `hydrated` flag, redirects unauthenticated users to `/login?from=…`, and gates the route via `permissionForPath(pathname)` (renders an "Access denied" state otherwise).
- **`DashboardShell`**: floating rounded sidebar (collapses to an icon rail; auto-collapses on `/settings/*`), top navbar, `main`, plus floating **ChatBot** and **CommandPalette**.
- **Server vs client:** route pages and `lib/`/`mock-*` are server-safe; interactive surfaces are `"use client"`. **Rule:** server components must not import value exports from `"use client"` modules — keep shared helpers in non-client `lib/` files.

---

## 4. State management (Zustand)

12 stores in `src/stores/`. Persisted ones use `persist` with `wp-*` keys and `partialize` to persist only durable prefs.

| Store | Persisted (key) | Purpose / key actions |
|---|---|---|
| `auth` | ✅ `wp-auth` (session/user/isAuthenticated) | `login`/`logout`; `hydrated` flag set via `onRehydrateStorage` |
| `ui` | ✅ `wp-ui` (sidebar only) | `sidebarCollapsed`; `commandOpen` (⌘K, **not** persisted) |
| `timer` | ✅ `wp-timer` | global timer: `start/pause/resume/stop/switchTask/elapsed`; segment accounting |
| `dashboard` | ✅ `wp-dashboard` (versioned) | widget visibility + order (`toggleWidget`, `reorder`, `reset`) |
| `roles` | ✅ `wp-roles` (custom only) | custom roles CRUD + clone; system roles from constants |
| `features` | ✅ `wp-features` | org module on/off toggles |
| `employees` | ✅ `wp-employees` | runtime-created employees (layered over seed users) |
| `leave-requests` | ✅ `wp-leave-requests` | leave request add/cancel + balances |
| `projects` | ❌ (seed = truth) | project CRUD at runtime |
| `tasks` | ❌ (seed = truth) | task CRUD + kanban move |
| `notification` | ❌ (transient) | in-memory notifications + unread count |
| `assistant` | ❌ (transient) | AI assistant panel open + queued prompt |

`projects`/`tasks`/`notification`/`assistant` are intentionally **not** persisted so demos stay deterministic on reload.

---

## 5. Access control (RBAC)

- **Catalog:** `src/constants/permissions.ts` — `PERMISSION_CATEGORIES` (module → actions), ids `"<module>:<action>"`, wildcard `"*"`.
- **Roles:** `src/constants/roles.ts` — 6 `SYSTEM_ROLES` (Owner=`["*"]`, Admin/Manager/HR/Finance/Employee = explicit lists). `Role = { id, name, description, system, permissions }`.
- **Navigation:** `src/constants/navigation.ts` — `NAV_GROUPS` (sidebar), `INSIGHTS_TABS`, `ADMIN_SECTIONS`. `NavItem` supports `permission` or `anyPermissions` (OR).
- **Logic:** `src/lib/rbac.ts` — `canAccess` / `canAll` / `canAny`, `isNavItemVisible`, `getAccessibleNav(role)` (generates the sidebar), `permissionForPath(pathname)` (longest-href match → required permission for the route guard).
- **Resolution hook:** `src/hooks/use-permissions.ts` — `useCurrentRole()` joins the auth user with system+custom roles; `usePermissions()` returns `{ role, can, canAll, canAny, nav }`. **Gate UI actions with `can(...)`, not just routes.**

To add a section: add permission(s) to `permissions.ts`, a nav entry to `navigation.ts`, grant it in `roles.ts`, and the sidebar/guard pick it up automatically.

---

## 6. Domain model (entities)

Types live in `src/types/*` and per-module `types.ts`. Core entities:

- **Organization** `{ id, name, logoUrl?, plan, timezone }`
- **User** `{ id, name, email, avatarUrl?, roleId, jobTitle, department, team, status, productivityScore, organizationId }`; `AuthSession { token, userId, issuedAt }`
- **Role / Permission** (see §5)
- **Project** `{ id, name, key, description?, status, progress, leadUserId, managerId?, memberIds[], department, budget, spent, startDate, dueDate, velocity[] }`
- **Task** `{ id, projectId, title, status(todo|in_progress|in_review|done), assigneeId|null, priority, dueDate|null, estimateHours }`
- **Time:** `TimeEntry`, `TaskOption`, `DailyHours`, `TimeSummary`, plus `ActiveTimerTask`/`TimerStatus`
- **Attendance:** `AttendanceRecord`, calendar `DayCell`/`DayCounts`
- **Leave:** `LeaveRequest` (vacation/sick/personal/unpaid; pending/approved/rejected) + balances
- **Payroll:** `PayslipRow`, `PayrollRun`, periods
- **Approvals:** `ApprovalRequest { kind(time-change|manual-entry|leave), requester, status, … }`
- **Insights:** `UsageItem`, `Screenshot`, `Anomaly`, `ReportDef`, activity series + per-employee screenshot grouping
- **Billing:** `PlanTier`, `CurrentPlan`, `UsageMeter`, `Invoice`
- **Admin:** `AuditEvent`, `Integration`, `Agent`, security `MfaMethod`/`SecurityPolicies`/`SsoConnection`/`SecurityEvent`, org `WorkingHoursConfig`/`OrgHoliday`/`OrgLocation`
- **Notifications:** `AppNotification { type, title, message, read, createdAt, href? }`
- **Inbox:** `Conversation`/`ChatMessage`

---

## 7. Data layer & the mock/API seam ⭐ (key for handoff)

This is the seam a real backend drops into.

- **Seed:** `scripts/seed.ts` (`npm run seed`) — Faker pinned to a fixed seed; "today" anchored to **2026-06-23**; emits `src/data/*.json` (organization, ~122 users, ~40 projects, ~420 tasks). Deterministic across runs.
- **Accessors:** `src/lib/data.ts` — exports `users`, `organization`, `projects`, `tasks` (typed from JSON) and `delay<T>(value, ms=250)` (simulated network RTT). **Components never import JSON directly** — they go through accessors / module services.
- **Static datasets:** `src/lib/mock-*.ts` (agents, approvals, attendance, audit, billing, help, inbox, insights, integrations, metrics, monitoring, notifications, org, payroll, security, time) — each provides one domain's data, derived deterministically (fixed arrays, seeded-user slices, or `hash(id) % n` per-person variation). No `Date.now()`/`Math.random()` in render paths (notifications use relative timestamps, refreshed on load).
- **Module services:** e.g. `src/modules/auth/services/auth.service.ts` wrap data access and `delay()`.

### Backend integration plan (where to wire the API)
1. **`src/lib/data.ts`** — replace JSON imports with async fetchers (`getUsers()`, `getProjects()`, …) hitting your REST/GraphQL endpoints; keep `delay()` only for local mocks.
2. **Module services** (`src/modules/*/services`) — turn in-memory filters into API calls; this is the natural place for endpoint logic.
3. **Stores** — convert seed-initialized stores to async load/refresh actions; keep `partialize`/persist for client prefs only.
4. **Auth** — swap `src/lib/mock-jwt.ts` + `auth.service.ts` for real OAuth/JWT; `auth.store` already models session + hydration. Enforce permissions server-side (the mock layer currently trusts the client).
5. **Reports/exports** — `src/lib/download.ts` stays (pure DOM); move heavy report generation server-side, keep the same `ReportDef` shape for the table/preview UI.

---

## 8. Authentication (simulated)

- `src/lib/mock-jwt.ts`: `createMockToken(userId, issuedAt)` base64-encodes `{sub, iat}` (no signature); `decodeMockToken`.
- `auth.service.login(email, _password)`: matches `email` in `users.json` (any password), rejects suspended accounts, returns `{ session, user }` after `delay`. Session persists in `wp-auth`.
- `AuthGuard` waits for `hydrated` to avoid SSR/CSR flicker, then redirects/guards.

---

## 9. Design system & components

- **Tokens:** `src/app/globals.css` — Tailwind v4 `@theme inline` mapping CSS variables. Palette **Graphite & Indigo** (light + `.dark`), plus alternate brand palettes via `[data-palette="…"]` (corporate, evergreen, fireopal, teal, violet, sapphire, dusk, iron, …). Tokens: `primary/secondary/muted/accent/destructive/success/warning/feature/feature-tint/chart-1..5/sidebar-*`, radius scale, fonts. Custom utilities: `shadow-soft`, `wp-hatch`, `wp-rail-scroll`, pulse/gauge keyframes.
- **`components/ui/`** — Base UI wrappers: button, input, label, select, dropdown-menu, dialog, sheet, checkbox, switch, table, scroll-area, tooltip, separator, avatar, badge, card, skeleton, number-stepper, **calendar + date-picker** (custom themed, replacing native date/time inputs), **command-palette** (⌘K).
- **`components/shared/`** — `PageHeader`, `StatCard`, the **pulse-line primitives** (`sparkline`, `gauge`/`tick-gauge`, `delta-pill`), `EmptyState`, `ComingSoon`, `Loader`, settings save bar. **Reuse these instead of new chart one-offs.**
- **`components/layout/`** — `dashboard-shell`, `top-navbar`, `sidebar-nav`, `global-timer`, `command-palette`, `palette-switcher`, `theme-switcher`, `user-menu`, `notifications-menu`, `chat-bot`.

---

## 10. Module structure & conventions

- `src/modules/<name>/{components, services, types.ts, lib.ts, report.ts}` — feature code; **pages stay thin** and delegate.
- **Determinism:** avoid `Date.now()`/`Math.random()` in render; use fixed anchors (e.g. projects' `TODAY`). Use **literal Tailwind class strings** in tone maps (no interpolated class names — Tailwind can't see them).
- **No duplicate pages/components** (CLAUDE.md): one component per purpose; the old `*-tab`/`*-view` splits were consolidated. Dashboard is the only intentional aggregator.
- **Theme correctness:** use token classes (`bg-primary`, `text-muted-foreground`, `bg-feature`), never hardcoded colours.

---

## 11. Build, quality & known gaps

- **Gate:** `npm run build` runs lint + typecheck — the dependable CI gate today. `npm run lint` / `npm run format` available.
- **Tests scaffolded, not wired:** deps + scripts exist but `vitest.config`/`playwright.config` + setup are **not committed**; `npm run test`/`test:e2e` won't run a real suite yet. **First task for a backend team:** wire these and unit-test `rbac.ts`, the stores, and the data seam.
- **Dev-server note:** creating route files while `next dev` runs can desync `.next` (chunk-load errors). Cure: stop dev, delete `.next`, `npm run dev`. Don't `npm run build` while `dev` is live.
- **Open work:** Remote Support (stub), real auth/MFA/SSO, backend wiring, scheduled reports + custom report builder, command-palette saved searches.

---

## 12. Where things live (quick map)

| Concern | Path |
|---|---|
| Routes | `src/app/(auth|app)/**`, `src/app/page.tsx`, `src/app/onboarding` |
| Features | `src/modules/<name>/` |
| State | `src/stores/*.store.ts` |
| Access control | `src/lib/rbac.ts`, `src/constants/{permissions,roles,navigation}.ts`, `src/hooks/use-permissions.ts` |
| Data seam | `src/lib/data.ts`, `src/lib/mock-*.ts`, `src/data/*.json`, `scripts/seed.ts` |
| Auth | `src/lib/mock-jwt.ts`, `src/modules/auth/`, `src/stores/auth.store.ts` |
| Design system | `src/app/globals.css`, `src/components/{ui,shared,layout}` |
| Docs | `Docs/` (`SPEC.md` = original source of truth; `DESIGN*.md`, `RBAC.md`, `PAGES.md`, wireframes, plans) |
