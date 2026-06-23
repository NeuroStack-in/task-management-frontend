# SPEC.md — Canonical Project Specification

**Single source of truth.** Reconciles [PRD.md](PRD.md), [TDD.md](TDD.md), and [PAGES.md](PAGES.md). Where those documents conflict, **this file wins**.

- **Product:** Workforce Activity & Productivity Management Platform
- **Phase:** 1 — Frontend only (mock data, static JSON, simulated workflows; no backend)
- **Canonical scope source:** PAGES.md V2 — **29 sections** / 90–120 screens
- **5-day target:** Aspirational. Real plan is **MVP-first phasing** (see §6).

---

## 1. Decisions (resolved)

| Question | Decision |
|----------|----------|
| Package manager | **npm** |
| Testing | **Vitest** (unit/component) + **Playwright** (E2E of clickable workflows) |
| Scope authority | **PAGES.md V2** (29 sections). PRD's 22 modules are a subset; TDD's 5 days is aspirational. |
| Linting/formatting | **ESLint** (next config) + **Prettier** |
| Mock data | Generated via **@faker-js/faker** seed scripts → static JSON in `src/data/` (not hand-written) |

### Locked stack (from PRD §4 / TDD §1 — no conflicts)
Next.js 15 · TypeScript · TailwindCSS · Shadcn/UI · Lucide React · Zustand · React Hook Form + Zod · TanStack Table · Recharts · dnd-kit · next-themes · jsPDF + html2canvas · PapaParse · react-joyride

---

## 2. Reconciled scope conflicts

These were the divergences across the three docs. Resolutions are now canonical:

1. **Module count.** PRD = 22 modules; PAGES.md V2 = 29 sections. → **29 sections canonical.** V2 additions are in scope: Organization Management, Monitoring Configuration, Application & URL Management, Internal Communication, Feature Management, Remote Support Center, Desktop Agent Management.
2. **"Reverse Shell Access"** (PRD §10) → renamed **Remote Support Center** (PAGES §27). The raw reverse-shell concept is **dropped**; only an approval-gated, simulated remote-support UI is built.
3. **Timeline.** TDD "5 days / 5 sprints" → reinterpreted as **5 phases**, MVP-first (§6). Sprint *names* retained as phase labels.
4. **Surveillance scope.** This product simulates employee monitoring (screenshots, keyboard/mouse counts, silent tracking, URL/app blocking). Phase 1 builds **UI + mock data only** — no real capture (PRD §10 confirms). Keep all such features clearly behind the mock-service layer.

---

## 3. Canonical section → route map (29 sections)

Route groups follow TDD §3. `(marketing)` and `(auth)` are unauthenticated; everything else sits under the authenticated dashboard layout.

| # | Section (PAGES V2) | Route | Phase |
|---|--------------------|-------|-------|
| 1 | Marketing Website | `/` `(marketing)` | 5 |
| 2 | Authentication | `/(auth)/{login,register,forgot-password,reset-password,mfa}` | 1 |
| 3 | Onboarding | `/onboarding` | 1 |
| 4 | Dashboard Center | `/dashboard` | 2 |
| 5 | Time Tracking | `/time-tracking` | 2 |
| 6 | Tasks & Work Management | merged into `/projects` (per-project task boards + "My tasks" view); no standalone `/tasks` | 2 |
| 7 | Project Management | `/projects` | 2 |
| 8 | Employee Management | `/employees` | 3 |
| 9 | Organization Management | `/settings/organization` | 4 |
| 10 | Activity Monitoring | `/insights/activity` (Insights tab) | 3 |
| 11 | Screenshot Center | `/insights/screenshots` (Insights tab) | 3 |
| 12 | Monitoring Configuration | `/settings/monitoring` | 4 |
| 13 | Application & URL Management | `/settings/tracking-rules` | 4 |
| 14 | Reports Center | `/insights/reports` (Insights tab) | 3 |
| 15 | AI Center | `/insights/ai` (Insights tab) | 5 |
| 16 | Anomaly Detection Center | `/insights/anomalies` (Insights tab) | 5 |

