# REDESIGN_AUDIT.md — Meridian enterprise design QA

> Findings from a full page/component audit of latest `main`, grouped by module, with the
> fix each will get. Drives the per-page simplification + AI-discipline + IA passes on the
> `sakthi-redesign` branch. Standard: enterprise SaaS (Carbon/Fluent/HubSpot/Linear
> discipline) — calm, minimal, operational, audit-ready. Companion to [REDESIGN.md](REDESIGN.md).

## Cross-cutting problems (fix everywhere)

- **Decorative / hardcoded "AI" filler.** Dashboard *AI Summary*, employee-profile *AI · Beta*,
  anomalies *"Recognize top performers"*, are static template strings posing as ML. → AI must
  follow **what it noticed → why it matters → action → how to verify**, or be cut. New shared
  `AiInsight` component enforces this; decorative AI is removed.
- **Duplicate widgets across pages.** Same data shown in many places: `ActiveInactiveRing`
  (Dashboard + Activity), attendance donut vs active/inactive ring, timesheet `SummaryCell`
  vs the StatCards above it, project-detail right-rail vs hero, profile dept/team shown twice,
  Security "recent events" vs Audit Logs, billing "current plan" card vs plan block, the
  standalone `/forgot-password` page vs login's inline reset, onboarding wizard vs OrgSetupModal.
  → **One home per feature**; others reference, not recreate.
- **Fake signal.** Hardcoded deltas (`delta={4}`), "Member since Jan 2024", pseudo-random
  attendance bars. → derive from data or remove.
- **Decoration over data.** Aurora blobs (landing ×2, project hero), report-card mini-tables,
  screenshot faux gradients, notification icon squares, scoring `WeightBar`, integrations
  "Popular" badge. → cut.
- **Thin meters.** `h-1.5` progress bars and `w-16/w-20` activity bars everywhere read as
  decoration. → min `h-2`, wider, or shared gauge/sparkline.
- **Multi-row toolbars.** Projects, team-timesheet, approvals, audit, attendance-log stack 2–3
  filter rows. → one consistent filter bar.
- **Visual inconsistency.** AuthShell uses a raw `Activity` icon not the `Logo`; onboarding uses
  shadcn while auth uses marketing components; segmented controls differ page to page. → unify.

## Work

