# Frontend ↔ Backend Alignment

> What the frontend must change to match the authoritative backend design:
> [`backend/WorkPulse-HLD.md`](../../backend/WorkPulse-HLD.md) (infra) and
> [`backend/WorkPulse-LLD.md`](../../backend/WorkPulse-LLD.md) (features, per context).
> The LLD is **authoritative** — where this frontend disagrees, the frontend is wrong.
>
> Analysed against LLD v1 (Feature Scope Map + §1–§19 + Cut/Deferred blocks) and HLD v3.0.
> **Revised 2026-07-15** after the backend doc set was realigned — see *What changed* below.

> ### What changed on 2026-07-15 (read this first)
>
> **1. The backend is real code now**, not a spec. `backend/` is a Rust workspace with a live AWS
> `dev` stack. Two consequences for this document:
> - **`crates/wp-contracts` is the source of truth** for permissions and the plan catalog. **The
>   frontend mirrors it — never the reverse.** Where this doc and that crate disagree, the crate wins.
> - **Only `identity` and `ingest` are built.** `infra/stacks/contexts/` contains just those two, so
>   most of §4 has no endpoint behind it yet. *Designed ≠ available.*
>
> **2. Do not build against `backend/docs/API.md` paths.** Most of its old route table was invented
> there and exists nowhere in the LLD (the whole `/roles`, `/billing`, `/payroll`, `/projects`,
> `/insights/*` space), and it used unversioned paths while the LLD is uniformly `/v1`. That table is
> now deleted. **The LLD's per-slice declarations are the only real routes.**
>
> **3. Enterprise SSO is un-cut** — §1.1 is reversed. See `backend/WorkPulse-SSO.md` (**PROPOSED**).
>
> **4. Four backend defects were found that change frontend work** — see *§0 · Backend defects*.

---

## 0 · Backend defects that affect the frontend

These are **open, flagged in the backend docs, and not yet fixed.** They change what the frontend
should build, so they belong here rather than only in `backend/`.

| # | Defect | What it means for the frontend |
|---|---|---|
| 0.1 | **`is_owner` bypasses the contributor-only carve-out.** `wp_platform::auth::AuthContext::can` is `is_owner \|\| perms.contains(p)`, so bits **110–119** — documented in `wp-contracts` as *"an Owner's wildcard does **not** grant"* — are granted anyway. | **RBAC parity is broken right now.** The frontend's `CONTRIBUTOR_ONLY_PERMISSIONS` enforces the rule; the server doesn't. So the UI hides the action and the API would allow it. **Don't "fix" the frontend to match** — the frontend is correct here. Awaiting a backend decision (special-case the range in `can()`, or drop the rule from LLD §13 *and* the frontend together). |
| 0.2 | **MFA is enforced by nothing.** LLD §2 calls pool-level TOTP *"a hard platform invariant… no grace period"*, but `auth_stack.py` sets `mfa=cognito.Mfa.OPTIONAL` on the promise of an app-side grace that was never built. | **§1.4 still stands** — nothing about MFA is org-editable, so the policy controls still go. But do **not** build UI that assumes every user has TOTP: today they may not. The posture view (§3.2) is the honest surface, and it needs an **unenrolled** state. |
| 0.3 | **The plan catalog entitles features that don't exist.** `FEATURE_KEYS` contains `remote_support` (**CUT**) and `integrations` (**DEFERRED**), and `Plan::Enterprise` grants everything. | The pricing/plan UI must **not** surface either as a sellable feature, whatever the API returns. See §3.7. |
| 0.4 | **`auto_resume/` overrides a manual project hold.** LLD §5 gives Project no hold reason, so the next time entry silently reactivates a project a manager deliberately paused. | Don't ship a "Hold project" affordance that implies permanence — a manual hold is currently undone by the next logged minute. Blocked on the backend adopting `status_reason`. |

---

## Already aligned — no work

