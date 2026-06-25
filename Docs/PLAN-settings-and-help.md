# Plan — Settings pages & Help Center

Content and build plan for the Settings section and the Help Center. These are
currently `ComingSoon` stubs; this doc specifies what each page should contain so
they can be built consistently.

## Conventions (apply to every page below)

- **Frontend-only / simulated.** No backend. Saving shows a `toast.success`;
  state is local (`useState`) or persisted in a Zustand store (`wp-*` key) where
  it should survive reloads (e.g. Feature Management). Deterministic mock data
  only — no `Math.random()`/`Date.now()` in render.
- **Reuse:** `PageHeader`, `Card`/`CardHeader`/`CardContent`, `Switch`,
  `Input`, `Label`, `Checkbox`, `Button`, `Badge`, `Table`, `DropdownMenu`,
  `EmptyState`, `StatCard`. Forms = React Hook Form + Zod (no `Form` component —
  Base UI). Use design tokens; gate actions with `usePermissions().can(...)`.
- **Permissions:** all four `/settings/*` pages require **`settings:view`** to
  open and **`settings:manage`** to save/edit (show read-only + a notice when the
  user lacks manage — mirror the Reports "Lock" banner pattern).
- **Multi-section pages:** for pages with many groups, use the **Insights tab
  pattern** (`src/app/(app)/insights/layout.tsx` + `insights-tabs.tsx`) — a tab
  bar with nested routes — OR a single page with a sticky in-page section nav like
  the **Settings hub** (`src/modules/settings/components/admin-hub.tsx`). Prefer
  in-page sections for these (they're config, not destinations).
- **Settings landing** (`/settings`) already exists (Account + Administration
  hub). No change needed beyond linking new sub-pages (already wired via
  `ADMIN_SECTIONS`).

---

## 1. Organization  ·  `/settings/organization`  ·  `settings:view`/`manage`

**Purpose:** company profile and structure. Source of truth for departments,
teams, working hours used elsewhere.

**Sections (in-page, one Card each):**
- **Company information** — name, legal name, logo upload (simulated → preview),
  website, industry, company size, primary timezone. (RHF + Zod, "Save changes".)
- **Branding** — accent/logo preview; note that theme is in Account → Appearance.
- **Departments** — editable list (the 8 seeded departments); add/rename/remove
  (local state + toast). Reuse `Table` or chip list.
- **Teams** — teams grouped by department (from seed `TEAMS_BY_DEPT`); add/remove.
- **Locations** — office list (name, city, timezone). Simple table + add dialog.
- **Working hours** — per-weekday start/end + working days toggles; default tz.
- **Holidays** — list of dates + names; add/remove (table).
- **Policies** — overtime, PTO accrual, idle-counts-as-break (toggles + notes).

**Mock data:** reuse `DEPARTMENTS`/`TEAMS_BY_DEPT` from `scripts/seed.ts` (or a
small `src/lib/org.ts` constant) + `organization` from `lib/data.ts`.

**Done:** sections render, edits update local state with toasts, read-only without
`settings:manage`, responsive + light/dark, build green.

---

## 2. Monitoring  ·  `/settings/monitoring`  ·  `settings:view`/`manage`

**Purpose:** thresholds that drive Activity/Anomalies/Screenshots.

**Sections:**
- **Idle detection** — idle threshold (slider/number, mins), pause-timer-on-idle
  toggle, count-idle-as-break toggle.
- **Screenshots** — capture frequency (e.g. every N min), blur by default toggle,
  capture on idle toggle, retention days.
- **Productivity thresholds** — "productive ≥ %", "low activity < %" inputs that
  feed the activity tone bands used in Insights.
- **Daily work-hour rules** — expected hours/day, overtime alert threshold.
- **Alert thresholds** — long-inactivity minutes, productivity-drop %, burnout
  hours/day — each maps to an Anomaly type (cross-link to Insights → Anomalies).
- **Silent monitoring** — silent mode toggle + an explanatory/ethics note.

**Pattern:** a column of labeled setting rows (label + description + control),
grouped into Cards. Reuse the `ToggleRow` shape from the onboarding wizard.

**Done:** controls bound to local state, "Save" toast, gated by `manage`.

---

## 3. Application & URL rules  ·  `/settings/tracking-rules`  ·  `settings:view`/`manage`

**Purpose:** classify apps/sites as productive/neutral/distracting and allow/block.

**Sections (tabs work well here — Apps / Websites / Categories):**
- **Productivity categories** — list of categories with a productive/neutral/
  distracting label and color (reuse `CATEGORY_COLOR`/`CATEGORY_LABEL` from
  `lib/mock-insights.ts`).
- **Applications** — table of apps → category (editable via dropdown), tracked
  on/off. Seed from `APP_USAGE`.
- **Websites / URLs** — same as apps, seed from `URL_USAGE`; support domain
  patterns.
- **Allow list / Block list** — two lists; add/remove entries (input + chips).
- **Productivity scoring rules** — weights per category (how each rolls into the
  productivity score).
- **Monitoring exceptions** — people/teams excluded from tracking.

**Mock data:** `APP_USAGE`, `URL_USAGE`, `CATEGORY_*` from `lib/mock-insights.ts`.

**Done:** add/remove/reclassify with local state + toasts; gated by `manage`.

---

## 4. Feature management  ·  `/settings/features`  ·  `settings:view`/`manage`

**Purpose:** org-level on/off switches for whole modules.

**Content:**
- A list of modules with a `Switch` each: Time Tracking, Activity Monitoring,
  Screenshots, AI, Billing, Reports, Integrations, Communication, Approvals,
  Remote Support, Desktop Agents.
- Each row: icon + name + one-line description + Switch + (optional) "beta" badge.
- **Persist** to a `wp-features` Zustand store (version + migrate) so toggles
  survive reload. (Stretch: actually hide a disabled module's nav entry by having
  `getAccessibleNav` also check the feature flag — note this as a follow-up, not
  required for v1.)

**Done:** toggles persist; "Saved" toast; gated by `manage`.

---

## 5. Help Center  ·  `/help`  ·  `help:view` (everyone)

**Purpose:** self-serve help + simulated support. This is a *destination*, not
config — make it friendly and well-organized.

**Sections (top to bottom):**
- **Hero / search** — heading + a prominent search input that filters the
  articles/FAQ below (client-side filter; no real search backend).
- **Quick links / categories** — card grid: Getting started, Time Tracking,
  Monitoring, Reports, Billing, Security, etc. (icon + title + count). Clicking
  filters the article list.
- **Documentation / guides** — list of article cards (title, blurb, category,
  read-time). Static mock list in `src/lib/mock-help.ts`. Clicking opens an
  article view (a `Sheet`/`Dialog` with mock body, or a `/help/[slug]` route).
- **Video tutorials** — grid of thumbnail cards (use a gradient placeholder like
  the Screenshots faux tiles; play icon overlay; title + duration). Simulated.
- **FAQs** — accordion of question/answer (build a simple disclosure with
  `useState`, or add the shadcn `accordion` component).
- **Guided walkthroughs** — buttons that "start a tour" (react-joyride is already
  a dependency — optional; can just toast "Tour started" for v1).
- **Contact / support tickets** — a "Submit a ticket" form (subject, category,
  message via RHF + Zod → toast "Ticket submitted #1042"), plus a small list of
  the user's recent tickets (mock, with status badges open/pending/resolved).

**Mock data:** new `src/lib/mock-help.ts` — `HELP_CATEGORIES`, `HELP_ARTICLES`
(title, slug, category, excerpt, readMins), `FAQS`, `TICKETS`.

**Components:** `PageHeader`, `Card`, `Input` (search), `Badge`, `EmptyState`,
`Dialog`/`Sheet` (article + ticket), RHF+Zod (ticket form). Optionally add shadcn
`accordion` for FAQs.

**Done:** search filters content; FAQ expands; ticket form validates + toasts;
responsive + light/dark; build green.

---

## Suggested build order
1. Feature management (smallest, introduces the features store).
2. Monitoring + Application/URL rules (config patterns, reuse insights data).
3. Organization (most sections).
4. Help Center (new mock-help lib + ticket form + FAQ accordion).

## Verification (per page)
- `npm run build` passes (lint + typecheck).
- Open the page signed in as `owner@acme.test`; confirm sections render and
  saving shows a toast.
- Switch to a role without `settings:manage` (e.g. a custom role) → controls are
  read-only / hidden, with a notice. Help Center works for any signed-in user.
- No console errors; light + dark both correct.
