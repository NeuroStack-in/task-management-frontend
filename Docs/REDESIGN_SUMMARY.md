# REDESIGN_SUMMARY.md — Meridian redesign (branch `sakthi-redesign`)

A UI **and** UX redesign of WorkPulse into a calm, minimal, enterprise-grade product for
managers, employees, HR, finance, payroll and billing users. Applied on top of the latest
`origin/main` (the full-featured build); `main` was never touched. Companion docs:
[REDESIGN.md](REDESIGN.md) (decision + standards), [REDESIGN_AUDIT.md](REDESIGN_AUDIT.md)
(per-module findings).

## Verification

- `npx tsc --noEmit` — **clean** (exit 0).
- `npm run build` (lint + typecheck + production build) — **passes**, all 51 routes generated.
- Live-verified pages: login, dashboard, projects, **project detail + kanban**, employees,
  payroll, approvals, insights, attendance, leave, billing, settings (see `.playwright-mcp/`).
- Commits: `381c955` (foundation) · `7ffd6a7` (Wave B per-module) · `fc9f09d` (Wave C polish).

## UX problems found (audit)

Loud arbitrary "hero" KPI blocks; scattered floating cards with heavy ~22px rounding and
shadows instead of a structured grid; a noisy topbar of competing pills (incl. a 13-theme
palette switcher in the chrome); **hardcoded/fake "AI" widgets** and pseudo-random charts posing
as live data; **duplicated widgets** across pages (active/inactive ring, attendance donut,
timesheet summary, project-detail rail, security events vs audit logs, forgot-password page vs
inline reset, onboarding vs OrgSetupModal); thin decorative meters; multi-row toolbars; a
**cramped 2-up kanban**; and inconsistent spacing/radius/icons.

## What was removed or consolidated

- **Dashboard:** cut 4 hardcoded widgets (AI Summary, Alerts, Deadlines, Upcoming Tasks);
  merged the duplicate active/inactive ring into the attendance donut; capped the KPI row at 4.
- **Projects:** removed hero gradient + blur blobs + raw project-ID chips; de-duped the
  right-rail (kept only Key + Manager); merged two toolbar rows into one filter bar.
- **Insights:** deleted the decorative `AiReportCard`; replaced fake 3×3 report mini-tables with
  a real sparkline + row/col badge; dropped the duplicate dashboard ring on Activity.
- **Time tracking:** cut the timesheet `SummaryCell` block (duplicated the stat cards).
- **Attendance:** removed the pseudo-random bar chart; removed the duplicate date picker.
- **Security:** cut the embedded events table (duplicated Audit Logs) → summary + link.
- **Billing:** collapsed the redundant current-plan tier card.
- **Auth:** `/forgot-password` now redirects to login's inline reset (one path); onboarding's
  duplicated Org step removed. **Landing:** merged double social-proof band, removed 2nd aurora,
  de-duped footer links. **Settings/Notifications:** removed 8 decorative icon squares.

## Design-system improvements

- **One theme:** *Meridian — Slate & Teal* (cool slate neutrals + a single petrol-teal accent)
  is the default; the existing palettes remain as opt-in. Accent used only for action / active /
  focus / links — never decoration.
- **Type:** IBM Plex Sans (UI + headings) + IBM Plex Mono (time/metrics) — grounded in IBM Carbon.
- **Structure:** hairline-bordered flat cards (`border` not shadow), tighter `--radius` (10px),
  squared status chips, flush bordered sidebar, de-pilled topbar, 8px spacing rhythm.
- **Tokens:** added `info`, **AI accent**, `primary-hover/soft`, `surface-elevated`,
  `border-muted`, a 3-level shadow scale, and a **motion system** (`--motion-fast/base/slow`,
  `ease-standard/enter/exit/emphasized`).
- **IA:** sidebar regrouped into **Work / Manage / Finance / Insights / Communication / Admin**
  (non-overlapping; admin/config stays inside the Settings hub).
- **Shared components** do the consistency work (Card, StatCard, PageHeader, Badge, Button,
  Table, EmptyState, and the new `AiInsight`).

## AI improvements

AI now appears only through one shared `AiInsight` component that answers **what it noticed →
why it matters → the action → the basis (verify)**, wired to real derived data:
- Dashboard: top-vs-bottom department productivity gap.
- Payroll: net-payout variance vs the previous period.
- Approvals: count of off-hours pending entries to review.
- Employee profile / Insights: derived summaries (no more "AI · Beta" on template strings).
Decorative/hardcoded AI cards and the always-on "Recognize top performers" rec were removed.

## Motion & accessibility

Subtle, fast, consistent: ~150ms color transitions, a per-route fade-up content entrance,
calmer meters (the infinite "sheen" removed). A global `prefers-reduced-motion` rule disables
movement. Status is never color-only (icons paired with color on every badge); icon-only buttons
have `aria-label`s; focus-visible rings throughout; clickable cards/rows have clear hover + focus
+ keyboard affordances.

## Key sizing fixes

- **Kanban enlarged:** all four columns visible (`lg:grid-cols-4`), board goes full-width below
  `xl`, `min-w-240px` readable cards with grab/drag/drop states.
- Thicker progress/balance bars, wider activity bars, right-sized gauges, larger theme previews.
