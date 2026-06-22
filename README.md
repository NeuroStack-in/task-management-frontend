# WorkPulse

A **Workforce Activity & Productivity Management Platform** — time tracking, task management, activity monitoring, and AI-powered productivity insights for modern teams.

> **Phase 1 is frontend-only.** Every feature runs on mock data, static JSON, and simulated workflows — no backend, no real monitoring, no payments. The mock-service layer is the seam a real API drops into later.

WorkPulse has its own original visual identity (see [Docs/DESIGN.md](Docs/DESIGN.md)) — a calm, warm greige canvas with a sage accent and a recurring pulse-line motif. It is not modeled on any existing product.

## Quick start

```bash
npm install
npm run seed   # generate mock data into src/data/
npm run dev    # http://localhost:3000
```

Sign in with the demo account: **`owner@acme.test`** and any password (Organization Owner — full access).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (also runs lint + typecheck) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |
| `npm run seed` | Regenerate mock data via Faker |
| `npm run test` | Vitest (unit/component) |
| `npm run test:e2e` | Playwright (E2E) |

## Tech stack

Next.js 15 (App Router) · React 18.3 · TypeScript · Tailwind v4 · shadcn/ui (Base UI primitives) · Zustand · React Hook Form + Zod · TanStack Table · Recharts · dnd-kit · next-themes · Faker.

Fonts: **Plus Jakarta Sans** (display), **Inter** (body), **JetBrains Mono** (figures).

## Architecture

Module-first under `src/`:

- `app/` — App Router. Route groups: `(auth)` (login, etc.) and `(app)` (authenticated, wrapped by `AuthGuard` + `DashboardShell`). `/` (landing) and `/onboarding` are standalone.
- `modules/<name>/` — feature code (components, services, …). Pages stay thin and delegate here.
- `stores/` — Zustand: `auth`, `roles`, `notification`, `timer`, `dashboard`, `ui`.
- `lib/` — `rbac.ts`, `data.ts` (typed mock accessors), `format.ts`, `mock-jwt.ts`, `utils.ts`.
- `constants/` — permission catalog, system roles, navigation tree.
- `components/shared/` + `components/ui/` (shadcn).
- `data/` — generated JSON (output of `npm run seed`; never edit by hand).

**RBAC drives the UI.** Roles hold permission ids (`<module>:<action>`) or the wildcard `*`. The sidebar and routes are generated/guarded from the active role's permissions via `canAccess`.

## Status

Phase 1 (Core Foundation) is implemented: auth, RBAC, app shell with a collapsible sidebar, the dashboard, and the Roles & Permissions manager. The remaining sections (of 29 total) are navigable placeholders, built out in later phases — see [Docs/SPEC.md](Docs/SPEC.md) §6.

## Documentation

- [Docs/SPEC.md](Docs/SPEC.md) — **canonical spec** (reconciles the docs below; wins on conflicts)
- [Docs/PRD.md](Docs/PRD.md) · [Docs/TDD.md](Docs/TDD.md) · [Docs/PAGES.md](Docs/PAGES.md) · [Docs/DESIGN.md](Docs/DESIGN.md)
- [CLAUDE.md](CLAUDE.md) — guidance for working in this repo
