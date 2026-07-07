# RBAC Implementation Plan

> **Status:** Proposed design — no code written yet.
> **Scope:** Frontend-only (Phase 1). Mock data + `npm run seed`. No backend, DB, or middleware.
> **Author context:** Reconciles the client RBAC brief with the existing WorkPulse codebase.

---

## 0. Decisions locked with the client

| # | Decision | Consequence |
|---|----------|-------------|
| 1 | **Frontend-only.** No real backend/DB/middleware now. | Enforcement lives in the mock-service seam (`lib/`, module services, Zustand stores) + client route/UI guards. The brief's "backend must enforce" is deferred; we structure the code so a real API can drop in later. |
| 2 | **3 fixed roles** — Admin (Owner), Manager, Employee — that cannot be deleted. **But** Admin *and* Manager can create **custom roles** via a "Create custom role" button. | Collapse today's 6 system roles to 3. Custom roles are allowed but **tiered** and **clamped** to the creator's own permissions. |
| 3 | **Per-user permissions.** Each invited user gets a customized permission set, editable later. | Permissions move from *role-only* to a *per-user* set. Role/template becomes the starting point, not the source of truth. |
| 4 | **Admin-assigned departments.** Admin picks one or more departments for a Manager; the Manager sees employees in those departments (plus their own). | Replace the auto single-`department`+`team` derivation with an explicit `assignedDepartments` list on Manager users. |

---

## 1. Current implementation — what already exists

### 1.1 Permission model (keep — it's solid)
- `PermissionId = "<module>:<action>"` plus wildcard `"*"`. — [src/types/rbac.ts](src/types/rbac.ts)
- Full catalog grouped by module, `ALL_PERMISSIONS`, `PERMISSION_MAP`. — [src/constants/permissions.ts](src/constants/permissions.ts)
- `CONTRIBUTOR_ONLY_PERMISSIONS` (perms the wildcard does *not* auto-grant, e.g. `time-tracking:edit`).
- Access helpers `canAccess` / `canAll` / `canAny`, nav filtering `getAccessibleNav`, route resolution `permissionForPath` / `titleForPath`. — [src/lib/rbac.ts](src/lib/rbac.ts)

### 1.2 Roles (must change)
- **6** system roles: Owner, Admin, HR, Finance, Manager, Employee. — [src/constants/roles.ts](src/constants/roles.ts)
- Custom roles freely created / cloned / **deleted**. — [src/stores/roles.store.ts](src/stores/roles.store.ts), [role-editor-dialog.tsx](src/modules/roles/components/role-editor-dialog.tsx)
- **Permissions live on the Role only.** `User.roleId` → `Role.permissions`. No per-user permissions, no overrides.

### 1.3 Data scoping (must extend)
- `Role.scope: "self" | "team" | "org"`. — [src/types/rbac.ts](src/types/rbac.ts)
- `scopedUserIds(user, scope, all)` — `team` = users with the **same single** `department` **and** `team` as the current user. Auto-derived; cannot span departments. — [src/lib/scope.ts](src/lib/scope.ts)
- Consumed by `useDataScope` / `useIsSelfScoped` in employees, attendance, time-tracking, approvals, dashboard, insights (screenshots/reports/anomalies). — [src/hooks/use-data-scope.ts](src/hooks/use-data-scope.ts), [src/hooks/use-self-scope.ts](src/hooks/use-self-scope.ts)

### 1.4 Auth & invitations (must extend)
- Mock login by email match; any password. No signup that creates an org/owner (register just routes to `/onboarding`). — [auth.service.ts](src/modules/auth/services/auth.service.ts), [register-form.tsx](src/modules/auth/components/register-form.tsx)
- Persisted auth store holds `session` + `user`. — [src/stores/auth.store.ts](src/stores/auth.store.ts)
- **Invitations are cosmetic** — WhatsApp/email/copy-link share, no records, no per-invite permissions. — [invite-dialog.tsx](src/modules/employees/components/invite-dialog.tsx)
- `create-employee-dialog.tsx` creates an employee with a `roleId` + `status`. — [create-employee-dialog.tsx](src/modules/employees/components/create-employee-dialog.tsx)

### 1.5 Enforcement
- Client-only: `AuthGuard` + `permissionForPath` for routes; `getAccessibleNav` for the sidebar; `usePermissions().can()` sprinkled across module UIs. **No `middleware.ts`, no server checks.**

