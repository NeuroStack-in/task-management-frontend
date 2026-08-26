# WorkPulse

A **Workforce Activity & Productivity Management Platform** — time tracking, task management, activity monitoring, and AI-powered productivity insights for modern teams.

> **Wired to the live backend (as of 2026-08-26).** Authentication is real Cognito (SRP + Hosted-UI social sign-in) and every module calls the live API through `lib/api.ts` — 25 module services over 110+ `/v1/*` routes. **There is no mock data left**: the fixtures, the Faker seed script and the two seeded stores were deleted 2026-08-26. Monitoring surfaces are wired but honest-empty until a desktop agent reports.

WorkPulse has its own original visual identity (see [Docs/DESIGN.md](Docs/DESIGN.md)) — the **Graphite & Indigo** palette (cool graphite neutrals + an indigo accent) with a recurring pulse-line motif. It is not modeled on any existing product.

## Quick start

```bash
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_API_URL + Cognito pool config (required)
npm run dev                  # http://localhost:3000
```

Sign in with the seeded Cognito account **`owner@acme.test`** (Organization Owner — full access) using its **real password** — auth is a genuine SRP exchange, so a wrong password fails. All data comes from the live `dev` backend; there are no local fixtures.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (also runs lint + typecheck) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |
| `npm run test` | Vitest (unit/component) — `vitest.config.ts` is wired; ~15 tests run |
| `npm run test:e2e` | Playwright (E2E) — script/dep exist but no `playwright.config.*` yet |

## Tech stack

Next.js 15 (App Router) · React 18.3 · TypeScript · Tailwind v4 · shadcn/ui (Base UI primitives) · Zustand · React Hook Form + Zod · TanStack Table · Recharts · dnd-kit · next-themes · amazon-cognito-identity-js (auth) · mqtt (push doorbell) · maplibre-gl (maps) · qrcode.react (TOTP) · sonner · Vitest · Faker (dev).

Fonts: **Plus Jakarta Sans** (display), **Inter** (body), **JetBrains Mono** (figures).

## Architecture

Module-first under `src/`:

- `app/` — App Router. Route groups: `(auth)` (login, etc.) and `(app)` (authenticated, wrapped by `AuthGuard` + `DashboardShell`). `/` (landing) and `/onboarding` are standalone.
- `modules/<name>/` — feature code (components, services, …). Pages stay thin and delegate here.
- `stores/` — Zustand: `auth`, `roles`, `notification`, `dashboard`, `projects`, `tasks`, `assistant`, `features`, `entitlements`, `employees`, `geofence`, `page-header`, `ui` (no `timer` store — the web timer is design-forbidden).
- `lib/` — `api.ts` (real backend client), `cognito.ts` / `oauth.ts` (auth), `push.ts` (MQTT doorbell), `rbac.ts`, `permission-bits.ts`, `format.ts`, `utils.ts`.
- `constants/` — permission catalog, system roles, navigation tree.
- `components/shared/` + `components/ui/` (shadcn).
- `e2e/` — Playwright specs (`npm run test:e2e`); credential-free by design.

**RBAC drives the UI.** Roles hold permission ids (`<module>:<action>`) or the wildcard `*`. The sidebar and routes are generated/guarded from the active role's permissions via `canAccess`.

## Status

**Wired to the live backend (2026-07-27).** Real Cognito auth (SRP + Google/Microsoft social sign-in, invited-users-only) and ~every module consuming the live API via its `services/` layer — employees, projects, timesheets, attendance, leave, payroll, billing, roles, security, audit, settings/org, insights, integrations, notifications, fleet, and more. A shrinking few unbuilt sections (of 29 total) still render `<ComingSoon>`; enterprise/SAML SSO and payments are the notable absences. See [Docs/SPEC.md](Docs/SPEC.md) §6 and [CLAUDE.md](CLAUDE.md) for the current picture.

## Documentation

- [Docs/SPEC.md](Docs/SPEC.md) — **canonical spec** (reconciles the docs below; wins on conflicts)
- [Docs/PRD.md](Docs/PRD.md) · [Docs/TDD.md](Docs/TDD.md) · [Docs/PAGES.md](Docs/PAGES.md) · [Docs/DESIGN.md](Docs/DESIGN.md)
- [CLAUDE.md](CLAUDE.md) — guidance for working in this repo
