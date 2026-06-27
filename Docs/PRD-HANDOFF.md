# WorkPulse — Product Requirements Document (PRD)

> **Handoff edition (as-built).** This document describes the product **as currently implemented** in the codebase, for a team taking it forward. It supersedes the original planning `Docs/PRD.md` (kept for history). The companion **[TDD-HANDOFF.md](TDD-HANDOFF.md)** covers the technical design.

---

## 1. Product overview

**WorkPulse** is a **Workforce Activity & Productivity Management** platform (SaaS) — one place for time tracking, project/task work, attendance & leave, payroll, activity/screenshot monitoring, AI-driven insights, approvals, and org administration, governed by fine-grained role-based access control (RBAC).

- **Tagline / thesis:** "Measure the *rhythm* of work" — a calm, privacy-first control surface, not a surveillance console.
- **Design identity:** Original visual language — Graphite & Indigo with a recurring "pulse-line" motif. See `Docs/DESIGN.md`. Do not model UI on any other product.

### 1.1 Current build status (important)

**Phase 1 is frontend-only.** Every feature runs on **deterministic mock data** (seeded JSON + static `mock-*` modules) with **simulated latency**; there is **no backend, no real monitoring/screenshot capture, and no real payments**. Auth is simulated (any password). The app is fully clickable end-to-end so it demos as a complete product. The single source for the original scope is `Docs/SPEC.md`.

The product is built to be **navigable at 100%**: ~48 routes, 24 feature modules, all wired to mock data. Only **Remote Support** renders a `ComingSoon` placeholder (Phase 5).

---

## 2. Goals & non-goals

| Goals (Phase 1–2 demoable MVP) | Non-goals (later phases) |
|---|---|
| A complete, role-aware product UX across the full workforce-management surface | Real backend, database, or live device agents |
| Deterministic, demo-ready data for every screen | Real screenshot capture / OS monitoring |
| A clean **mock-service seam** so a real API drops in with minimal UI change | Real payments/billing processor |
| Production-grade design system, accessibility, theming | Real SSO/MFA enforcement, true audit immutability |
| Fine-grained RBAC that actually gates nav, routes, and UI actions | Multi-tenant infra, data residency, SOC2 controls |

---

## 3. Users & roles (RBAC)

WorkPulse ships **six system roles** (built-in, non-deletable; cloneable into custom roles). Access is enforced everywhere: the sidebar is *generated* from the role, routes are guarded, and individual UI actions are gated.

| Role | Scope | Permissions (count) |
|---|---|---|
| **Organization Owner** | Full, unrestricted (wildcard `*`) | **All** |
| **Admin** | Org administration across most modules | ~41 |
| **Manager** | Team management, projects, approvals, reporting | ~24 |
| **HR** | Employee management, attendance, leave, payroll view, approvals | ~11 |
| **Finance** | Billing, payroll, financial reporting | ~7 |
| **Employee** | Personal workspace: time tracking, tasks, leave, reports | ~13 |

- **Permission model:** ids are `"<module>:<action>"` (e.g. `time-tracking:approve`, `payroll:manage`) or the wildcard `"*"`. Actions: `view, create, edit, delete, assign, manage, export, approve, request`.
- **Custom roles:** admins create roles or clone a system role, then toggle permissions grouped by module. Custom roles are editable/deletable; system roles are locked (marked with a **System** badge).
- **Demo logins:** `owner@acme.test` (Owner / wildcard) and `employee@acme.test` (Employee). Any password works.
- **Catalog & roles live in:** `src/constants/permissions.ts`, `src/constants/roles.ts`. Nav/route gating in `src/constants/navigation.ts` + `src/lib/rbac.ts`.

**Role × capability is data-driven** — the matrix above is enforced by the permission lists in `constants/roles.ts`, not hard-coded per screen.

---

## 4. Information architecture / navigation

The **sidebar** is filtered per role (`getAccessibleNav`). Admin/config lives in a **Settings hub** (a nested rail), not the main sidebar.