### 1.6 Gap summary — what does NOT exist yet
- ❌ Per-user permission sets / overrides
- ❌ Default permission templates (per inviter)
- ❌ Manager ⊆ Admin / Employee ⊆ Manager subset constraint
- ❌ Admin-assigned multi-department visibility
- ❌ Real invitation records with a lifecycle
- ❌ Tiered custom roles / creator-clamped role creation
- ❌ Exactly-3 fixed role set (currently 6)

---

## 2. Target model

### 2.1 Roles as **tiers + templates**, permissions as **per-user sets**

- The **source of truth for what a user can do is `user.permissions`** (an explicit `PermissionId[]`, or `["*"]` for the Owner).
- A **Role** becomes: a **hierarchy tier** + a **named permission template** used to *seed* `user.permissions` at invite/assign time.
- **3 fixed roles**, each with a `tier`:

| Role | `tier` | Deletable? | Base scope | Default permissions |
|------|--------|-----------|-----------|---------------------|
| Admin (Owner) | `admin` | No | `org` | `["*"]` (unrestricted) |
| Manager / Team Lead | `manager` | No | `departments` (assigned) | curated oversight set (today's Manager perms) |
| Employee | `employee` | No | `self` | curated contributor set (today's Employee perms) |

- **Custom roles** are allowed (button), each with a `tier` (`manager` or `employee` — never `admin`) and a permission set **⊆ the creator's effective permissions**. They are reusable templates, not new tiers.

> HR and Finance are removed as system roles. They can be recreated as **custom roles** under the `manager`/`employee` tier if needed. Seed data is regenerated to reference only the 3 roles (see §7).

### 2.2 Effective permissions = own set clamped by the inviter chain

The hierarchy rule ("a lower role can never exceed the one above it") is enforced by **lazy resolution up the `invitedBy` chain**, which is always correct even after edits:

```
effectivePerms(user):
  if user.tier == "admin"            -> ["*"]                       // base case
  granter = effectivePerms(inviter(user))                          // recurse
  return intersect(user.permissions, granter)                      // clamp
```

- `intersect(a, granter)` respects the wildcard: if `granter` is `["*"]`, everything in `a` is allowed **except** `CONTRIBUTOR_ONLY_PERMISSIONS` unless explicitly listed (reuse existing `canAccess` semantics).
- **Why lazy, not a hard cascade:** when the Admin removes a permission from a Manager, every employee that Manager invited *immediately* loses any grant that depended on it — no bulk rewrite needed, no drift. The stored `user.permissions` may hold a "stale" grant, but it can never take effect because it's re-clamped on every read. (Optional cleanup pass in §6.4.)
- This satisfies the brief's rules: Manager ⊆ Admin, Employee ⊆ Manager, "existing employees respect updated rules."

### 2.3 Granting constraint (write-time)

When user **G** invites/edits user **U**:
- The permission picker only **enables** permissions in `effectivePerms(G)`; others are shown disabled (Employee/Manager) or hidden, per §5.3.
- On save we **defensively** store `U.permissions = intersect(requested, effectivePerms(G))` so the UI can never over-grant even via a bug.
- `canGrant(granter, perm) = effectivePerms(granter).includes(perm)` (wildcard-aware).

### 2.4 Department visibility (Managers)

- Manager users gain `assignedDepartments: string[]`, set by the Admin at invite time and editable later.
- Visible user set for a Manager = users whose `department ∈ (assignedDepartments ∪ {manager.department})`.
- Employees stay `self`-scoped; Admin/Owner stay `org`-scoped.

---

## 3. Data-model changes

### 3.1 `types/rbac.ts`
```ts
export type RoleTier = "admin" | "manager" | "employee";

export interface Role {
  id: string;
  name: string;
  description: string;
  system: boolean;          // true for the 3 fixed roles
  tier: RoleTier;           // NEW — hierarchy level
  deletable: boolean;       // NEW — false for the 3 fixed roles
  permissions: PermissionId[]; // template/default permissions
  scope?: RoleScope;        // kept; managers effectively use assignedDepartments
}

// RoleScope: add "departments" for managers (or keep "team" and reinterpret).
export type RoleScope = "self" | "team" | "departments" | "org";
```

### 3.2 `types/user.ts`
```ts
export interface User {
  // ...existing fields...
  roleId: string;                    // one of the 3 fixed roles or a custom role
  permissions: PermissionId[];       // NEW — the user's explicit grant set (["*"] for Owner)
  invitedByUserId?: string;          // NEW — parent in the hierarchy chain (undefined for Owner)
  assignedDepartments?: string[];    // NEW — managers only; departments the Admin granted
}
```

### 3.3 New: templates
```ts
// types/rbac.ts (or a dedicated types/templates.ts)
export interface PermissionTemplate {
  id: string;
  ownerUserId: string;      // whose template this is (Admin owns 2; each Manager owns 1)
  targetTier: "manager" | "employee";
  permissions: PermissionId[];       // clamped to the owner's effective perms on save
  assignedDepartments?: string[];    // default dept assignment for manager invites
}
```

### 3.4 New: invitation records
```ts
export interface Invitation {
  id: string;
  email: string;
  name: string;
  roleId: string;                    // fixed or custom role chosen as the template
  tier: RoleTier;
  permissions: PermissionId[];       // customized, clamped to inviter
  assignedDepartments?: string[];    // for manager invites
  invitedByUserId: string;
  status: "pending" | "accepted" | "revoked";
  createdAt: number;                 // pass timestamps in; never Date.now() in render
}
```

---

## 4. `lib/` logic changes

### 4.1 `lib/rbac.ts` (extend, keep existing signatures)
- `getEffectivePermissions(user, allUsers): PermissionId[]` — the lazy chain resolver (§2.2). Memoizable by `(userId, permissions ref)`.
- `intersectPermissions(requested, granterPerms): PermissionId[]` — wildcard-aware clamp reusing `canAccess`.
- `canGrant(granterPerms, perm): boolean`.
- `canManageUser(actor, target)` — actor.tier is strictly above target.tier **and** target is within actor's scope (dept/self/org). Gates edit/revoke.
- Keep `canAccess/canAll/canAny/getAccessibleNav/permissionForPath/titleForPath` — but the **inputs shift** from a `Role` to an **effective permission set** (add overloads or a thin `RoleLike = { permissions }`).

### 4.2 `lib/scope.ts`
- Extend `scopedUserIds` to handle the manager case:
  - `admin`/`org` → `null`
  - `employee`/`self` → `Set([user.id])`
  - `manager`/`departments` → users whose `department ∈ (user.assignedDepartments ∪ {user.department})`
- Signature grows to accept `assignedDepartments` (or the full user).

---

## 5. Frontend changes

### 5.1 Hooks
- `hooks/use-permissions.ts` — `useCurrentRole` stays; add `useEffectivePermissions()` computing the chain from `auth.user` + `lib/data` users + custom roles. `usePermissions().can()` reads **effective** perms, not raw role perms.
- `hooks/use-data-scope.ts` — resolve scope via the user's tier + `assignedDepartments`; feed the extended `scopedUserIds`.
- `hooks/use-self-scope.ts` — unchanged semantics (Employee tier).

### 5.2 Stores
- **New** `stores/templates.store.ts` (persist key `wp-templates`) — CRUD for `PermissionTemplate`; `getTemplate(ownerUserId, targetTier)`; on save, clamp to the owner's effective perms.
- **New** `stores/invitations.store.ts` (persist key `wp-invitations`) — create/list/revoke invitations; creating one also provisions an invited `User` (status `"invited"`) with the customized `permissions`, `invitedByUserId`, and (managers) `assignedDepartments`, so mock login works.
- `stores/roles.store.ts` — reduce fixed roles to 3; `createRole`/`cloneRole` now require a `tier` and **clamp** permissions to the creator's effective perms; block deleting fixed roles (`deletable: false`). Add store **version bump + migrate** (§8).
- `stores/auth.store.ts` — user shape gains `permissions` etc.; migrate persisted users (backfill from old role, map removed roles) (§8).
- `stores/employees.store.ts` — creation carries `permissions` + `invitedByUserId` (+ `assignedDepartments` for managers).

### 5.3 Roles & Permissions page — the new hub
[src/app/(app)/settings/roles/page.tsx](src/app/(app)/settings/roles/page.tsx) → enriched `RolesManager` with three sections:

1. **Roles** — the 3 fixed roles (lock icon, no delete) + custom roles. "Create custom role" button visible to Admin **and** Manager; the editor ([role-editor-dialog.tsx](src/modules/roles/components/role-editor-dialog.tsx)) only enables permissions in the creator's effective set, and records the role's `tier`.
2. **Default templates** — cards for the templates the current user owns:
   - Admin: **Manager Default Template** + **Employee Default Template**.
   - Manager: **Employee Default Template** (options limited to the manager's own perms).
   - Clicking a card opens a template editor (same permission grid, clamped). "Save" updates the template only; existing users are untouched.
3. **Invite** — select a role → **Send Invite** → opens the invite dialog pre-filled from the matching default template (§5.4).

### 5.4 Invitation dialog (new, replaces the cosmetic one)
- Fields: name, email, role (fixed/custom), **permission picker** (pre-filled from template, options clamped to inviter), and — for Manager invites — a **department multi-select** (`assignedDepartments`) + actions.
- On send: create an `Invitation` + provision the invited `User` with clamped `permissions`. Toast + (mock) share link retained from the old dialog for flavor.
- Reconcile with [create-employee-dialog.tsx](src/modules/employees/components/create-employee-dialog.tsx) and [invite-dialog.tsx](src/modules/employees/components/invite-dialog.tsx): one flow, not three (per CLAUDE.md "no duplicate components").

### 5.5 Post-invite editing
- From Roles & Permissions (or the employee profile), an authorized granter can edit a user's `permissions` / `assignedDepartments` later. Same clamp + `canManageUser` gate. Removing a Manager's perm instantly narrows every downstream employee via lazy resolution.

### 5.6 Enforcement touch-points (already wired to `usePermissions` — just re-point to effective perms)
- Route guard `AuthGuard` + `permissionForPath` — unchanged logic, effective-perm input.
- Sidebar `getAccessibleNav` — effective-perm input → hidden modules truly disappear.
- All existing `can(...)` UI gates (employees, approvals, payroll, projects, integrations, agents, security, settings, global timer, command palette, sidebar search) keep working, now reading effective perms.
- Data views (employees/attendance/time-tracking/approvals/dashboard/insights) keep using `useDataScope`, now department-aware for managers.

---

## 6. Enforcement & hierarchy rules — how each brief rule is met

| Brief rule | Mechanism |
|-----------|-----------|
| Admin unrestricted | `tier: "admin"`, `permissions: ["*"]`; base case of `getEffectivePermissions`. |
| Manager fully controlled by Admin | Manager perms = own set ∩ Admin(`*`); `assignedDepartments` set by Admin; lazy re-clamp on every read. |
| Employee controlled by Manager | Employee perms ∩ inviter(Manager) effective perms. |
| Manager can't grant perms it lacks | Invite/role/template editors clamp options to `effectivePerms(manager)`; save-time `intersectPermissions`. |
| Employee ⊆ Manager ⊆ Admin | Recursive `getEffectivePermissions` up `invitedByUserId`. |
| Dept visibility enforced | `assignedDepartments` + extended `scopedUserIds`; applied by `useDataScope`. |
| Hidden modules absent from nav | `getAccessibleNav` on effective perms. |
| Perms editable after invite | Edit `user.permissions`; clamp + `canManageUser`. |
| Admin removes Manager perm → cascades | Lazy resolution (§2.2); optional cleanup §6.4. |
| Templates seed but don't mutate users | Templates only pre-fill the invite form. |

### 6.4 Optional cascade cleanup (nice-to-have)
A pure helper `reclampSubtree(rootUserId, allUsers)` that rewrites stored `user.permissions = effectivePerms(user)` for the subtree, run after an Admin edits a Manager. Not required for correctness (lazy resolution already enforces), but keeps stored data tidy and export-friendly.

### 6.5 Frontend-only honesty
Because there is no backend, **all enforcement is client-side and therefore advisory** against a determined user. The design keeps every check behind `lib/rbac.ts` + the mock-service seam so a real backend can later enforce the *same* functions server-side. This limitation is called out explicitly and is acceptable for Phase 1 per Decision #1.

---

## 7. Mock data & seed changes ([scripts/seed.ts](scripts/seed.ts), `src/data/*.json`)
- Emit `permissions`, `invitedByUserId` for every user; `assignedDepartments` for managers.
- Reference **only** the 3 roles. Map any legacy HR/Finance-shaped users to Manager/Employee tiers with an appropriate permission set.
- Seed a **demo Manager** with 2 assigned departments (e.g. Sales + Marketing) and several employees under them (`invitedByUserId` = that manager), plus employees in *other* departments to prove they stay hidden.
- Owner `owner@acme.test` → `permissions: ["*"]`, no `invitedByUserId`.
- Keep the seed deterministic (`faker.seed(...)`, no `Date.now()`/`Math.random()` in render paths).

---

## 8. Migration strategy (persisted localStorage)
Zustand `persist` stores need versioned migrations so returning users don't break:
- `wp-auth` — on rehydrate, if `user.permissions` is missing, backfill from the user's old role perms; map removed roles (HR/Finance) to a tier + perm set; default `invitedByUserId` (Owner = none).
- `wp-roles` — bump `version`; drop non-existent perms (already done); add `tier`/`deletable` to persisted custom roles (infer `tier: "employee"` if unknown); ensure the 3 fixed roles are never persisted as deletable.
- `wp-templates`, `wp-invitations` — new stores; empty-safe defaults; seed Admin's two default templates from the fixed Manager/Employee role permissions on first run.

---

## 9. File-by-file change list

**Types**
- `src/types/rbac.ts` — add `RoleTier`, `tier`/`deletable` on `Role`, `"departments"` scope, `PermissionTemplate`, `Invitation`.
- `src/types/user.ts` — add `permissions`, `invitedByUserId`, `assignedDepartments`.

**Constants**
- `src/constants/roles.ts` — reduce to 3 fixed roles with `tier`/`deletable`; drop HR/Finance/Owner-vs-Admin split (Owner = Admin tier with `*`).
- `src/constants/permissions.ts` — likely unchanged (catalog stays).

**Lib**
- `src/lib/rbac.ts` — `getEffectivePermissions`, `intersectPermissions`, `canGrant`, `canManageUser`; re-point `canAccess`/nav helpers to effective perms.
- `src/lib/scope.ts` — department-aware `scopedUserIds`.

**Hooks**
- `src/hooks/use-permissions.ts` — `useEffectivePermissions`; `can()` on effective perms.
- `src/hooks/use-data-scope.ts` — tier + `assignedDepartments`.

**Stores**
- NEW `src/stores/templates.store.ts`, NEW `src/stores/invitations.store.ts`.
- `src/stores/roles.store.ts` — 3 fixed + tiered/clamped custom roles + migration.
- `src/stores/auth.store.ts`, `src/stores/employees.store.ts` — new user fields + migration.

**Modules / UI**
- `src/modules/roles/components/roles-manager.tsx` — 3 sections (Roles, Templates, Invite).
- `src/modules/roles/components/role-editor-dialog.tsx` — clamp to creator perms + tier.
- NEW template editor + NEW unified invitation dialog (with department multi-select).
- `src/modules/employees/components/{invite-dialog,create-employee-dialog}.tsx` — consolidate into the new flow.
- `src/app/(app)/settings/roles/page.tsx` — renders the enriched manager (thin page).

**Data / seed**
- `scripts/seed.ts`, `src/data/users.json` (+ any role-referencing JSON).

---

## 10. Phasing (each phase ends green via `npm run build`)

- **A — Model & data:** types, 3-role constants, seed + JSON, store migrations. No behavior change yet.
- **B — Effective perms:** `getEffectivePermissions` + clamp helpers; re-point `usePermissions`/guards/sidebar. Verify existing gates still behave.
- **C — Tiered/clamped roles:** custom-role creation for Admin + Manager, delete-guard on fixed roles.
- **D — Templates:** template store + editor + Templates section.
- **E — Invitations:** invitation store + unified invite dialog + Invite section; consolidate the old dialogs.
- **F — Department scoping:** `assignedDepartments` end-to-end; department-aware `useDataScope`.
- **G — Post-invite editing + optional cascade cleanup;** final verification.

---

## 11. Open questions / risks
1. **Owner vs. Admin:** brief treats "Admin (Owner)" as one thing. Plan folds Owner into the `admin` tier with `["*"]`. Confirm there's no separate non-owner Admin needed. *(Assumed: single admin tier.)*
2. **Custom-role tiers for Managers:** a Manager-created custom role is `employee`-tier and clamped to the manager's perms. Confirm Managers may *only* create employee-tier roles.
3. **Department vs. team granularity:** plan scopes managers by whole **departments** (per your answer). Team-level narrowing was declined; revisit only if needed.
4. **Signup flow:** brief says only an Admin can sign up and it creates the org's first Owner. Current register is a mock that routes to onboarding. Wiring real "signup → create org + owner" is included as a small extension in Phase A/E; confirm priority.
5. **Frontend-only enforcement is advisory** (no backend). Accepted per Decision #1; flagged for stakeholders.

---

*No source files were modified in producing this plan. Implementation begins only after sign-off.*
