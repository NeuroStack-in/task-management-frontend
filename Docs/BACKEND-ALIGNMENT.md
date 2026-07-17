# Frontend ↔ Backend Alignment

> What the frontend must change to match the authoritative backend design:
> [`backend/WorkPulse-HLD.md`](../../backend/WorkPulse-HLD.md) (infra) and
> [`backend/WorkPulse-LLD.md`](../../backend/WorkPulse-LLD.md) (features, per context).
> The LLD is **authoritative** — where this frontend disagrees, the frontend is wrong.
>
> **Revised 2026-07-17.** §1 (except 1.2/1.5/1.6), §2 and **all of §3 are done.** What remains is
> §1.2/§1.5/§1.6 and §4. Read *Status* first — the backend moved a long way and three of the four
> defects this doc used to warn about are fixed.

> ### Status — 2026-07-17
>
> **1. `crates/wp-contracts` is the source of truth** for permissions and the plan catalog. **The
> frontend mirrors it — never the reverse.** Where this doc and that crate disagree, the crate wins.
>
> **2. Eleven contexts are built**, not two: `identity` · `ingest` · `ingest_processor` ·
> `workforce` · `projects` · `time_attendance` · `leave_approvals` · `payroll_billing` ·
> `notifications` · `assistant` · `fleet`. Most of §4 now has a real route behind it. The
> exceptions are called out per row — **designed ≠ available, and available ≠ complete.**
>
> **3. Do not build against `backend/docs/API.md` paths.** Its old route table was largely invented
> there and existed nowhere in the LLD. That table is deleted. **The LLD's per-slice declarations,
> and the `.route()` calls in each crate's `main.rs`, are the only real routes.**
>
> **4. Enterprise SSO is un-cut** — §1.1 is reversed. See `backend/WorkPulse-SSO.md` (**PROPOSED**,
> still not approved).

---

## 0 · Backend defects that affect the frontend

