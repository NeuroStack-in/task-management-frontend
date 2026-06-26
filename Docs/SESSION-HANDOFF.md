# Session handoff — WorkPulse (landing, auth, theming, app features)

> Context dump so a fresh conversation can continue seamlessly. Covers what was
> built, where it lives, conventions, gotchas, and the in-progress task.

## Project at a glance

- **WorkPulse** — Workforce Activity & Productivity SaaS. **Phase 1 is frontend-only**
  (mock data via `src/data/*.json`, accessed through `lib/data.ts` + module services).
- **Stack:** Next.js 15 (App Router) · React 18.3 · TypeScript · Tailwind **v4** ·
  shadcn/ui on **Base UI** primitives (use `render` prop, not `asChild`; `Button`
  rendering a link needs `nativeButton={false}`) · Zustand · React Hook Form + Zod ·
  Recharts · dnd-kit · next-themes · jsPDF · Faker (seed). Path alias `@/* → ./src/*`.
- **Canonical docs:** `Docs/SPEC.md` (source of truth), `Docs/DESIGN.md`,
  `Docs/DESIGN-color-guide.md` (10 documented schemes).
- **Demo auth:** `useAuthStore().login(email, password)` matches an email in
  `users.json`; demo owner = **`owner@acme.test`** (any password). After login →
  `/dashboard`. Persisted to localStorage; `AuthGuard` waits for `hydrated`.

## ⚠️ Dev-server gotcha (important)

`npm run dev` and `npm run build` (and `rm -rf .next`) **both write to `.next`** and
clobber each other → stale-chunk **404/500** errors. **Never build or delete `.next`
while a dev server is running.** To recover: stop all `next dev` node processes,
`rm -rf .next`, then `npm run dev`. On Windows, `TaskStop`/Ctrl-C often leaves the
`next` child alive — kill `node.exe` procs whose CommandLine matches `*next*dev*`.
Validate code with `npx tsc --noEmit` (does NOT touch `.next`) instead of `npm run build`
when a dev server is live. CSS/component edits hot-reload fine.

## Theming system (CSS variables in `src/app/globals.css`)

- Tokens: `--background --foreground --card --popover --primary --primary-foreground
  --secondary --muted --accent --accent-foreground --destructive --success --warning
  --feature --feature-foreground --feature-tint --border --input --ring --chart-1..5
  --sidebar-*`. `@theme inline` maps `--color-*` → `var(--*)`.
- **Light base = warm/bright/low-contrast neutrals; dark base = neutral grey/black
  (Discord/WhatsApp style), brand only as accent.** Neutrals are SHARED; only brand
  tokens change per scheme.
- **Palette switcher** ([src/components/layout/palette-switcher.tsx]) sets
  `data-palette="<id>"` on `<html>`, persisted to localStorage key `wp-palette`.
  No-flash init script in `src/app/layout.tsx`.
- Current schemes: `indigo` (the `:root`/`.dark` default), plus `[data-palette]`
  blocks for `fireopal`, `teal`, `violet`, `sapphire`, `dusk`, `iron`.
- **Fire Opal** = Fire Opal `#EF6448` accent + Raisin Black `#202322`. (Being set as
  the app default — see in-progress task.)
- The project detail **hero/columns** and the **employee KPI chart** use `var(--feature)`
  so they follow the palette (gradient via `color-mix`).

## What was built this session (high level)

1. **Projects detail → full page** `/projects/[id]` ([project-detail-page.tsx]):
   palette-coloured hero, completion gauge, Tasks (completed/pending) + Team-size KPIs,
   **kanban board** with **Add task / Edit task popups** ([task-form-dialog.tsx]),
   **PDF report** ([report.ts], dynamic-imports jspdf), Project ID, team panels.
   Backed by in-memory **`stores/projects.store.ts`** and **`stores/tasks.store.ts`**
   (seeded from data; session-only, reset on reload).
2. **Projects index** ([projects-view.tsx]): Projects | Tasks filter, unified search
   (project/task/ID), removed "Portfolio" wording, "At risk" stat removed, "currently
   underway" label.
3. **Create/Edit project** ([project-form-dialog.tsx]): name, description, lead,
   **manager**, department, **team members multi-select**, deadline.
