# WIRING-PLAN.md — Connecting the frontend to the live backend

> **Written 2026-07-17.** The execution order for migrating this app off mock data onto the deployed
> API. Companion to [`BACKEND-ALIGNMENT.md`](BACKEND-ALIGNMENT.md) (which maps *gaps* per SPEC
> section); this doc answers **"what do I wire next, and why that."**
>
> **Authority:** the backend's [`WorkPulse-LLD.md`](../../backend/WorkPulse-LLD.md) defines behaviour
> and **wins on any conflict**. Route truth is `backend/infra/stacks/contexts/<ctx>.py` — that registry
> is what is actually deployed.

## Where we actually are (verified against the live `dev` stack)

| | |
|---|---|
| Unique routes deployed to API Gateway | **86** |
| Routes the frontend calls | **4** — `/v1/org/entitlements`, `/v1/projects`, `/v1/me/timesheet/today`, `/v1/me/timesheet` |
| Module services that exist | **3** committed (`auth`, `projects`, `time-tracking/timesheet`) for ~20 modules — **a 4th (`notifications`) is uncommitted in the tree**; see Phase C |
| Files importing a `lib/mock-*.ts` | **49** |
| Files importing `lib/data.ts` | **25** |

**Auth is real** — a genuine Cognito SRP exchange; the ID token carries `tenant_id`, the `perm`
bitset, `is_owner`, `scope`, `custom:roleId`. `lib/api.ts` is a sound client (fresh token per call,
envelope unwrapping, typed `ApiError`). **The foundation is done. The data layer is barely started.**

## The one structural problem — read this before picking a task

**The documented seam (`component → module service → lib/data.ts`) does not exist for most modules.**
Pages and Zustand stores import `@/lib/data` and `@/lib/mock-*` **directly** — `dashboard/page.tsx`,
`employees/page.tsx`, `projects/page.tsx`, `stores/tasks.store.ts`, `stores/projects.store.ts`, …

So **wiring a module is two jobs, not one**:

1. **Introduce `modules/<m>/services/<m>.service.ts`** and route the page/store through it (pure
   refactor, no behaviour change, mock still behind it).
2. **Swap the service's body** from `lib/mock-*` to `apiFetch`.

**Do them as separate commits.** Step 1 is safe and reviewable; step 2 is where shapes change. Doing
both at once produces a diff nobody can review, which is how the `Project` shape mismatch below gets
missed.

> **The server's shape wins.** It is deliberately leaner than the mock's — `projects.service.ts`
> already documents this (`lib/data.ts` exposes a richer `Project` than `/v1/projects` returns).
> **Reshape the frontend; never reshape the API to match a fixture.** Where the mock has a field the
> server doesn't, the honest options are: drop the UI, or add it to the LLD as real work — **not**
> keep a mock field alive next to real data.

---

## Order of work

Sequenced by **dependency and blast radius**, not by page count.

### Phase A — `identity`: permissions & roles *(do this first)*

**Routes:** `GET /v1/permissions` · `GET|POST /v1/roles` · `PATCH|DELETE /v1/roles/{id}` ·
`POST /v1/roles/{id}/clone` · `PUT /v1/users/{id}/role`

**Why first — this is the highest-risk drift in the codebase, and it is already drifting.**
`constants/permissions.ts` + `constants/roles.ts` + `roles.store.ts` are a **hand-maintained parallel
copy** of a model the server owns (`crates/wp-contracts/src/permissions.rs`). The root `CLAUDE.md`
records a **live, known divergence**: the server renamed `TimeTrackingEdit` → **`TimeTrackSelf`**
(*"I personally track my own time"*, **not** "may edit time entries" — LLD §4 forbids editing time
for everyone, so no such permission exists), while the frontend still gates on the id
`"time-tracking:edit"`. Every day this stays hand-copied, the gap widens silently.

