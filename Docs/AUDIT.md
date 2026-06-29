# WorkPulse — Application Audit & Remediation Plan

Full-app audit (RBAC, duplicate functionality, page/feature completeness & UX,
architecture/data robustness). Goal: a minimal, easy-to-use, professional,
industry-standard app where **no two places do the same thing**, **RBAC reflects
real-world role sense** (oversight roles ≠ contributors), and the **architecture
is consistent** (one source of truth per fact).

Severity: 🔴 critical · 🟠 high · 🟡 medium. Status: ☐ todo · ☑ done.

---

## 1. 🔴 RBAC — oversight roles behave like contributors

**Findings**
- The navbar `GlobalTimer` ([src/components/layout/top-navbar.tsx](../src/components/layout/top-navbar.tsx)) renders for **every** authenticated user.
- `TimeTrackingView` ([src/modules/time-tracking/components/time-tracking-view.tsx](../src/modules/time-tracking/components/time-tracking-view.tsx)) shows the personal tracker whenever `can("time-tracking:edit")`. Owner has `"*"` (wildcard auto-grants edit); Admin is granted `time-tracking:edit` explicitly → top roles get a personal timer they'll never use.
- Approval gate is too coarse: `approvals:approve` covers timesheet + manual-entry **and** leave; there is no `leave:approve`.
- Permissions defined but never enforced in UI: `dashboard:edit`, `agents:manage`, `remote-support:approve`.

**Fix**
- ☑ Introduce `CONTRIBUTOR_ONLY_PERMISSIONS = ["time-tracking:edit"]` in `constants/permissions.ts`. In `rbac.ts` `canAccess`, the wildcard must **not** auto-grant a contributor-only permission — only an explicit listing does. *(explicit grant still wins.)*
- ☑ Remove `time-tracking:edit` from **Admin** in `constants/roles.ts`. Only **Employee** keeps it.
- ☑ Gate the navbar timer: render `<GlobalTimer/>` only when `can("time-tracking:edit")`.
- ☑ `TimeTrackingView`: default to **team** view for oversight (`canApprove`); personal toggle only when both.
- ☑ Add `leave:approve` to the catalog; gate **leave** rows by `leave:approve`, others by `approvals:approve`; grant `leave:approve` to Admin/Manager/HR (Owner via wildcard).
- ☐ Dead permissions (`dashboard:edit`, `agents:manage`, `remote-support:approve`) — defer (low impact; gate or remove later).

**Acceptance:** ☑ Owner/Admin/HR/Manager see **no** personal timer (navbar or page); Employee does. Manager/HR/Admin can approve leave; a leave-only custom role can't approve timesheets. *(tsc + lint clean.)*

---

## 2. 🔴 Architecture — one fact, many independent mock sources

Same entity shows **different numbers** on different pages.

| Fact | Source A | Source B | Result |
|---|---|---|---|
| Attendance status | `personStatus()` in [mock-attendance.ts](../src/lib/mock-attendance.ts) (date-varying) | `attendanceFor()` in [mock-metrics.ts](../src/lib/mock-metrics.ts) (date-independent, diff thresholds) | Dashboard donut ≠ Attendance page |
| Hours / billable / idle | `buildTeamTimesheet()` ([mock-time.ts](../src/lib/mock-time.ts)) | `EMPLOYEE_TIME` ([mock-insights.ts](../src/lib/mock-insights.ts)), `mock-payroll`, dashboard `scope*7.4` | A person's hours differ on Time Tracking vs Reports vs Payroll vs Profile |
| Department attendance | **hardcoded** `DEPARTMENT_ATTENDANCE` | computed from `users` | Never matches |
| Headcount | seeded users **+** `employees.store` (custom) | seeded users **only** (payroll/attendance) | A created employee vanishes from payroll/attendance |

**Fix**
- ☑ **Attendance status** — `dayRecordFor(id, y, m, d)` in [mock-attendance.ts](../src/lib/mock-attendance.ts) is now the single source. `attendanceFor()` ([mock-metrics.ts](../src/lib/mock-metrics.ts)) and `orgDayCounts()` delegate to it; the dead `personStatus()` is removed. Dashboard donut now agrees with the Attendance page and payroll. *(Deliberately shifts some displayed numbers.)*
- ☑ **Hours / billable / idle** — new [employee-metrics.ts](../src/lib/employee-metrics.ts) (`employeeWeek(id)`) is the single source. `buildTeamTimesheet()` ([mock-time.ts](../src/lib/mock-time.ts)) and `EMPLOYEE_TIME` ([mock-insights.ts](../src/lib/mock-insights.ts)) derive from it; payroll already derives hours from `dayRecordFor`. A person's tracked/idle/billable now match on Time Tracking vs Reports.
- ☐ **DEFERRED (C)** — Compute `DEPARTMENT_ATTENDANCE` from the org instead of hardcoding. Still hardcoded with stale department names; computing it means grouping `users` by department and rolling up `dayRecordFor`. Low blast-radius cosmetic; revisit with §5.
- ☐ **DEFERRED (D)** — Thread the custom `employees.store` list into payroll & attendance headcount. Architecturally blocked: payroll/attendance totals are computed in server-safe `lib/*` modules, but custom employees live only in a client `localStorage` Zustand store the server can't see. Proper fix needs a client `useWorkforce()` accessor (seeded + custom) and moving those rollups client-side — a structural change, not a tweak. Custom employees already appear in the Employees table; they're excluded from payroll/attendance rollups until this lands.