4. **Time Tracking** team view → **TimesheetGrid** ([timesheet-grid.tsx]): weekly grid
   (rows × Mon–Sun, totals, week nav), **By employee / By project**, **status filter**,
   **team (department) filter**, **EID/PID shown + ID search**, removable **filter tags**.
   Click a day cell or Total → **activity popup** ([timesheet-detail.tsx], `ActivityDialog`).
   Mock: `lib/mock-time.ts` (`buildTeamTimesheet`, `buildProjectTimesheet`).
5. **Employees** → per-employee page `/employees/[id]` ([employee-profile.tsx]):
   identity, clean label/value details + address (single header icon, no repeated pins),
   active projects, productivity KPIs, **dark feature-coloured area KPI chart** (Recharts),
   **project completion bars**, **AI insights** summary card. Synthesized contact fields
   deterministically; real project/task data. Table rows navigate to the page (slide-over removed).
6. **Dashboard:** customize toggles → **checkboxes**; attendance donut "On leave" →
   neutral `--muted-foreground` (was clashing blue).
7. **Color guide pass:** removed ad-hoc image palettes; built the 6 alt schemes from
   `Docs/DESIGN-color-guide.md`; proper dark-UI principles; then the warm-light /
   grey-dark restructure above; brought back Fire Opal.

## Marketing & auth surfaces (bespoke, separate from app theme)

- **`src/app/marketing.css`** — self-contained design system for the PUBLIC pages.
  Own tokens prefixed `--m-*` (dark base + `@media (prefers-color-scheme: light)`),
  all keyframes, `.m-*` utility classes (`.m-root .m-btn .m-field` floating-label
  inputs, `.m-card .m-social .m-aurora .m-word .m-reveal .m-marquee`, etc.).
  Accent currently indigo-violet `#7C6CF7` → being changed to **Fire Opal**.
- **Landing** `src/app/page.tsx` (`"use client"`): frosted nav (fixed; blur on scroll;
  flex `justify-between`, plain hamburger so `md:hidden` works — `.m-btn` display would
  otherwise override it), aurora hero w/ staggered word fade-up (`.m-word` has
  `margin-right` because inline-block collapses whitespace) + scale-on-scroll, product
  dashboard mock, logo marquee, stats, feature deep-dives (mini mocks), how-it-works,
  solutions, testimonials, **pricing**, FAQ accordion, multi-column footer.
- **Login** `src/app/(auth)/login/page.tsx` → `LoginExperience` ([login-experience.tsx]):
  centered scale-up card, floating labels, Google/Microsoft/SSO buttons, in-place
  forgot-password cross-fade. Wired to demo auth.
- **Signup** `src/app/(auth)/register/page.tsx` → `SignupExperience` ([signup-experience.tsx]):
  split panel; **currently a 2-step (account → organization)** — being changed (see below).
- Shared: [src/modules/marketing/]{logo, reveal, brand-icons}.tsx; secondary auth pages
  (forgot/mfa/reset) wrapped in `AuthShell` ([auth-shell.tsx]); `(auth)/layout.tsx` is a
  passthrough.
- **Substitutions:** WebGL mesh → CSS aurora; GSAP pin → standard scroll-reveal.

## 🔧 In-progress task (this request — implement after this doc)

1. **SSO buttons** on signup must open an **account-picker dialog** (faux Google/Microsoft
   chooser) before proceeding.
2. **Organization setup is NOT step 2** — move it into a **modal dialog** opened after the
   account is created (email submit OR SSO pick), as a **4-group wizard**:
   1) Organization details (name, company size, …),
   2) Your role / username / profile,
   3) Workspace purpose / preferences (e.g. time-tracking only vs productivity monitoring — what to enable),
   4) **Pricing** — **2 plans only: Pro and Max** (no freemium).
   Final → demo-login → `/dashboard`.
3. **Fire Opal everywhere:** set `--m-accent` (marketing) to Fire Opal `#EF6448`
   (warm mesh `--m-accent-2/3`; add `--m-on-accent` dark text since white-on-orange
   fails contrast), AND make **`fireopal` the default app palette** (layout no-flash
   script + switcher default).

## Useful facts

- Project `Project` type has optional `description`, `managerId`. Tasks: `Task` type.
- `lib/data.ts` exports `users, projects, tasks, organization`. `TODAY` anchor =
  `2026-06-23` (deterministic; avoid `Date.now()`/`Math.random()` in render paths).
- Stores: `auth, dashboard, timer, notification, ui, roles, projects, tasks`.
