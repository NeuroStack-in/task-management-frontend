# Handoff — Time Tracking & Projects

Build guide for the **Time Tracking** and **Projects** sections of WorkPulse.
Read this top to bottom once, then keep it open while you build.

## 0. Context (read first)

- **WorkPulse** is a workforce activity & productivity SaaS. **Phase 1 is
  frontend-only**: no backend. Everything runs on **mock data + simulated
  workflows**.
- Canonical specs (read the relevant sections):
  - [SPEC.md](SPEC.md) — single source of truth (§3 routes, §5 data layer, §6 phasing).
  - [PAGES.md](PAGES.md) — §5 Time Tracking, §7 Project Management feature lists.
  - [DESIGN.md](DESIGN.md) — visual language (Graphite & Indigo, the pulse motif).
  - [../CLAUDE.md](../CLAUDE.md) — architecture + conventions (the "load-bearing patterns").
- **Design rule:** original identity, do **not** model UI on any other product.

## 1. Ground rules (non-negotiable conventions)

These already hold across the codebase — match them:

1. **Mock service seam.** Data flows `component → module service → lib/data.ts → JSON`.
   Components must **never** import JSON directly. Add latency with `delay()` from
   [src/lib/data.ts](../src/lib/data.ts). This is the boundary a real API drops into later.
2. **Deterministic data only.** No `Math.random()` / `Date.now()` in render paths
   or in seed output. Derive values from stable inputs (see
   [src/lib/mock-metrics.ts](../src/lib/mock-metrics.ts) and
   [src/lib/mock-time.ts](../src/lib/mock-time.ts) for the pattern). The seed
   script is `faker.seed(...)`-pinned.
3. **RBAC gates the UI.** Use `usePermissions()` →
   `can("<module>:<action>")` to gate buttons/actions, not just routes
   ([src/hooks/use-permissions.ts](../src/hooks/use-permissions.ts)). Routes are
   already guarded by `AuthGuard` via `permissionForPath`.
4. **Server vs client.** Server components must not import value exports from
   `"use client"` modules. Keep shared helpers in non-client `lib/` files.
   Interactive views are `"use client"`.
5. **Design tokens, not hardcoded colors.** Use `bg-primary`, `text-muted-foreground`,
   `bg-feature`, `--chart-1..5`, `--success/--warning/--positive/--negative`. Cards
   use the `Card` primitive; reuse `StatCard`, `Sparkline`, `Gauge`, `DeltaPill`,
   `PageHeader`, `EmptyState`.
6. **shadcn = Base UI (not Radix).** Gotchas:
   - Use the **`render` prop**, not `asChild`.
   - `Button` rendering a link needs **`nativeButton={false}`**:
     `<Button render={<Link href="/x" />} nativeButton={false}>…</Button>`.
   - `TooltipProvider` takes **`delay`**. There is **no `Form` component** — use
     React Hook Form + Zod directly (see the auth forms for the pattern).
7. **Gate = `npm run build`** (runs lint + typecheck). Keep it green. Light **and**
   dark must both look right; everything responsive to mobile.

## 2. Stack already available (don't add deps without reason)

TanStack Table (`@tanstack/react-table`) · Recharts · **dnd-kit** (kanban/board
reorder — see usage in
[src/modules/dashboard/components/customizable-dashboard.tsx](../src/modules/dashboard/components/customizable-dashboard.tsx)) ·
React Hook Form + Zod · papaparse (CSV) · jspdf + html2canvas (PDF) · sonner (toasts) · Faker (dev/seed).

> ⚠️ **FullCalendar is listed in the PRD but NOT installed.** For the Tasks
> "Calendar view", either build a lightweight month grid with our primitives or
> get sign-off before adding a calendar dependency.

## 3. Reusable building blocks (use these, don't reinvent)

| Need | Use | Path |
|------|-----|------|
| Page title + actions | `PageHeader` | `src/components/shared/page-header.tsx` |
| KPI tile (label/value/icon/delta/trend/featured) | `StatCard` | `src/components/shared/stat-card.tsx` |
| Mini pulse line | `Sparkline` | `src/components/shared/sparkline.tsx` |
| Semicircle gauge | `Gauge` | `src/components/shared/gauge.tsx` |
| ±% pill | `DeltaPill` | `src/components/shared/delta-pill.tsx` |
| Empty / coming-soon | `EmptyState`, `ComingSoon` | `src/components/shared/` |
| Tables | `Table*` primitives, or TanStack Table for sort/filter/paginate | `src/components/ui/table.tsx` |
| Tabbed section (nested routes) | copy the **Insights** pattern | `src/app/(app)/insights/layout.tsx` + `src/modules/insights/components/insights-tabs.tsx` |
| Drag-to-reorder | dnd-kit | see `customizable-dashboard.tsx` |
| Global timer state | `useTimerStore` | `src/stores/timer.store.ts` |
| Duration/hours formatting | `formatDuration`, `formatHours` | `src/lib/format.ts`, `src/lib/mock-time.ts` |