> Sections 10, 11, 14, 15, 16 are unified into a single **Insights** page (one
> sidebar entry) with nested, permission-gated tabs under `/insights/*`.
| 17 | Approval Center | `/approvals` | 4 |
| 18 | Internal Communication | `/inbox` | 4 |
| 19 | Notification Center | `/notifications` | 4 |
| 20 | ~~Job Portal~~ — removed from scope | — | — |
| 21 | Integrations Marketplace | `/integrations` | 4 |
| 22 | Billing & Subscription | `/billing` | 4 |
| 23 | Role & Permission Management | `/roles` | 1 |
| 24 | Feature Management | `/settings/features` | 4 |
| 25 | Security Center | `/security` | 4 |
| 26 | Audit Logs | `/audit-logs` | 4 |
| 27 | Remote Support Center | `/remote-support` | 5 |
| 28 | Desktop Agent Management | `/agents` | 5 |
| 29 | Help Center | `/help` | 5 |

**Global components** (PAGES "Global Components"): Global Timer, AI Assistant, Notifications Panel, Command Palette (Ctrl+K), Search, User Profile, Theme Switcher, Organization Switcher, Help Widget — all in the dashboard layout shell (TDD §5).

---

## 4. Module folder mapping

`src/modules/<name>/` per TDD §4, each with `components / hooks / services / types / constants / mock-data / index.ts`. One module may serve several sections (e.g. `settings` covers sections 9, 12, 13, 24).

```
modules/  auth · onboarding · dashboard · time-tracking · tasks · projects ·
          employees · activity · screenshots · reports · ai · anomalies ·
          approvals · communication · notifications · integrations ·
          billing · roles · security · audit-logs · remote-support · agents ·
          help · settings · marketing
```

---

## 5. Data layer (canonical)

- All access goes through `src/modules/<m>/services/*.service.ts` returning mocks (TDD §20). **No component reads JSON directly** — this is the backend seam.
- Static datasets in `src/data/` (TDD §19): `users, tasks, projects, activity, screenshots, reports, invoices, roles, permissions, notifications` + V2 additions (`departments, teams, integrations, auditLogs, agents`).
- Volumes (PRD §9): 100+ users · 500+ tasks · 50+ projects · 10,000+ activity logs · 1,000+ screenshots · 100+ reports → **generate with Faker seed scripts**, render large tables via TanStack Table pagination/virtualization.
- RBAC (TDD §8): `canAccess(role, permission)` gates routes; sidebar is generated from `role.permissions`. Build in Phase 1.
- Zustand stores (TDD §10): `auth · dashboard · theme · notification · timer`. Mock JWT in `localStorage`.

---

## 6. MVP-first phasing (replaces "5 days")

| Phase | Label (TDD sprint) | Delivers |
|-------|--------------------|----------|
| 1 | Core Foundation | Layout shell, theme, auth (simulated), RBAC + `canAccess`, generated sidebar/nav, roles |
| 2 | Productivity | Dashboard + widget system, tasks (list/kanban/calendar/timeline), projects, global timer |
| 3 | Monitoring | Activity monitoring, screenshots, reports + CSV/PDF export, employees |
| 4 | Business | Billing, approvals, notifications, integrations, communication, settings (org/monitoring/tracking/features), security, audit logs |
| 5 | Finalize | AI Center, anomaly detection, remote support, desktop agents, help, marketing site, guided tour, accessibility, test pass, polish |

**MVP = Phases 1–2** (auth, RBAC, dashboard, tasks, time tracking) — the demoable core.

---

## 7. Open items (not blocking scaffold)

- Flesh out data-model interfaces beyond TDD stubs (Task, Activity, Screenshot, Timer are minimal).
- Confirm how far simulated-surveillance UI should go (ethics/positioning) before Phase 3.
- Performance targets: Lighthouse >90 across the board (TDD §23); page load <2s.