**Acceptance:** the same employee's attendance/hours match across every page. *(Custom-employee threading deferred — see D.)*

**Persistence robustness**
- ☑ Added `version: 1` + `migrate` to `timer`, `roles`, `leave-requests`, `employees`. `roles` scrubs permission ids not in the current catalog on hydrate (a stale custom role can't grant invalid access); `timer` resets to idle on bump; the rest carry their data forward. (`dashboard` already had it.)

---

## 3. 🟠 Duplicate surfaces

**Real duplicates to consolidate** (rest are legit Dashboard-aggregation / Reports-export / role-split):
- ☑ **Two Billing pages → one.** `/billing` (`BillingView`, the sidebar page) is now the single canonical surface. Deleted `/settings/billing` + `billing-settings.tsx` (a thinner duplicate whose buttons only toasted "Manage in the Billing Center"). The Settings rail keeps a **Billing** entry but links out to `/billing` (`external: true`).
- ☑ **Palette set unified to one source of two.** Created [`src/lib/palettes.ts`](../src/lib/palettes.ts) — the single `PALETTES` list, now just the two shipped schemes (Meridian default + Graphite & Indigo). Settings → Appearance is the **only** switcher. Removed the never-rendered `PaletteSwitcher` component **and** the ⌘K "Switch colour palette" cycle action that walked all 14. The other 12 `[data-palette]` blocks were stripped from `globals.css`; all 14 are catalogued in [DESIGN-color-guide.md](DESIGN-color-guide.md) for future revival. The pre-paint head script now normalises any stale `wp-palette` value to one of the two.
- ☑ Theme + palette now read/write a single state set from one place (Settings → Appearance); no competing navbar switcher remains.

---

## 4. 🟠 Dead / dishonest actions (kills "100% clickable / professional")

- ☑ Help → **Video tutorials** + **Guided walkthroughs** sections removed entirely (every action was a "coming soon" toast); **File attachments** button removed from the ticket form. Anchor-nav trimmed to Support / Browse / Articles / FAQs; unused icons + `VIDEO_TUTORIALS`/`WALKTHROUGHS` dropped. ([help-page.tsx](../src/modules/help/components/help-page.tsx))
- ☑ Inbox → **New message** button removed (was `toast("isn't wired up")`). ([inbox-view.tsx](../src/modules/communication/components/inbox-view.tsx))
- ☑ Integrations → **Request integration** button removed (it fired a false success toast). ([integrations-marketplace.tsx](../src/modules/integrations/components/integrations-marketplace.tsx))
- ☑ Billing → dishonest disabled controls replaced with honest **Phase 2** signals: the disabled "Update" payment button is now a "Phase 2" chip; the fake "Change plan" dropdown (all items disabled) is now a read-only plan catalogue marked "Phase 2". ([billing-view.tsx](../src/modules/billing/components/billing-view.tsx))
- ☑ Landing footer links + Signup **Terms / Privacy** were `href="#"` → converted to non-interactive text (no real pages exist to link). ([page.tsx](../src/app/page.tsx), [signup-experience.tsx](../src/modules/auth/components/signup-experience.tsx))

---

## 5. 🟡 UX consistency (professional polish)

Standardize the repeated idioms into shared primitives:
- ⏭️ **FilterBar** — **deliberately left as-is** (per request). Not touched.
- ☑ **DataTable controls** — unified into two shared primitives: [`TablePagination`](../src/components/shared/table-pagination.tsx) (one page-based "Showing a–b of n · Prev / x of y / Next" control) and [`SortableHead`](../src/components/shared/sortable-head.tsx) (one `aria-sort` header + sort glyph). Replaced three divergent hand-rolled paginations (Employees, Attendance log, Payroll) and two divergent sort-header helpers (`SortHead`/`SortIcon`) so every paginated/sortable table now reads and behaves identically.
- ☑ **EmptyState** — audited and already consistent: the shared [`EmptyState`](../src/components/shared/empty-state.tsx) is used by every list view that has an empty state (Employees, Attendance, Approvals, Leave, Audit, Agents, Payroll, Projects, Tasks, Integrations); no genuine hand-rolled empties remain. No change needed.
- ☑ **Page header + control bar** — audited: 18/18 feature pages use the shared [`PageHeader`](../src/components/shared/page-header.tsx) with a consistent convention (simple actions → `actions` prop; search/filter toolbars → row below the header). Already standardized; no change needed.

---

## Execution order
1. **§1 RBAC** (headline, self-contained).
2. **§2 data single-source-of-truth** + custom-workforce + store versioning.
3. **§3 Billing consolidation + palette unify.**
4. **§4 strip/relabel dead actions.**
5. **§5 standardize FilterBar / DataTable / EmptyState / header.**

Verify each step with `npx tsc --noEmit` + `npx next lint`. Don't run `npm run build` while `npm run dev` is live (clobbers the dev `.next` cache).