---

## 4. TIME TRACKING — extend the existing v1

**Route:** `/time-tracking` · **Permissions:** `time-tracking:view` (gate edits with
`time-tracking:edit`, approvals with `time-tracking:approve`).

### What already exists
- Page: [src/app/(app)/time-tracking/page.tsx](<../src/app/(app)/time-tracking/page.tsx>)
- Module: `src/modules/time-tracking/components/` — `time-tracking-view.tsx`
  (KPI strip + weekly chart + "Today at a glance" + today's timesheet table),
  `timer-hero.tsx`, `weekly-hours-chart.tsx`.
- Mock data + helpers: [src/lib/mock-time.ts](../src/lib/mock-time.ts) —
  `TimeEntry`, `TaskOption`, `TASK_OPTIONS`, `TODAYS_ENTRIES`, `WEEKLY_HOURS`,
  `summarize()`, `formatHours()`.
- Global timer store: `useTimerStore` (start/pause/resume/stop/`switchTask`/`elapsed`).

### What to build (SPEC §5 / PAGES §5)
> Note: `TimerHero` already reads `useTimerStore`, so the page timer and the
> navbar `GlobalTimer` are already one source of truth. The task picker currently
> calls `start()`.
- [ ] **Task switching** — make the picker call `switchTask()` (store already
      supports it) so changing task mid-session keeps the clock running and closes
      the previous segment, instead of restarting.
- [ ] **Daily & weekly timeline** — a visual timeline of segments (not just the
      table). A horizontal track per day is fine; reuse tokens + `formatDuration`.
- [ ] **Timesheets** — weekly timesheet grid (days × projects/tasks), totals per
      day/row. TanStack Table is a good fit.
- [ ] **Manual entries** — "Add entry" dialog (RHF + Zod): task/project, start,
      end, billable. Append to state via the existing `onLogged` pattern.
- [ ] **Approval requests** — submit a timesheet/manual entry for approval
      (simulated); show status (pending/approved). Ties into the Approvals section.
      Gate with `time-tracking:approve` for approver actions.
- [ ] **Auto-submission rules** + **Idle detection summary** — settings-style
      panels (can be lightweight/simulated).
- [ ] **Export timesheet** — the button exists but is disabled; wire CSV
      (papaparse) and/or PDF (jspdf + html2canvas).

### Suggested structure
Keep `/time-tracking` as one page with sub-areas, OR (preferred if it grows)
promote to tabs using the **Insights pattern**: `/time-tracking/timesheet`,
`/time-tracking/timeline`, `/time-tracking/manual`, `/time-tracking/approvals`.
If you add tabs, register their per-tab permissions the same way `INSIGHTS_TABS`
does and have `permissionForPath` scan them (see §6).

---

## 5. PROJECTS — build from scratch (currently a stub)

**Route:** `/projects` (stub: [src/app/(app)/projects/page.tsx](<../src/app/(app)/projects/page.tsx>))
**Permissions:** `projects:view` (create → `projects:create`, manage → `projects:manage`),
task actions → `tasks:*`.

> **Important IA decision (already made):** the standalone Tasks page was
> **merged into Projects**. There is no `/tasks` route. Tasks live **inside
> Projects**, and Projects must include a **"My tasks"** view (the cross-project,
> assignee-filtered list) — make it prominent (sensible default for employees).
> See SPEC §3 note.

### What to build (SPEC §7 / PAGES §6–7)
**Projects portfolio (`/projects`)**
- [ ] Project list/grid: name, status, progress bar, team avatars, budget/health.
- [ ] Filters (status, team) + "New project" dialog (gate `projects:create`).

**Single project (`/projects/[projectId]`)** — tabbed (use the Insights pattern):
- [ ] **Overview / dashboard** — progress, members, recent activity, KPIs (`StatCard`).
- [ ] **Board (Kanban)** — columns To do / In progress / Done; drag with **dnd-kit**
      (reference `customizable-dashboard.tsx`). Gate edits with `tasks:edit`/`tasks:assign`.
- [ ] **List view** — TanStack Table (sort/filter), task rows.
- [ ] **Timeline** — simple Gantt-ish track (build with primitives; no new dep).
- [ ] **Calendar** — month grid (see FullCalendar warning in §2).
- [ ] **Team allocation**, **Budget tracking**, **Project analytics** — charts
      (Recharts) + tokens; can be lighter.
- [ ] **Task detail** — drawer/dialog: assignee, deadline, comments, attachments
      (simulated).

**My tasks** — cross-project list (filter by current user), available from the
Projects area (a tab or a top-level view).

---

## 6. Data layer & RBAC — concrete steps

### Add types
Create `src/modules/projects/types.ts` (or `src/types/`) — mirror the existing
style ([src/types/user.ts](../src/types/user.ts)):

```ts
export type ProjectStatus = "active" | "on_hold" | "completed" | "archived";
export interface Project {
  id: string; name: string; key: string; // e.g. "WP"
  status: ProjectStatus; progress: number; // 0–100
  leadUserId: string; memberIds: string[];
  department: string; budget: number; spent: number;
  startDate: string; dueDate: string; // ISO; convert relative→absolute in seed
}
export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";
export interface Task {
  id: string; projectId: string; title: string;
  status: TaskStatus; assigneeId: string | null;
  priority: "low" | "medium" | "high";
  dueDate: string | null; estimateHours?: number;
}
```

### Seed mock data
Extend [scripts/seed.ts](../scripts/seed.ts) (it already writes `organization.json`
+ `users.json`; it's built to grow). Add generators for **projects.json** (50+)
and **tasks.json** (500+) referencing existing `user.id`s and departments. Keep it
deterministic (Faker is seeded). Run `npm run seed`.

### Expose via the data seam
Add typed accessors in [src/lib/data.ts](../src/lib/data.ts) (e.g.
`export const projects = projectsJson as Project[]`) and module **services** that
wrap them with latency:

```ts
// src/modules/projects/services/project.service.ts
import { projects, delay } from "@/lib/data";
export const listProjects = () => delay(projects);
export const getProject = (id: string) =>
  delay(projects.find((p) => p.id === id) ?? null);
```

Components call the service (or read the typed accessor for server components).

### RBAC — already wired, just use it
Permissions exist in [src/constants/permissions.ts](../src/constants/permissions.ts)
(`projects:view|create|manage`, `tasks:view|create|edit|delete|assign`,
`time-tracking:view|edit|approve`) and are granted in
[src/constants/roles.ts](../src/constants/roles.ts). Nav entries for **Projects**
and **Time Tracking** already exist in
[src/constants/navigation.ts](../src/constants/navigation.ts).

- Gate UI actions: `const { can } = usePermissions(); … {can("projects:create") && <Button…/>}`.
- **If you add nested tab routes** (e.g. `/projects/[id]` tabs, or time-tracking
  tabs), add those routes' permissions to the guard: scan them in
  `permissionForPath` ([src/lib/rbac.ts](../src/lib/rbac.ts)) the same way
  `ADMIN_SECTIONS` and `INSIGHTS_TABS` are scanned — otherwise removing them from
  the sidebar/adding deep routes leaves them unguarded.

### Persisted stores
If you add a Zustand store with `persist`, namespace the key `wp-*` and set a
`version` + `migrate` (see [src/stores/dashboard.store.ts](../src/stores/dashboard.store.ts))
so older persisted state doesn't break.

## 7. Definition of done

- [ ] `npm run build` passes (lint + typecheck clean).
- [ ] Pages stay thin; logic in `modules/<name>/`. No JSON imported into components.
- [ ] All data deterministic; `npm run seed` regenerates stably.
- [ ] RBAC: actions gated with `can(...)`; new deep routes guarded in `permissionForPath`.
- [ ] Responsive (mobile → desktop) and correct in **light + dark**.
- [ ] No console errors (sign in as `owner@acme.test`, any password; click through).
- [ ] Uses shared primitives + tokens; matches DESIGN.md (incl. the pulse-line motif).

## 8. Run & verify

```bash
npm install
npm run seed     # regenerate mock data
npm run dev      # http://localhost:3000  → sign in as owner@acme.test (any password)
npm run build    # the gate (lint + typecheck + prod build)
```

Questions on conventions: skim [../CLAUDE.md](../CLAUDE.md) — it documents the same
patterns with file pointers.