**Dashboard (org).** Cut the four hardcoded widgets (*AI Summary, Alerts, Deadlines, Upcoming
Tasks*) — none carry live data and Deadlines/Tasks duplicate Projects. Merge the near-duplicate
*Attendance donut* and *Active/Inactive ring* into one. Cap KPI row at 4 + keep one featured
Productivity score. Add row-height cap so chart widgets don't grow into whitespace. Keep dnd.
**Dashboard (personal).** Drop the *Open Tasks*/*My Projects* KPI cards (the lists below already
show them); give *My Projects* a real width or card grid; widen the cramped *This Week* column.
**Time Tracking.** Give `TimerHero` real vertical breathing room (remove `py-1` squash); guard
picker min-widths. Cut the `SummaryCell` block (duplicates the StatCards). Widen `ActivityBar`.
**Projects list.** Merge the two toolbar rows into one filter bar; enlarge layout-toggle targets;
add an at-risk/over-budget KPI; drop raw project-ID chips; remove decorative card sparkline or
make it real. **Project detail — KANBAN (critical):** enlarge the board — `grid-cols-1
sm:grid-cols-2 lg:grid-cols-4`, widen the tasks area vs the right rail, larger readable task
cards (title, priority, due, owner). Remove hero blur blobs + raw ID badge. De-dup the right
rail (keep only Manager/Key/ID; drop Lead/Dept/Timeline/Status already in hero/KPIs).

## Manage

**Employees.** Add a Status column (it's filterable but invisible); widen the productivity bar;
remove the fake StatCard deltas. Wire the real `CreateEmployeeDialog` (it exists but is dead
code; the button opens the non-persisting InviteDialog). Fix `/employees/[id]`: relabel "AI ·
Beta" → "Summary", fix the wrong "Team /" breadcrumb, trim the 4 address fields.
**Attendance.** Remove the pseudo-random bar chart; reconcile the two competing date pickers
(calendar + log); thicken the detailed-cell progress bar. Split the confusing "Time off" stat
(leave vs absent). **Leave.** Thicken balance bars; flip the bar to read *remaining* (matches the
headline); add a manager approval cue or clarify self-service scope; tooltip long reasons.
**Approvals.** Stabilize the Actions column (no layout jump); add bulk approve; widen the cramped
Status/Amount columns; tooltip truncated titles. **Roles.** Taller/full-page permission editor
(the `42vh` scroll is too short); add a read-only view for system roles.

## Finance

**Payroll.** Serious financial table: add column sorting, pending-count emphasis, Employee
min-width so names don't truncate while numeric cols waste space. No playful visuals.
**Billing.** Status as Badges (not plain text); collapse the redundant "current plan" tier card;
make stub CTAs visibly disabled (not silent toasts).

## Insights

**Activity.** Plot the already-computed keyboard/mouse series (currently dropped); replace the
duplicate `ActiveInactiveRing` with a distinct cut; surface the buried app/website lists.
**Reports.** Replace decorative mini-tables with a row/col count badge or sparkline; separate the
card-preview vs export click targets; make "Export all" respect the active filter.
**Screenshots.** Pass the privacy-blur state into the Lightbox (privacy bug); tidy the 6-control
filter bar. **AI Insights/Anomalies.** Drop the hardcoded "Recognize top performers" rec; align
the short trend card height with the recommendations card; keep AI as triage signal with action.

## Admin (Settings)

**Settings shell.** Appearance lives here (good) — keep it as the *only* place for theme/palette
(removed from topbar). **Monitoring/Tracking-rules:** add a sticky sub-nav or accordion (six
long card stacks); drop the duplicate "count idle as break"; remove the `WeightBar`.
**Security:** cut the embedded "Recent Security Events" table (duplicates Audit Logs) → summary +
link; the stat cards are static, de-emphasize. **Notifications:** remove the 8 decorative icon
squares. **Audit Logs:** collapse the wrapping filter bar. **Integrations:** clearer
connected/disconnected states; drop "Popular" badge. **Agents:** the "Need update" stat
duplicates the warning banner — keep one. **Appearance:** larger theme previews; trim filler
descriptions.

## Auth / Marketing / Onboarding

**Login/Register:** label or caption the icon-only SSO buttons; show all validation errors, not
just the first; the floating "92% Team pulse" widget is fake — make it clearly illustrative or
remove. **Forgot-password page** is redundant with login's inline reset → redirect to `/login`.
**AuthShell** (mfa/reset/forgot): use the real `Logo`, not a raw `Activity` icon. **Onboarding
wizard** duplicates OrgSetupModal and its "+ Add another" invite button is dead → wire it or trim
the duplicated Org step; align it to the auth visual language. **Landing:** shrink to one
social-proof band (logos OR stats, not both); remove the second aurora; enlarge or replace the
unreadable kanban mock; de-dup footer "Privacy" links.

## Profile

Read-only today — at least allow display-name/title edit, or clearly mark read-only. Fix
hardcoded "Member since Jan 2024"; give Productivity vs Tasks distinct icons; remove the
dept/team text that duplicates Account details; right-size the oversized lone Attendance gauge.

## IA / navigation

Regroup the sidebar into non-overlapping enterprise buckets — **Work** (Dashboard, Time
Tracking, Projects), **Manage** (Employees, Attendance, Leave, Approvals), **Finance** (Payroll,
Billing), **Insights** (the tabbed hub), **Admin/Account** (Settings, Help) — no duplicate
entries; admin/config stays inside the Settings hub.