Wiring `GET /v1/permissions` makes the server the source and **closes that class of bug permanently**.
The root `CLAUDE.md` already earmarks this as *"tracked with the `list_permissions/` port."*

**Watch for:**
- **`canAccess` stays UX-only.** The server gates on the bitset and is the real boundary. Wiring this
  does **not** make the UI a security control; don't let it read as one.
- **Guard 2 compares `PermSet::privileges()`, not raw sets** (LLD §13) — raw comparison would make
  the Employee role ungrantable by anyone. If you port role-granting UI, mirror that rule.
- Contributor-only bits (110–119) are **not** granted by `"*"`/owner. The wildcard is not "all bits".

### Phase B — `workforce`: employees, departments, teams *(20 routes)*

**Routes:** `GET /v1/employees` · `GET|PATCH /v1/employees/{id}` · deactivate/reactivate ·
`POST /v1/employees/invites` (+ revoke/resend) · `GET|POST|PATCH|DELETE /v1/departments` ·
`GET|POST|PATCH|DELETE /v1/teams`

**Why second:** the directory is what everything else references (approvals name an approver,
payroll names an employee, attendance names a person). Wiring it after A means the employee rows
arrive already carrying server-truth role ids.

**This also unblocks a known hole:** there is **no `/me` endpoint**, so job title / department / team
are empty today (the token doesn't carry them). `GET /v1/employees/{id}` is where they come from.

**Files:** `employees/page.tsx`, `employees/[id]/page.tsx`, `invite-dialog.tsx`, `mock-org.ts`.

### Phase C — `notifications` (5) 🚧 **IN PROGRESS** + `leave-approvals` (11)

**Routes:** `GET /v1/notifications` (+ `{id}/read`, `read-all`, `prefs`) · `GET /v1/leave/types` ·
`GET /v1/me/leave/balances` · `GET|POST /v1/me/leave/requests` · cancel · `GET /v1/approvals` ·
`POST /v1/approvals/decide` · `bulk-decide`

> 🚧 **`notifications` is being wired right now — uncommitted in the working tree** as of 2026-07-17
> (`modules/notifications/services/notifications.service.ts`, `use-notifications.ts`,
> `notifications-menu.tsx`, `notifications-center.tsx`). **Check `git status` before starting it.**
> It is a good model for the rest of this plan: a real service on `apiFetch`, a single hook shared by
> the bell and the Center, an in-flight guard so two consumers don't double-fetch, optimistic
> mark-read reconciled by re-reading on failure, and — correctly — **an empty bell on error rather
> than falling back to mock data** (*"showing demo notifications on a real account would invent
> events that never happened"*). **Copy that posture: never fall back to mock on a real account.**
>
> ⚠️ **What it is still missing — the freshness convention.** `use-notifications.ts` fetches **once on
> mount**: no polling, no `If-None-Match`, no pause-when-hidden. The bell therefore never updates
> until a remount. This is precisely the gap HLD §3 *Freshness* exists to close, and the hook is
> already the right shape to hold it — **add the 30 s ETag poll there**, which is the single
> abstraction the deferred WebSocket migration will later swap. Don't add a `setInterval` to the bell
> component.

Both are self-contained and fully built server-side. `leave-approvals` has no in-flight work.

**Files:** `mock-approvals.ts`, `mock-notifications.ts`, `leave-requests.store.ts`,
`notification.store.ts`.

### Phase D — `payroll-billing` (9) + `identity` settings/audit/security

**Routes:** `GET|POST /v1/payroll/runs` · `GET /v1/payroll/runs/{period}` · finalize ·
`PUT /v1/payroll/comp/{user_id}` · `GET|PUT /v1/payroll/deductions` · `GET /v1/billing` ·
`POST /v1/billing/change-plan` · `GET /v1/audit` · `GET /v1/security-events` ·
`GET /v1/me/sessions` · `POST /v1/users/{id}/mfa/reset` · `PATCH /v1/org` · `GET|PUT /v1/org/rules` ·
`GET|PUT /v1/me/appearance` · `GET|PUT /v1/me/dashboard-layouts/{type}` · `GET /v1/search`

**Payroll is field-masked server-side** (LLD): Finance/CTO see payroll fields, a plain Manager gets
them **stripped in the serving Lambda**. Expect fields to be **absent, not null** — the UI must
handle a masked response without rendering an empty money column as `$0`.

**Files:** `mock-payroll.ts`, `mock-billing.ts`, `mock-audit.ts`, `mock-security.ts`,
`security-center.tsx`, `organization-tab.tsx`, `ownership-settings.tsx`, `sidebar-search.tsx`.

### Phase E — `assistant` (2)

`POST /v1/assistant/messages` · `GET /v1/assistant/threads`. Behind the PII gate. Low
dependency — can move any time after A.

---

## Blocked — do not start these; there is nothing to call

| Module / mock | Blocked on |
|---|---|
| **Insights** — activity, screenshots, reports, scoring, anomalies (`mock-insights.ts`, `mock-metrics.ts`, `mock-monitoring.ts`, `activity-tab.tsx`) | **The `insights` crate does not exist.** Also needs the desktop agent for real data — and `ingest` currently **counts activity rollups + screenshots as deferred and drops them** (`fold_batch/mod.rs`). This is the largest mock surface and the furthest from real. |
| **Agents / fleet list** (`mock-agents.ts`) | Only `GET /v1/agent/config` is deployed. `fleet_list` / `device_detail` / `update_policy` are Phase 4, unbuilt. |
| **Attendance** calendar & personal views (`mock-attendance.ts`, `attendance-view.tsx`, `attendance-log.tsx`) | Only the **2 timesheet routes** exist. `personal_attendance`, `attendance_calendar`, `attendance_day_detail` are unbuilt — though `attendance_close` **does** run and GSI3 keys **are** written, so the reads are near. |
| **Inbox** (`mock-inbox.ts`) | **DEFERRED** product-wide (LLD). Also the likely trigger for the deferred WebSocket migration — see HLD §3 *Freshness*. |
| **Integrations** (`mock-integrations.ts`) | Deferred (OAuth marketplace). |
| **Locations / geofence** (`mock-locations.ts`, `geofence.store.ts`) | No backend context owns this. **Not in the LLD** — resolve scope before building anything. |
| **Help** (`mock-help.ts`) | Partially: `workforce` serves `/v1/support/tickets` (+ replies). The help *content* has no backend. |

**Keep the mock for these.** A blocked module is not a bug — it is honest scaffolding. What *is* a
bug is a module that looks wired and isn't.

---

## Definition of done, per module

1. A `modules/<m>/services/<m>.service.ts` exists and **nothing outside it** imports `lib/mock-*` or
   `lib/data` for that module.
2. Types come from the **server's** response shape, not the mock's.
3. `ApiError` is handled: **401** → session gone (re-auth), **403** → server denied (the real gate —
   surface it, don't silently hide the UI), **409** → stale write, refetch and reapply.
4. Polled reads send `If-None-Match` and go through the **one** subscription abstraction — never a
   `setInterval` + `fetch` in a component (HLD §3 *Freshness*, migration seam).
5. `npm run build` green (it runs lint + typecheck — the real gate; the test suite is scaffolded but
   not wired).
6. Verified against the **live `dev` stack** as a real seeded user (`owner@acme.test`), not a fixture.

## Two things to fix on the backend side while doing this

Neither blocks Phase A–E, both are recorded in `backend/docs/AGENT-SUPPORT-PLAN.md`:

- **`GET /v1/me/tasks` returns no titles** — `{id, project_id, status, due}` only. A task picker
  rendering "p1 / k1" is unusable. Needs the `BatchGetItem` title read.
- **`TimeEntry.description` is written as `""` on every entry** — the envelope omits it while LLD §4
  mandates it. The timer fold is **live**, so this is silent data loss today.
