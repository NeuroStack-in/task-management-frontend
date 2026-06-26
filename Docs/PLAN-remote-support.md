# PLAN — Remote Support Center

## What the page is today

[src/app/(app)/remote-support/page.tsx](../src/app/(app)/remote-support/page.tsx) renders a
`ComingSoon` stub (phase 5). There is no `src/modules/remote-support/`.

Per **[SPEC.md §2](SPEC.md)** this section is deliberately scoped: the raw
"Reverse Shell Access" concept from PRD §10 is **dropped** — we build only an
**approval-gated, consent-aware, *simulated* remote-support UI**. Two permissions
already exist in [src/constants/permissions.ts](../src/constants/permissions.ts):

- `remote-support:view` — see the center (route-gated by `AuthGuard`).
- `remote-support:approve` — approve/decline session requests and end sessions.

## Goal

A **Remote Support Center** where IT/admins request a support session against an
employee's device, the request flows through **consent → approval → live session
→ audit**, and everything is logged. The privacy/governance framing is the point
(WorkPulse is "calm signal, not surveillance"): no silent access, every session
needs consent and leaves a trail.

Frontend-only, deterministic mock data, behind the mock-service seam — same
pattern as `mock-attendance` / `mock-insights`. No new dependencies.

## Page structure (one thin page → module view)

`PageHeader` ("Remote Support Center") + a **"Request session"** primary action,
then a KPI strip and three stacked sections. Build it role-aware like
[time-tracking-view.tsx](../src/modules/time-tracking/components/time-tracking-view.tsx):
approvers (`remote-support:approve`) see the approval queue + End-session
controls; view-only roles see status + history only.

- **Consent banner** — a quiet `bg-feature-tint` strip: "Sessions are
  consent-based and fully logged. Employees are prompted before any access."
- **KPI strip** (`StatCard`): Active sessions (featured) · Pending approval ·
  Sessions today · Avg duration.

### 1. Request + approval flow  *(governance core)*
- **Request dialog** (`Dialog`): pick employee/device (search over `users` from
  [src/lib/data.ts](../src/lib/data.ts)), a **reason**, and **requested actions**
  (checkboxes: View screen / File transfer / Run diagnostics) → React Hook Form +
  Zod (mirror the ticket form in [help-page.tsx](../src/modules/help/components/help-page.tsx)).
- Submitting creates a request with status `awaiting-consent`, then (mock timer)
  `pending-approval`, surfaced in a **Pending queue**.
- **Approvals queue** — reuse the master–detail pattern from
  [approvals-view.tsx](../src/modules/approvals/components/approvals-view.tsx):
  request list + a review panel with **Approve / Decline** (gated by
  `remote-support:approve`; view-only sees "Awaiting approver"). Approving moves
  it to **Active**; declining → history as `declined`.

### 2. Active session console
- For each live session (simulated): connected device, employee, **elapsed time**
  (1s tick like [global-timer.tsx](../src/components/layout/global-timer.tsx)),
  the **granted actions**, and a **running action log** ("Viewed screen",
  "Pulled diagnostics.zip") that appends on a mock interval.
- A **faux screen-share** surface (reuse the `FauxCapture` idea from
  [screenshots-tab.tsx](../src/modules/insights/components/screenshots-tab.tsx))
  with an "End session" button → writes a completed record to history + toast.
- Consent reminder inline: "Employee consented at HH:MM. They can revoke anytime."

### 3. Session history + audit
- Searchable/filterable list of past sessions: employee · device · operator ·
  duration · actions taken · outcome (`completed` / `declined` / `expired`) ·
  timestamp. Filter pills by outcome; **CSV export** via `papaparse` (same idiom
  as the attendance log / reports). This is the audit trail.

### 4. Connected devices panel
- Devices a session can target: online/offline dot, last-seen, OS + agent
  version, owner. A per-device **"Request session"** entry that opens the request
  dialog pre-filled. Overlaps conceptually with Desktop Agents — keep it a
  *picker* here, link out to `/agents` for device management (no duplicate
  management UI, per the no-duplicate-pages rule).

## Mock data — `src/lib/mock-remote-support.ts` (new)

Deterministic, server-safe (no `Date.now()`/`Math.random()` in module scope),
people drawn from `users`:

- `SupportDevice` — `{ id, user, os, agentVersion, online, lastSeen }`.
- `RemoteSession` — `{ id, user, device, operator, reason, actions[], status, requestedAt, startedAt?, durationSec?, log: {time,text}[] }`.
- `SESSIONS` seed: 1–2 active, 2 pending/awaiting-consent, ~6 history rows across
  outcomes. `STATUS_META` (label + badge token) and `ACTION_LABEL` maps.
- Helper `formatDuration` already exists in [src/lib/format.ts](../src/lib/format.ts) — reuse.

## Files

- **New** `src/lib/mock-remote-support.ts` — types + seed + metadata.
- **New** `src/modules/remote-support/components/remote-support-view.tsx` — root
  view (`"use client"`): consent banner, KPIs, request dialog, approval queue,
  active console, history, devices.
- (Optional split) `request-dialog.tsx`, `active-session-card.tsx` if the root
  grows large — keep pages thin.
- **Modify** [src/app/(app)/remote-support/page.tsx](../src/app/(app)/remote-support/page.tsx)
  — replace `ComingSoon` with `<RemoteSupportView />`.

## Reuse (don't re-implement)

- Permissions: `usePermissions().can("remote-support:approve")` — [use-permissions.ts](../src/hooks/use-permissions.ts).
- Shapes/patterns: `StatCard`, `PageHeader`, `EmptyState`, `Card`, `Dialog`,
  `Badge`, `Avatar`, `Input`, `Button`, `Switch`; the **master–detail** approvals
  layout; the **live-timer** tick; the **faux capture** surface; the CSV-export
  idiom; RHF+Zod form from `help-page.tsx`.
- Toasts via `sonner`. Palette-safe tokens only (status = success/warning/
  destructive/primary; `bg-primary`→`text-primary-foreground`).

## Verification

1. `npm run dev`; log in as `owner@acme.test` (wildcard — has approve).
2. **Request** a session (device picker + actions) → appears in Pending; **Approve**
   → moves to Active; **Decline** another → lands in History as declined.
3. **Active console**: elapsed time ticks, action log appends, **End session** →
   History as completed + toast.
4. **History**: filter by outcome, search by name, **Export CSV** downloads.
5. **Permission check**: a role with `remote-support:view` but not `:approve`
   sees status/history but no Approve/Decline/End controls.
6. `npm run build` (lint + typecheck) clean; no console errors.