- **Workspace:** Dashboard · Time Tracking · Projects
- **Insights:** a single "Insights" entry → a tabbed hub (Activity · Screenshots · AI Insights · Reports)
- **People:** Employees · Attendance · Leave · Payroll · Approvals
- **Communication:** Inbox · Notifications
- **Account:** Billing · Settings · Help Center
- **Settings hub (admin):** Organization, Feature management, Ownership & deletion · Monitoring, Application & URL rules · Roles & Permissions, Security, Audit Logs · Integrations, Remote Support, Desktop Agents · (+ personal: Profile, Notifications, Appearance)
- **Global:** ⌘K / Ctrl+K **command palette** (search people, projects, pages; run quick actions), a persistent **global timer** in the top bar, theme + colour-palette switchers, notifications menu, and an AI assistant FAB.

---

## 5. Functional requirements by area

> Status legend: **Built** = implemented on mock data with real interactions; **Stub** = `ComingSoon` placeholder. All "Built" items are Phase-1 mock (no real backend effects).

### 5.1 Authentication & onboarding — Built
- Login, Register, MFA (now "Multi-factor verification"), Forgot/Reset password — split-screen branded layout, RHF+Zod validation, SSO buttons (simulated), password show/hide, strength meter on register.
- 5-step onboarding wizard (org → team → roles → tracking → dashboard).
- Marketing **landing page** (`/`): hero with pulse-line preview, feature grid, stats, security highlight, CTA.

