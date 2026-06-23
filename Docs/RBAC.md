# RBAC — Roles & Permissions

How access control works in WorkPulse, the full permission catalog, and the
permission sets for **Organization Owner**, **Admin**, and **Employee**.

Source of truth in code:
- Catalog: [src/constants/permissions.ts](../src/constants/permissions.ts)
- Role grants: [src/constants/roles.ts](../src/constants/roles.ts)
- Access logic: [src/lib/rbac.ts](../src/lib/rbac.ts) · gate UI with `usePermissions().can(...)`

## How it works

- A permission id is `"<module>:<action>"` (e.g. `time-tracking:edit`).
- A role holds a list of permission ids, **or** the wildcard `"*"` which grants
  everything.
- `canAccess(role, "module:action")` returns true if the role has that id or `*`.
- The sidebar is generated from the role's permissions; routes are guarded by
  `permissionForPath`; gate buttons/sections with `can("...")`.

### Action meanings (convention)
| Action | Means |
|--------|-------|
| `view` | Open the section / read data |
| `edit` | Modify **own** records (e.g. log/edit your own time) |
| `create` / `delete` / `assign` | Create, remove, or assign records |
| `manage` | Full admin of that module (others' records, configuration) |
| `approve` | Review & approve others' submissions (oversight) |
| `export` | Download CSV/PDF |

---

## Full permission catalog

| Module | Permission | Description |
|--------|-----------|-------------|
| Dashboard | `dashboard:view` | View Dashboard |
| Dashboard | `dashboard:edit` | Customize Dashboard |
| Time Tracking | `time-tracking:view` | View Time Tracking |
| Time Tracking | `time-tracking:edit` | Log/edit **own** time entries (personal tracker) |
| Time Tracking | `time-tracking:approve` | Approve others' timesheets (oversight) |
| Tasks | `tasks:view` | View Tasks |
| Tasks | `tasks:create` | Create Task |
| Tasks | `tasks:edit` | Edit Task |
| Tasks | `tasks:delete` | Delete Task |
| Tasks | `tasks:assign` | Assign Task |
| Projects | `projects:view` | View Projects |
| Projects | `projects:create` | Create Project |
| Projects | `projects:manage` | Manage Project |
| Employees | `employees:view` | View Employees |
| Employees | `employees:manage` | Manage Employees |
| Attendance | `attendance:view` | View Attendance |
| Attendance | `attendance:manage` | Manage Attendance |
| Activity Monitoring | `activity:view` | View Activity |
| Activity Monitoring | `screenshots:view` | View Screenshots |
| Reports | `reports:view` | View Reports |
| Reports | `reports:export` | Export Reports |
| Approvals | `approvals:view` | View Approvals |
| Approvals | `approvals:approve` | Approve Requests |
| AI Center | `ai:view` | Use AI Assistant |
| Anomaly Detection | `anomalies:view` | View Anomalies |
| Communication | `communication:view` | View Inbox |
| Notifications | `notifications:view` | View Notifications |
| Job Portal | `jobs:view` | View Jobs |
| Job Portal | `jobs:manage` | Manage Hiring |
| Integrations | `integrations:view` | View Integrations |
| Integrations | `integrations:manage` | Manage Integrations |
| Billing | `billing:view` | View Billing |
| Billing | `billing:manage` | Manage Subscription |
| Remote Support | `remote-support:view` | View Remote Support |
| Remote Support | `remote-support:approve` | Approve Sessions |
| Desktop Agents | `agents:view` | View Agents |
| Desktop Agents | `agents:manage` | Manage Agents |
| Roles & Permissions | `roles:view` | View Roles |
| Roles & Permissions | `roles:manage` | Manage Roles |
| Security | `security:view` | View Security |
| Security | `security:manage` | Manage Security |
| Audit Logs | `audit-logs:view` | View Audit Logs |
| Settings | `settings:view` | View Settings |
| Settings | `settings:manage` | Manage Organization Settings |
| Help Center | `help:view` | View Help Center |
| — | `*` | Wildcard — every permission |

---

## Role intent

- **Organization Owner** — full control of the org. An **oversight** role: cares
  about company-wide analytics, billing, roles, and approvals — *not* personal
  time logging.
- **Admin** — runs the organization day-to-day across most modules. Also an
  **oversight** role (approves, configures), not a personal tracker.
- **Employee** — personal workspace: tracks their own time, manages their own
  tasks, views their reports.

---

## Permission matrix — Owner · Admin · Employee

✓ = granted. Owner holds the wildcard `*`, so it has every permission.

| Permission | Owner | Admin | Employee |
|------------|:-----:|:-----:|:--------:|
| `dashboard:view` | ✓ | ✓ | ✓ |
| `dashboard:edit` | ✓ | ✓ | — |
| `time-tracking:view` | ✓ | ✓ | ✓ |
| `time-tracking:edit` | ✓¹ | ✓¹ | ✓ |
| `time-tracking:approve` | ✓ | ✓ | — |
| `tasks:view` | ✓ | ✓ | ✓ |
| `tasks:create` | ✓ | ✓ | ✓ |
| `tasks:edit` | ✓ | ✓ | ✓ |
| `tasks:delete` | ✓ | ✓ | — |
| `tasks:assign` | ✓ | ✓ | — |
| `projects:view` | ✓ | ✓ | ✓ |
| `projects:create` | ✓ | ✓ | — |
| `projects:manage` | ✓ | ✓ | — |
| `employees:view` | ✓ | ✓ | — |
| `employees:manage` | ✓ | ✓ | — |
| `attendance:view` | ✓ | ✓ | ✓ |
| `attendance:manage` | ✓ | ✓ | — |
| `activity:view` | ✓ | ✓ | — |
| `screenshots:view` | ✓ | ✓ | — |
| `reports:view` | ✓ | ✓ | ✓ |
| `reports:export` | ✓ | ✓ | — |
| `approvals:view` | ✓ | ✓ | — |
| `approvals:approve` | ✓ | ✓ | — |
| `ai:view` | ✓ | ✓ | ✓ |
| `anomalies:view` | ✓ | ✓ | — |
| `communication:view` | ✓ | ✓ | ✓ |
| `notifications:view` | ✓ | ✓ | ✓ |
| `jobs:view` | ✓ | ✓ | — |
| `jobs:manage` | ✓ | ✓ | — |
| `integrations:view` | ✓ | ✓ | — |
| `integrations:manage` | ✓ | ✓ | — |
| `billing:view` | ✓ | ✓ | — |
| `billing:manage` | ✓ | — | — |
| `remote-support:view` | ✓ | ✓ | — |
| `remote-support:approve` | ✓ | — | — |
| `agents:view` | ✓ | ✓ | — |
| `agents:manage` | ✓ | ✓ | — |
| `roles:view` | ✓ | ✓ | — |
| `roles:manage` | ✓ | ✓ | — |
| `security:view` | ✓ | ✓ | — |
| `security:manage` | ✓ | ✓ | — |
| `audit-logs:view` | ✓ | ✓ | — |
| `settings:view` | ✓ | ✓ | — |
| `settings:manage` | ✓ | ✓ | — |
| `help:view` | ✓ | ✓ | ✓ |

¹ See the Time Tracking note below — recommended to **drop personal tracking**
for oversight roles.

### Grants by role (compact)

**Organization Owner** — `*` (all permissions).

**Admin** — everything **except** `billing:manage` and `remote-support:approve`.

**Employee** — `dashboard:view`, `time-tracking:view`, `time-tracking:edit`,
`tasks:view`, `tasks:create`, `tasks:edit`, `projects:view`, `attendance:view`,
`reports:view`, `ai:view`, `communication:view`, `notifications:view`, `help:view`.

---

## Time Tracking & oversight roles (the Owner problem)

**Problem:** the Owner sees the personal timer/tracker on `/time-tracking`, but
an Owner doesn't log their own time — they oversee everyone's.

**Cause:** the personal tracker shows for anyone with `time-tracking:edit`
(log/edit own time). Owner has it via the wildcard; Admin has it explicitly.

**Recommended model:** treat time tracking as two distinct capabilities —

- `time-tracking:edit` → **personal** tracker (timer + my timesheet). Employees.
- `time-tracking:approve` → **oversight** (team timesheets, approvals). Owner, Admin, Manager.

**Two ways to apply it (pick one):**

1. **UI-level (no grant change, keeps Owner = `*`)** — make `/time-tracking`
   role-aware:
   - has `time-tracking:approve` → default to the **team/approvals** view (no personal timer)
   - has `time-tracking:edit` **and not** `approve` → show the **personal tracker**
   ```tsx
   const { can } = usePermissions();
   const oversight = can("time-tracking:approve");
   // render <TeamTimesheets/> when oversight, else <PersonalTracker/>
   ```
2. **Grant-level (explicit)** — drop `time-tracking:edit` from oversight roles so
   they never get the personal tracker:
   - **Admin**: remove `time-tracking:edit`, keep `view` + `approve`.
   - **Owner**: replace the wildcard with an explicit full set that **excludes
     `time-tracking:edit`** (trade-off: new permissions won't auto-grant to Owner
     and must be added here going forward).

**Recommendation:** do **#1** (role-aware page) — it fixes the Owner experience,
keeps Owner truly all-powerful, and also gives Admins/Managers the oversight view
without special-casing grants. Implement in
`src/modules/time-tracking/components/time-tracking-view.tsx`.

---

## Adding a new permission (checklist)

1. Add it to `PERMISSION_CATEGORIES` in `src/constants/permissions.ts`.
2. Grant it where appropriate in `src/constants/roles.ts` (Owner gets it free via `*`).
3. Gate UI with `can("module:action")`; gate a new route by adding its nav/admin/
   insights entry so `permissionForPath` resolves it (see `src/lib/rbac.ts`).