| # | Defect | Status |
|---|---|---|
| 0.1 | **`is_owner` bypassed the contributor-only carve-out** (bits 110–119). | ✅ **Fixed** (`dff827c`). `AuthContext::can` now special-cases `Permission::is_contributor_only`. **It also renamed the bit** — `TimeTrackingEdit` → **`TimeTrackSelf`**, index unchanged. The frontend mirrored that in §3.4: the id is now `time-tracking:self`. |
| 0.2 | **MFA is enforced by nothing.** LLD §2 calls pool-level TOTP *"a hard platform invariant… no grace period"*, but `auth_stack.py:78` is still `mfa=cognito.Mfa.OPTIONAL`, justified in-comment by an app-side grace that was never built. | 🔴 **OPEN — and now the only one.** This got *more* urgent, not less: §3.2 removed the enrollment card (correctly — enrollment is Cognito's `MFA_SETUP` challenge, not a settings page), so **nothing currently prompts anyone to enrol**. Until the pool is `REQUIRED`, a user can end up unenrolled with no way to self-enrol. The posture view says so honestly rather than implying protection that isn't there. |
| 0.3 | **The plan catalog entitled features that don't exist** (`remote_support` CUT, `integrations` DEFERRED). | ✅ **Fixed** (`435f03d`). Both dropped from `FEATURE_KEYS`, which is now 11 keys. §3.7 mirrors it exactly. |
| 0.4 | **`auto_resume/` overrode a manual project hold.** | ✅ **Fixed** (`ac9cdc6`). `status_reason` (`auto-hold` \| `manual`) adopted end to end; `auto_resume/` fires only on `status = on_hold AND status_reason = auto-hold`. Also gained `last_time_entry_at` and `auto_hold_days` default 14. **The frontend can now ship a manual "Hold project" affordance** — the old warning against it is withdrawn. |

---

## Already aligned — no work

| Area | Backing decision |
|---|---|
| **3 immutable system roles** (Owner · Admin · Employee) | LLD §13: HR/Finance/Manager/CTO are **org-created custom roles** |
| **Timesheet approval / flagging removed** | LLD §4: *"Approval Center is leave-only."* |
| **Approvals = leave-only** | LLD §9 + Feature Scope Map |
| **Remote Support removed** | LLD Cut — gone from the frontend and from `FEATURE_KEYS` |
| **Multi-monitor screenshots** (capture = a set across displays) | HLD §2: agent captures **all displays** via `xcap` |
| **Session-only AI chat** | LLD §19. The backend's `list_threads` is a deliberate empty-list stub that *implements* this |
| **Static Help Center content** | LLD §19 |
| **Single role per user** | LLD §13 (supersedes the HLD's plural `role_ids[]`) |

---

## 1 · Remove — CUT from scope

| # | Frontend surface | Status |
|---|---|---|
| ~~1.1~~ | ~~Enterprise SSO card~~ | ⚠️ **REVERSED — do not delete.** Revived as `backend/WorkPulse-SSO.md` (**PROPOSED**). Keep the card, the `sso-buttons`, and the plan/landing copy. Mock until that design's Phase 2. |
| **1.2** | **Web timer Start/Stop controls** — `stores/timer.store.ts`, `timer-hero`, `global-timer`, `use-time-logger`, `personal-time-view` | 🔴 **REMAINING — deliberately held.** LLD §4: the timer is an agent module; the web shows a **read-only running-session indicator**, not a remote control. **But the Tauri agent doesn't exist**, and Phase 1 is a mock-data demo — deleting this leaves no timer at all. Do it when the agent is real, or scope it to hiding the controls rather than removing the store. |
| 1.3 | Manual time entry / timer-correction UI | ✅ **Already clean.** No manual-entry path exists; `timesheet.service.ts` documents that `source` is always `agent`. |
| 1.4 | MFA policy controls | ✅ **Done** — removed with §3.2. |
| **1.5** | **Session policy editors** — session timeout, max concurrent sessions, remember-this-device | 🔴 **REMAINING.** LLD §15: lifetimes are **platform-fixed** (Cognito pool-level). Keep **only** the active-sessions list + revoke; show the rest read-only. |
| **1.6** | **Editable Password Policy** — min length, mixed characters, rotation | 🔴 **REMAINING.** LLD §15: Cognito pool password policy, **platform-fixed, shown read-only**. |
| 1.7 | Employee ID input in the invite dialog | ✅ **Done** — empId is server-generated (`COUNTER#emp_id`). |
| 1.8 | Multi-org / org switcher | ✅ **Already clean** — no such surface exists. |

## 2 · Defer — hide behind `ComingSoon`

✅ **Done.** Inbox and Integrations both render `ComingSoon`; `InboxView` and `IntegrationsMarketplace`
are **kept** (deferred ≠ cut) for when their designs land. The `/integrations` →
`/settings/integrations` redirect still resolves.

*Marketing / landing:* not backend-designed, and that's fine — but note the landing now advertises
plans, and those must match the catalog (§3.1).

## 3 · Fix mismatches — ✅ ALL DONE (`81dab8f`)

Kept as the record of what the contract is. Do not re-litigate these without the LLD.

| # | What | Outcome |
|---|---|---|
| 3.1 | **Plans = `free \| starter \| enterprise`** | Was worse than recorded: the surfaces **contradicted each other** — landing had Pro/Max/Enterprise (no Free), `/pricing` had Free/Pro/Max (no Enterprise), signup had Free/Pro/Max. Now all three agree. The signup **`id`s** were the real bug — `free\|pro\|max`, two of which the server would reject outright. |
| 3.2 | **MFA → posture + reset** | Setup card and recovery codes removed; read-only posture (`totp` / `sso` / **`none`**) + `reset_mfa_device`. See **§0.2** — the unenrolled state is real today. |
| 3.3 | **Onboarding wizard** | Steps already match the LLD's four (`org · team · tracking · personalize`) — deleting "Choose roles" was the whole gap. **The server-state half (`ORG#onboarding`, resumable) has no route yet** — still blocked. |
| 3.4 | **Permission catalog** | `time-tracking:edit` → **`time-tracking:self`**, mirroring `TimeTrackSelf` (bit 110). Not cosmetic: the old name is *why* the backend bug existed — "edit" read as an admin capability. It means *"I personally run a timer"*, never "may edit time entries" (LLD §4 makes time immutable, so no such permission exists). Persisted custom roles migrate (`wp-roles` v2) by **mapping**, not scrubbing — the bit index is unchanged, so it's the same capability. |
| 3.5 | **Attendance five-status** | `leave \| non_workday \| absent \| partial \| present`, `late` a **boolean qualifier**, `isCounted()` keeps `non_workday` out of denominators. Mirrors `AttendanceStatus` in `time-attendance`. |
| 3.6 | **Billable is project-level** | Required at creation, inherited by every task, no per-task override. |
| 3.7 | **Feature gating two-layer** | `FeatureKey` is now an **exact mirror of `FEATURE_KEYS`** — all 11, verified by diff. Dropped `billing` (never gated), `approvals`/`desktop-agents` (core), `communication` (deferred), `integrations` (deferred + removed from the catalog). `wp-features` v2 migrates persisted toggles. |
| 3.8 | **App/URL rules timer-gated** | The UI now says the lists both classify *and* actively block, and that blocking happens **only while a timer runs**. |

**Still true, and load-bearing:**
- **Two distinct errors:** `403 feature_not_in_plan` (key ∉ `allowed` — an *upsell*) vs
  `403 feature_disabled` (the route's `FeatureGate` — owner switched it off). Different UI.
- **Plan change is asynchronous** — the response **cannot** carry the new entitlement set. Re-read
  `GET /v1/org/entitlements`; **`version` is the field to watch**.
- **Permission ids are not a shared vocabulary.** The server evaluates a bitset of `Permission`
  discriminants; the frontend's strings are a mirror. **Never renumber a discriminant.**

## 4 · Add — designed, missing in the frontend

Routes below are **verified against each crate's `main.rs`**, not against a doc.

| # | Feature | Route | State |
|---|---|---|---|
| 4.1 | **⌘K command palette — restore it** | `GET /v1/search?q=` | ⚠️ **Half-built.** Prefix/starts-with, perm-scoped, no fuzzy match (the honest trade for zero new infra). **Returns employees only** — `search/data.rs` hardcodes `projects: vec![]` with *"pending Dev A's projects crate"*, **which has since shipped**. Either the backend finishes it or the palette lands employee-only. Raise with Dev A before building. |
| 4.2 | **Role editor: clone + guards + `implies`** | `POST /v1/roles/{id}/clone`, `GET /v1/permissions`, `PUT /v1/users/{id}/role` | ✅ **Buildable now.** Clone-to-customize for the 3 system roles; Owner never assignable (transfer-ownership only); no privilege escalation. **Catalog contract:** grouped by module, each permission carrying `implies[]`, plus `contributor_only[]`. Toggling a write permission auto-selects its `view` — **the server ORs in missing implied bits on save regardless**, so the UI is convenience, not the guard. Validation → `400` per-field: name unique per org, ids ∈ catalog, system roles rejected, empty set allowed but warned. ⚠️ **Guard 2 compares `PermSet::privileges()`, not raw sets** — raw comparison would make the Employee role ungrantable by anyone (LLD §13). |
| 4.3 | **Support tickets** | `GET/POST /v1/support/tickets`, `GET /v1/support/tickets/{id}`, `POST /v1/support/tickets/{id}/replies` | ✅ **Buildable now** — and mostly a **wiring** job: `help-page.tsx` already has `MOCK_TICKETS` + a `SupportTicket` type. A reply **reopens** a resolved ticket. |
| **4.4** | **IP allowlist enforcement** | *(none)* | ❌ **NOT BUILDABLE.** No slice, no route. `SecurityManage = 72` mentions "IP allowlist" in a *comment* and `keys.rs` reserves `CONFIG#SECURITY` — that's all. The `IpAllowlist` component would wire to nothing. **Don't build the `ip_enforcement` toggle or the self-lockout guard until the backend ships it.** |
| 4.5 | **Daily goal ("8h")** | `PATCH /v1/org` | ✅ **Buildable.** Org settings, owner/admin-editable, synced to agents — display/reporting context, not enforcement. |
| **4.6** | Realtime → **Freshness by polling** (WebSocket deferred) | *(none)* | ✅ **UNBLOCKED — and already what you do.** WebSocket is **deferred to a future migration** (2026-07-17, HLD §3 *Freshness*); no `ws` context exists and none is on the Phase 1–5 plan. **Polling is the design now, not a stopgap.** Make it deliberate: `If-None-Match` → **304**, **30 s** cadence, **pause when the tab is hidden** (Page Visibility API) + refetch on focus. ⚠️ **The migration seam is yours to protect:** put polling behind **one abstraction** (a `useLiveQuery(key)`-shaped hook) — **never a `setInterval`+`fetch` inside a component.** When push lands, that module changes and no component does; a timer sprinkled across 40 components is what turns the swap into a rewrite. Note the old targets (presence < 5 s, ≤ 60 s lag) were **never achievable on any transport** — the agent batches every **300 s**, so real lag is **~5 min**. Don't build UI that implies live. |
| 4.7 | **Per-project roles** | `GET /v1/projects/{id}` returns the caller's resolved `authority` | ✅ **Buildable.** Independent of org RBAC, own authority matrix. |
| 4.8 | **Dashboard layout** | `GET/PUT /v1/me/dashboard-layouts{,/{type}}` | ✅ **Buildable.** Type is **derived (no user choice)**, persisted per-user per-type, perm-filtered. |
| **4.9** | **Manual project hold** *(new — unblocked by §0.4)* | `PATCH /v1/projects/{id}` | ✅ **Newly possible.** `status_reason: manual` survives the next time entry; only `auto-hold` is auto-resumed. This intent was previously inexpressible. |

**Not in §4 but now built, and currently mock in the frontend** — each is a wiring job, not a design:
`workforce` (departments, teams, directory, invite lifecycle) · `leave_approvals` (types, balances,
requests, approvals, **bulk-decide** — no frontend surface at all) · `payroll_billing` (runs, comp,
deductions, finalize, change-plan) · `notifications` (list, prefs, mark-read) · `identity`
(audit, security-events, appearance, sessions, ownership transfer, org close/reopen/export).

---

## Reference — locked values the UI must not invent

- **Screenshot cadence:** `off / 3 / 5 / 10` min, **default 5** (+ blur, retention). Agents pull on heartbeat via ETag.
- **Retention:** 90-day default (DDB TTL synced to the S3 lifecycle), admin-configurable.
- **Idle / break:** idle at **≥5 min** no input; **≥15 min** idle ⇒ break.
- **Productivity score (deterministic Rust, never LLM):** `0.25·U + 0.40·Q + 0.15·F + 0.20·R` → 0–100.
  Bands: **85+ strong / 70–85 solid / 50–70 low / <50 flag-for-human-review** (never auto-action).
  Show the **component breakdown**; prefer the **relative** signal (vs the user's own 30-day EWMA
  baseline) — *"Managers act on the relative trend + anomalies, never an absolute cross-person
  leaderboard."*
- **Auto-hold:** `auto_hold_days` **default 14**; projects only, never tasks.
- **Invites:** token + OTP (hashes only), **7-day TTL**, lock at **5** failed OTP attempts.
- **Field-level RBAC:** payroll/PII stripped **server-side** by a field-mask serializer. *"UI gating
  is UX only; the field mask runs regardless."* The frontend must tolerate fields **being absent**.

## What's left, in order

1. **§1.5 + §1.6** — session and password policy editors → read-only. Frontend-local, no route
   needed, and the same class of error as the MFA controls already removed: switches for a decision
   the org doesn't get to make. `ReadOnlyField` already exists in `security-center.tsx`.
2. **§4.3 support tickets** and **§4.8 dashboard layout** — routes exist, UI largely exists.
3. **§4.2 role editor** — the biggest genuine build, fully unblocked.
4. **§4.5 daily goal**, **§4.7 per-project authority**, **§4.9 manual hold** — small, unblocked.
5. **§4.1 palette** — only after the backend decides on projects/tasks in search.

**Blocked, don't start:** §4.4 (no backend at all) · §3.3's server-state half. *(§4.6 was listed here until 2026-07-17 — no longer blocked; polling **is** the design, and the WebSocket is a deferred future migration.)*

**Held on purpose:** §1.2 (the web timer) — see the row. Deleting it before the agent exists leaves
the demo with no timer.

**One open backend defect:** §0.2. Everything else on that list is fixed.