### 5.2 Dashboard — Built
- Role-aware: org KPIs (productivity, active/inactive, hours, attendance) for managers/admins; personal summary for employees.
- **Customizable widget board** (dnd-kit reorder, show/hide, reset); widgets include productivity trend, team comparison, heatmap, active/inactive ring, attendance donut, top performers, AI summary, alerts, billing, etc.
- Drills out to the canonical page for each widget (the Dashboard is the **only** page allowed to aggregate other pages' data).

### 5.3 Time Tracking — Built (role-aware)
- **Personal:** live timer (start/pause/stop, persists across nav/reload), today's timesheet, weekly hours chart, billable/idle split, CSV export.
- **Team (approvers):** weekly timesheet table with status, approve/reject, team KPIs. Owners/Admins get a Team / My-time toggle.

### 5.4 Projects & Tasks — Built
- Projects grid/list with search, status filter, create/edit dialog (name, lead, members, budget, dates), at-risk/budget-health derivations, velocity sparkline.
- Project detail → **Kanban** (To do / In progress / In review / Done) with dnd-kit drag, task create/edit dialog (assignee, priority, due, estimate). Runtime create/edit via `projects`/`tasks` stores (seed is source of truth on reload).

### 5.5 People
- **Employees — Built:** directory with KPI strip, search, dept/status filters, pagination, create-employee dialog, **CSV + PDF report export** (whole roster, respects filters), and an **individual employee profile** (identity → AI summary → KPI/reports/projects) with its own **per-employee report download** (PDF/CSV).
- **Attendance — Built:** monthly heatmap + daily clock-in/out log; date-aware; overview counts.
- **Leave — Built:** balance cards (vacation/sick/personal/unpaid), request dialog (type, date range, reason), request list with cancel; persists in `leave-requests` store.
- **Payroll — Built:** pay-run table (gross/deductions/net), payslip dialog, period selector, run-payroll (Finance), exports.
- **Approvals — Built:** unified queue (time-change / manual-entry / leave), filter by status, approve/reject with detail view, bulk actions.

### 5.6 Insights (merged hub) — Built
- **Activity:** hourly/daily/weekly activity, keyboard/mouse intensity, time-by-category, productivity heatmap (GitHub-style green), top apps/websites, active/inactive ring; **granularity (Daily/Weekly/Monthly) + specific-date filter**.
- **Screenshots:** **employee gallery** → drill into a person → all their captures, filterable by **calendar date + time range + flagged radio** (custom themed pickers), privacy-blur toggle, per-capture **AI analysis** lightbox, and a **per-person AI report**.
- **AI Insights** (route `/insights/anomalies`): AI weekly/daily summary + recommendations **merged with** anomaly detection (burnout, productivity drop, after-hours, inactivity, policy) with severity.
- **Reports:** Reports Center — **analytics charts** (hours-by-project top-N, tracked-vs-idle by department, utilization distribution — designed to scale to 100+ employees / 50+ projects), a **report-template catalog** with table previews, full-table preview dialog, **real CSV/PDF export**, **selective multi-report download** (per-card checkboxes + Select all → combined PDF/CSV), and **individual employee reports** (searchable picker → per-person KPI panel + export). Each Insights page also carries a compact **AI report card**.

### 5.7 Communication — Built
- **Inbox:** messenger-style DMs/channels with conversation list, search, thread view, compose.
- **Notifications:** center with type filters, mark read/clear, detail; live unread badge in the top bar.

### 5.8 Billing — Built
- Current plan & seats, payment method, usage, **invoices** with per-invoice **PDF download**. (Slimmed single-column layout; title "Billing & Subscription".)

### 5.9 Settings hub (admin) — mostly Built
- **Organization:** company info, departments/teams, working hours, branding.
- **Feature management:** org-wide module on/off toggles (persisted `features` store).
- **Ownership & deletion:** transfer ownership, export, delete/archive (danger zone).
- **Monitoring** & **Application/URL rules:** idle/screenshot/productivity thresholds; allow/block lists & productivity scoring.
- **Roles & Permissions, Security (MFA/SSO/session policies/events), Audit Logs (filterable, export):** Built. *(These six admin pages now render **inside** the Settings hub at `/settings/*`; the old top-level URLs redirect.)*
- **Integrations:** marketplace cards (connect/disconnect, simulated).
- **Desktop Agents:** agent fleet status/health/config.
- **Remote Support:** **Stub** (Phase 5).
- **Personal:** Profile, Notification preferences, Appearance (theme + colour palette).

### 5.10 Help — Built
- Searchable knowledge base, categories, articles, FAQs, contact.

---

## 6. Non-functional requirements

- **RBAC-correct:** every nav item, route, and sensitive UI action is permission-gated; users only ever see what their role allows.
- **Deterministic:** no `Date.now()`/`Math.random()` in render paths; seeded data (`faker.seed`-pinned, fixed "today" = **2026-06-23**) so every screen renders identically across reloads (enables stable demos/screenshots).
- **Accessible & responsive:** keyboard focus rings, `prefers-reduced-motion`, AA contrast, mobile layouts (sheets, horizontal rails).
- **Theming:** light/dark + multiple brand colour palettes via `data-palette`, applied pre-paint to avoid flash.
- **Quality gate:** `npm run build` (lint + typecheck) is the dependable gate today (test runners are scaffolded but not wired).
- **Exports:** CSV (papaparse) and PDF (jsPDF) client-side, via a shared `downloadBlob` helper.

---

## 7. Roadmap / open backlog (for the next team)

1. **Backend integration (highest value):** replace the mock seam (`lib/data.ts`, module services, `mock-*`) with a real API. The seam is already isolated — see TDD §"Backend integration plan".
2. **Remote Support** (Phase 5) — only remaining `ComingSoon`. A plan exists at `Docs/PLAN-remote-support.md`.
3. **Real auth** — swap `mock-jwt` + `auth.service` for real OAuth/JWT + MFA/SSO enforcement.
4. **Wire the test suites** — `vitest.config`/`playwright.config` + a setup file are not yet committed; RBAC logic and stores are prime unit-test targets.
5. **Command palette** completeness — quick-actions and entity search are built; consider scheduled/saved searches.
6. **Reports** — scheduled/recurring exports and a custom report builder are specced but not built.
7. **Consolidation guardrail:** the codebase enforces "no duplicate pages/components" (see CLAUDE.md). Keep new work consolidated; the Dashboard is the only intentional aggregator.

---

## 8. Reference docs

- `Docs/SPEC.md` — original single source of truth (29 sections, 5 phases).
- `Docs/DESIGN.md`, `Docs/DESIGN-color-guide.md` — visual identity & palettes.
- `Docs/RBAC.md` — access model deep-dive.
- `Docs/PAGES.md` — page inventory.
- `Docs/wireframes/` — section wireframes.
- `Docs/PLAN-*.md`, `Docs/HANDOFF-*.md` — feature plans & session handoffs.
- `CLAUDE.md` — contributor/agent working conventions (load-bearing patterns).
