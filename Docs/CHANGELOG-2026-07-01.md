# Changelog — 2026-07-01

Page-by-page summary of everything that changed today. Each entry lists the
user-facing **page/area**, the **files** touched, and the **edits** made.

> All changes below are in the **working tree (uncommitted)** on branch
> `sandhiya/redesign` — there are no new commits yet (HEAD is still `a0c40d1`).

## Changed files (working tree)

| File | Area |
|------|------|
| `app/page.tsx` | Landing — Enterprise & Security |
| `modules/time-tracking/components/timer-hero.tsx` | Live timer |
| `modules/time-tracking/use-time-logger.ts` *(new)* | Live timer (shared hook) |
| `stores/timer.store.ts` | Timer state |
| `modules/time-tracking/components/personal-time-view.tsx` | Time Tracking page |
| `modules/time-tracking/components/weekly-hours-chart.tsx` | Weekly hours chart |
| `lib/mock-time.ts` | Mock data |
| `app/(app)/settings/layout.tsx` | Settings rail |
| `modules/settings/components/account-security-settings.tsx` | Security page |
| `lib/rbac.ts` | Access logic |
| `modules/profile/components/profile-view.tsx` | Profile |
| `modules/profile/components/photo-editor.tsx` | Profile photo |
| `stores/auth.store.ts` | Auth state |

---

## Time Tracking — live timer (`/time-tracking`)

**Files:** `modules/time-tracking/components/timer-hero.tsx`,
`stores/timer.store.ts`, `modules/time-tracking/use-time-logger.ts` (new)

- **Switch task** support: the timer can move to another of the employee's
  tasks mid-session without stopping the clock (logs the outgoing segment, opens
  a fresh one) — backed by the store's `switchTask`.
- **Per-task clock:** the displayed time is now the **active task's own** total,
  not a single session clock — pausing/switching and returning resumes that
  task from where it left off (`taskSeconds`, keyed by task id).
- **Whole-day persistence:** a task's total now survives **Stop** and only
  resets at the calendar-day rollover (`dayStamp` + `seedDay`), seeded from
  today's logged entries — so restarting a task resumes from its full day total.
- **Today's sessions folded into the Task picker:** the picker now shows a
  *Today's sessions* group (per-task day totals, tap to resume/switch, the live
  task ticks) above an *All tasks* group for starting new work. The standalone
  sessions card + the separate Switch button were removed (the menu handles it).
- Extracted a shared **`useTimeLogger`** hook so the timer controls and the
  sessions list log/start/switch/pause/stop through one code path.

## Time Tracking — page layout (`/time-tracking`)

**Files:** `modules/time-tracking/components/personal-time-view.tsx`,
`modules/time-tracking/components/weekly-hours-chart.tsx`, `lib/mock-time.ts`

- **Removed** the 4-card KPI strip (Today / This week / Billable / Projects).
- **Reordered:** *Today's timesheet* now sits directly after the timer banner,
  and the weekly bar chart moved below it.
- **Weekly chart is now week-navigable:** prev/next arrows page through earlier
  weeks (next disabled on the current week, back up to 12 weeks); the header
  shows the relative label ("This week" / "Last week" / "N weeks ago"), the
  date range, and the week's total hours. Per-week data comes from a new
  deterministic `weeklyHoursFor(offset)` generator.
- Timesheet summary strip: **"Projects touched" → "Tasks tracked"**.

## Settings — employee interface (`/settings/*`)

**Files:** `app/(app)/settings/layout.tsx`,
`modules/settings/components/account-security-settings.tsx`, `lib/rbac.ts`

- New `isManagement(role)` helper (an Employee holds none of the management
  permissions) drives an **employee-only** trim of the settings:
  - **Billing** removed from the Account rail.
  - **"Login & security" → "Security"** (rail label + page title).
  - **"Two-factor authentication" → "Multi-factor authentication"** on the
    security page (card, setup dialog, toasts).
- Management interface is unchanged.

## Profile (`/settings/profile`)

**Files:** `modules/profile/components/profile-view.tsx`,
`modules/profile/components/photo-editor.tsx`, `stores/auth.store.ts`

- **Complete redesign,** role-gated: management keeps a rich view (identity +
  productivity + attendance); the **employee** view is identity + account
  details only — no productivity / attendance widgets.
- **Employee profile is editable from their side:**
  - One compact card: a large profile circle on the left, **Personal details**
    in a 2-column grid on the right (Full name, Email, Contact number, Date of
    birth, Location, Work mode), separated by a vertical divider.
  - **Organization details** (renamed from "Employment", lock only on the group
    label): Organization, Job title, Department, Team, Role, Employee ID, Member
    since — read-only / org-managed.
  - Editing happens in an **Edit profile dialog** (fields **+ profile-photo**
    upload/preview/remove inside the same dialog). Name/email persist to the
    auth store; the photo applies as a data URL.
- Added `updateUser(patch)` to the auth store; `PhotoEditor` now actually
  applies the chosen image when given an `onApply` handler.
- Fixed a layout bug where the profile was height-locked and clipped its own
  Attendance content with no scroll.

## Landing — Enterprise & Security (`/`)

**Files:** `app/page.tsx`

- Removed the **SOC 2 / GDPR / ISO 27001 / DPA** compliance tag pills from the
  bottom of the Enterprise & Security section (and the unused `COMPLIANCE`
  constant); the section now ends on the six security cards.