| Area | Backing decision |
|---|---|
| **3 immutable system roles** (Owner · Admin · Employee) | LLD §13: system roles are exactly these; HR/Finance/Manager/CTO become **org-created custom roles** |
| **Timesheet approval / flagging removed** | LLD §4: *"No timesheet approval/flagging. Approval Center is leave-only."* |
| **Approvals = leave-only** | LLD §9 + Feature Scope Map |
| **Remote Support removed** | LLD Cut: *"Remote Support Center — removed entirely."* |
| **Multi-monitor screenshots** (capture = a set across displays) | HLD §2: agent captures **all displays** via `xcap` |
| **Session-only AI chat** (nothing stored server-side) | LLD §19 |
| **Static Help Center content** (no CMS, zero backend slices) | LLD §19 |
| **Single role per user** | LLD §13 (supersedes the HLD's plural `role_ids[]`) |

---

## 1 · Remove — CUT from scope

| # | Frontend surface | Why (LLD/HLD) |
|---|---|---|
| ~~1.1~~ | ~~**Enterprise SSO card** in Security Center~~ | ⚠️ **REVERSED — do not delete.** The CUT this row was based on has been revived as its own design, `backend/WorkPulse-SSO.md` (**PROPOSED**, gates on backend review). **Keep** the card, the `sso-buttons`, and the "SSO / SAML & SCIM" plan/landing copy. The card stays mock until that design's Phase 2 lands; SCIM (Phase 4) is the furthest out, so the plan copy is the most forward-dated claim on the site. Frontend deltas are enumerated in that doc §8 — none are actionable before its Phase 1. |
| 1.2 | **Web timer Start/Stop controls** — global timer control, `stores/timer.store.ts`, `timer-hero`, ⌘K start/stop action | LLD §4: *"The timer is an agent module (a Tauri 2 window), not a web feature. The web shell shows a **read-only running-session indicator** only."* Not a remote control. |
| 1.3 | **Manual time entry / timer-correction UI** (any edit of a time entry) | LLD §4: *"Time is purely agent-derived and immutable. No manual entries, no timer corrections, no time-change flows of any kind. `source: manual` does not exist."* Forgetting to start the timer = a permanent gap (accepted). |
| 1.4 | **MFA policy controls** — "Require multi-factor authentication" switch, "Enrollment grace period" select, "Allowed methods" toggles | LLD §2: MFA is a **hard platform invariant** — Cognito pool-level TOTP, *"No grace period, nothing org-editable."* **Still delete these** — the *design* is that nothing here is org-editable, and that hasn't changed. ⚠️ But see **§0.2**: the invariant is currently enforced by nothing (the pool is `OPTIONAL`), so the posture view must handle **unenrolled** users. The "grace period" control is doubly dead — it was modelled on a rule the LLD superseded *and* the code never implemented. |
| 1.5 | **Session policy editors** — session timeout, max concurrent sessions, remember-this-device | LLD §15: session/token lifetimes are **platform-fixed** (Cognito pool-level). Keep **only** the active-sessions list + revoke. |
| 1.6 | **Editable Password Policy** — min length, mixed characters, rotation | LLD §15: Cognito pool password policy, **platform-fixed, shown read-only**. |
| 1.7 | **Employee ID input** in the invite dialog | LLD §2: empId is **server-generated** — org-configurable prefix + atomic per-tenant sequence (`COUNTER#emp_id`) → `NS-0042`. Never user-typed. |
| 1.8 | **Multi-org / org switcher** (if any surface exists) | CUT: *"one identity = one org, fixed tenant_id."* |

## 2 · Defer — hide behind `ComingSoon`

| Frontend | Status |
|---|---|
| **Inbox (DMs / channels)** — nav item + page + `communication:view` | **DEFERRED** — *"the one new subsystem; deserves its own design"* (real-time messaging, channels, retention). |
| **Integrations marketplace** (Settings → Integrations) | **DEFERRED** — OAuth catalog + connect/disconnect + token storage is future work. |
| **Marketing / landing site** | **DEFERRED** in the LLD (no backend). The existing landing can stay — just know it isn't backend-designed. |

## 3 · Fix mismatches

### 3.1 Plans — `free | starter | enterprise`
LLD §1 locks the plan catalog to **free / starter / enterprise** (a code-defined constant in the
shared contracts crate). The frontend ships **Free / Pro / Max / Enterprise**.
→ Reconcile the **sign-up plan step**, **pricing page**, and **landing** to the real catalog.

### 3.2 MFA in Security Center → posture + reset
Replace the setup/policy card with what LLD §2 designs:
- **Read-only MFA posture** per user: *TOTP-enrolled* or *SSO-delegated* (Cognito can't force MFA on federated identities — accepted).
- **One action:** `reset_mfa_device` → `POST /v1/users/{id}/mfa/reset` (perm `security:manage`) — clears the TOTP factor, user re-enrolls at next login, emits audit + `security.mfa_reset`. This is the lost-phone flow.
- **Enrollment itself is not a settings page** — it happens in Cognito's `MFA_SETUP` challenge during invite-accept / login.

### 3.3 Onboarding wizard
LLD §2 (post-login, **owner-only**, **resumable**):
- **Delete the "Choose roles" step** — explicitly *"('Choose roles' step removed.)"*.
- Steps are exactly: **org_setup · invite_team · tracking · personalize**.
- Backed by server state `TENANT#t1 / ORG#onboarding` → `{step → pending|done|skipped, completed_at, version}`. App bootstrap returns it; **route into the wizard while any step is pending**; **dismiss = mark remaining `skipped`**.
- Writes: org_setup → `identity::update_org` (name, timezone, website, **emp_id_prefix**); invite_team → N × `workforce::create_invite`; tracking → fleet `CONFIG#TRACK`; personalize → owner dashboard-layout item.
- The guided product tour is **client-only**, dismissable, no server state.
- *Note:* the org step is **not** duplicate of sign-up — it also sets timezone + `emp_id_prefix`.
- *Known:* "Add another" on invites is an accepted **inert frontend limitation** (3 emails).

### 3.4 Permission catalog — scope bits + owner flag
LLD §13:
- **Scope = distinct bits:** `activity:read:self`, `activity:read:team`, `activity:read:org` are **separate catalog entries** (~71 perms total, grouped by module for the editor).
- **Owner wildcard is a distinct flag (`is_owner`)** — *outside* the capability space, **not a grantable bit**. Today the frontend models it as a `"*"` permission.
- Bitset is **fixed-width (u128 / byte array)** — the catalog exceeds 64 bits.
- Owner bypasses capability checks but **never** the tenant PK prefix.
- **The permission ids are not a shared vocabulary.** The server does not speak `"<module>:<action>"` strings at all — it evaluates a bitset of `Permission` enum discriminants. The frontend's string ids are a **mirror of `crates/wp-contracts/src/permissions.rs`**, and that file is the source of truth. **Never renumber a discriminant** (it silently changes every issued and stored bitset); adding a permission means adding it there first, in that context's reserved 10-bit range.
- ⚠️ **The contributor-only rule is currently backend-unenforced** — see **§0.1**. The frontend is the *correct* side of that divergence. Leave it alone until the backend decides.

### 3.5 Attendance — five-status model
LLD §7: statuses are **computed** by the 00:15 close cron, resolution order (first match wins):
1. **leave** → 2. **holiday / non-workday** (excluded, not a counted status) → 3. **absent** → 4. **partial** (session exists but < `min_present_minutes`) → 5. **present** (qualified **late** if first session started after the org late-threshold).

→ Frontend must add **partial** and **holiday/non-workday**, and treat **late as a qualifier on present**, not a peer status.
Org settings (on `ORG#meta`, admin-configured): `work_start, work_end, workdays[], late_threshold, min_present_minutes, holidays[]`. Attendance is **strictly org-wide** (RoleProfile's schedule is for the score, not attendance).

### 3.6 Billable is project-level only
LLD §4: a **project** is billable or not; every task inherits it — **no per-task override**.
- **New-project default: a required choice** in the create-project modal.
- Stamped onto `TimeEntry` at fold time and **frozen** (reclassifying a project never rewrites past entries).

### 3.7 Feature gating is two-layer
LLD §1: `effective(key) = key ∈ allowed AND enabled[key] == true`; invariant **`enabled ⊆ allowed`**.
- Feature management must show **plan-allowed** vs **owner-enabled**, and refuse enabling above plan (`403 feature_not_in_plan`).
- Keys are **flat dotted sub-feature keys** (e.g. `insights.reports.ai_pdf`); parents do **not** imply children.
- Newly-allowed keys after an upgrade default **`enabled=false`**.
- **Re-upgrade rule:** force-cleared keys stay **off** until the owner re-enables them manually.
- **Two distinct errors, don't collapse them:** `403 feature_not_in_plan` (toggling a key ∉ `allowed` — an *upsell* moment) vs `403 feature_disabled` (the route's `FeatureGate` — the owner switched it off). They need different UI.
- **Plan change is asynchronous** (`billing.plan_changed` → `apply_plan_change` → `entitlements.changed`), so the plan-change response **cannot** carry the new entitlement set. Re-read `GET /v1/org/entitlements` and tolerate a window where `plan` has moved but `allowed` hasn't — **`version` is the field to watch**.

#### The frontend's feature keys are not the backend's — a full remap is required

`stores/features.store.ts` defines a `FeatureKey` union that shares **exactly one value** with
`crates/wp-contracts/src/plans.rs` (`integrations`). This is not a rename — the granularity differs
and both sides have keys the other lacks. **`wp-contracts` is the source of truth; the frontend
mirrors it.**

| Frontend `FeatureKey` | Backend key (`FEATURE_KEYS`) | Note |
|---|---|---|
| `time-tracking` | `time.tracking` | rename |
| `activity-monitoring` | `monitoring.activity` | rename |
| `screenshots` | `monitoring.screenshots` | rename |
| `reports` | `reports.basic` | **narrower** — AI-PDF is its own key, `insights.reports.ai_pdf` |
| `ai` | `ai.insights` **+** `ai.assistant` | **one key splits into two** — needs a product decision, not a mapping |
| `integrations` | `integrations` | the only exact match — but **DEFERRED** (§0.3) |
| `remote-support` | `remote_support` | **CUT** — delete from the frontend; the backend key is a dead entitlement (§0.3) |
| `billing` | *(none)* | **billing is never gated** — gating it would deadlock an org out of fixing its own plan |
| `communication` | *(none)* | Inbox is DEFERRED — no key |
| `approvals` | *(none)* | not plan-gated |
| `desktop-agents` | *(none)* | not plan-gated |
| *(missing)* | `attendance` · `leave` · `projects` · `anomalies` | **four backend keys the frontend has no concept of** |

The renames are mechanical. **`ai` → two keys, and the four missing keys, are decisions** — don't
invent them. Once settled, the frontend list should be *generated from* or checked against
`wp-contracts`, so this can't drift again.

### 3.8 App/URL rules — blocking is timer-gated
LLD §14: the agent blocks restricted apps/URLs **only while a timer session is running**. Off-timer: **no enforcement, ever**. Surface this in the UI copy so the rule store's two functions (classification for the Q score vs **active blocking**) are legible.

## 4 · Add — designed, missing in the frontend

| # | Feature | Spec |
|---|---|---|
| 4.1 | **⌘K command palette — restore it** | LLD §19 is **DESIGNED**: `GET /v1/search?q=` — **prefix / starts-with** fan-out over **employees · projects · tasks**, each **perm-scoped**, merged, top-N. *No fuzzy/typo tolerance* (the honest trade for zero new infra — no OpenSearch). The palette was deleted from the frontend; it should return, and must add **tasks**. |
| 4.2 | **Role editor: clone + hierarchy guards + the catalog contract** | LLD §13: **clone-to-customize** for the 3 immutable system roles; **Owner is never assignable** via the editor (only transfer-ownership); **no privilege escalation** — a `roles:manage` holder cannot create/assign a role containing bits they don't hold; delete blocked if any user holds the role. **Plus the `list_permissions/` contract** (added to LLD §13 on 2026-07-15): the catalog arrives **grouped by module with labels**, each permission carrying an **`implies[]`** hint, plus a **`contributor_only[]`** set. Toggling a write/manage permission must auto-select its `view` prerequisite — and **the server ORs in missing implied bits on save regardless**, so the UI is convenience, not the guard. Badge `contributor_only` entries (*"an Owner's wildcard never grants it"* — though see **§0.1**: it currently does). Validation returns `400` with per-field errors: name **unique per org**, ids ∈ catalog, system roles rejected for edit/delete, empty set allowed but warned. |
| 4.3 | **Support tickets** | LLD §19: subject, description, category, status (`open\|in_progress\|resolved\|closed`), attachments, **reply thread** (a reply **reopens** a resolved ticket). |
| 4.4 | **IP allowlist completeness** | LLD §15: add an **`ip_enforcement`** toggle; mark **web-only** (the agent ingest route is exempt by design so remote/offline workers keep working); implement the **self-lockout guard** — refuse enabling if the caller's current IP isn't in the list. |
| 4.5 | **Daily goal ("8h")** | LLD §4: lives in **org settings**, owner/admin-editable, synced to agents — display/reporting context, not enforcement. |
| 4.6 | **Realtime over WebSocket** — ⛔ **blocked, not buildable** | HLD §3 designs an API Gateway WebSocket (`ws-*` binaries, connection ids in DDB): **presence < 5 s**, **capture→dashboard ≤ 60 s**, the running-session indicator **pushed, not polled**. **But no `ws` context exists** — `infra/stacks/contexts/` has only `identity` and `ingest`. There is nothing to connect to. Keep polling until the backend ships it. *(Note: the root `CLAUDE.md` used to claim "polling over REST, no WebSocket" — that was stale; WebSocket is the design, it just isn't built.)* |
| 4.7 | **Per-project roles** | LLD §5: a per-project role model (**independent of org RBAC**) with its own authority matrix — the API returns the caller's resolved `authority`. |
| 4.8 | **Dashboard layout** | LLD §3: **type is derived (no user choice)**, persisted **per-user, per-type**, and **perm-filtered**. |

---

## Reference — locked values the UI must not invent

- **Screenshot cadence:** `off / 3 / 5 / 10` min, **default 5** (+ blur level, retention). Admin-set; agents pull on heartbeat via ETag.
- **Retention:** 90-day default (DDB TTL synced to the S3 lifecycle), admin-configurable per org/team.
- **Idle / break:** idle at **≥5 min** no input; **≥15 min** idle ⇒ break.
- **Productivity score (deterministic Rust, never LLM):** `0.25·U + 0.40·Q + 0.15·F + 0.20·R` → 0–100.
  Bands: **85+ strong / 70–85 solid / 50–70 low / <50 flag-for-human-review** (never auto-action).
  Show the **component breakdown** (stored on the DailySummary), and prefer the **relative** signal
  (today vs the user's own 30-day EWMA baseline) — *"Managers act on the relative trend + anomalies,
  never an absolute cross-person leaderboard."*
- **Invites:** token + OTP (hashes only), **7-day TTL**, lock at **5** failed OTP attempts; `revoke` / `resend` (rotates token+OTP, resets expiry).
- **Field-level RBAC:** payroll/PII fields are stripped **server-side** by a field-mask serializer.
  *"UI gating (hidden menus, columns) is UX only; the field mask runs regardless."* The frontend must
  tolerate fields simply **being absent**, not assume it can see them.

## Suggested order of work

1. **Pure deletions** (lowest risk, biggest scope correction): ~~enterprise SSO card~~ (**reversed — §1.1**) · MFA/session/password policy editors · web timer controls · onboarding "Choose roles" step · invite empId input · `remote-support` feature key (**CUT**).
2. **Defer:** Inbox + Integrations → `ComingSoon`.
3. **Mismatches:** plans (free/starter/enterprise) · **the `FeatureKey` remap (§3.7)** · attendance 5-status · project billable required · feature-gating two-layer · permission scope bits + `is_owner`.
4. **Additions:** ⌘K palette (with tasks, prefix-match) · role clone + hierarchy guards + the `implies` catalog contract · IP enforcement toggle + self-lockout guard · daily goal.

**Sequencing reality check.** Only `identity` and `ingest` are built, so most of §4 has no endpoint
yet and **§4.6 (WebSocket) has none at all** — it's blocked, not merely unstarted. The work that is
genuinely unblocked today is §1 (deletions), §2 (defers), and the §3 mismatches, because those are
frontend-local corrections that don't wait on a route. Do those first regardless of backend pace.

**Two things here are decisions, not tasks** — don't let them get picked up as tickets: the `ai` key
splitting into `ai.insights` + `ai.assistant`, and the four backend keys the frontend has no concept
of (`attendance`, `leave`, `projects`, `anomalies`). Both are in §3.7.

**Do not "fix" §0.1.** The frontend is the correct side of that divergence; changing it to match the
server would silently *widen* Owner's authority. Wait for the backend decision.
