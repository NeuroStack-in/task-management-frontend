# 07 · Roles · Feature Mgmt · Security · Audit Logs · Remote Support · Agents · Help

Sections 23–29 (SPEC §3). Inside the [global app shell](00-index.md). Roles = Phase 1; Features/Security/Audit = Phase 4; Remote Support/Agents/Help = Phase 5.

---

# Section 23 — Role & Permission Management  `/roles`

## 23.1 Roles List  `/roles`
```
┌───────────────────────────────────────────────────────────────────────┐
│ Roles & Permissions                                  [+ New role]       │
├───────────────────────────────────────────────────────────────────────┤
│ Role           │ Members │ Type     │ Actions                          │
│ Org Owner      │ 1       │ System   │ 👁                                │
│ Admin          │ 3       │ System   │ 👁 ⧉clone                         │
│ Manager        │ 12      │ System   │ 👁 ✎ ⧉                            │
│ Employee       │ 132     │ System   │ 👁 ✎ ⧉                            │
│ Finance (HR)   │ 4       │ Custom   │ 👁 ✎ ⧉ 🗑                          │
│ Auditor        │ 2       │ Custom   │ 👁 ✎ ⧉ 🗑                          │
└───────────────────────────────────────────────────────────────────────┘
```

## 23.2 Custom Role Builder / Permission Matrix  `/roles/[id]`
```
┌───────────────────────────────────────────────────────────────────────┐
│ Edit role: Manager     Name [Manager]   Clone from ▼   [Save]           │
├───────────────────────────────────────────────────────────────────────┤
│ PERMISSION MATRIX                              [Select all] [Clear]     │
│ Module        │ View │ Create │ Edit │ Delete │ Manage │ Export        │
│ Dashboard     │ [x]  │   —    │ [x]  │   —    │   —    │   —           │
│ Tasks         │ [x]  │ [x]    │ [x]  │ [x]    │   —    │   —           │
│ Projects      │ [x]  │ [x]    │ [x]  │ [ ]    │ [x]    │   —           │
│ Reports       │ [x]  │   —    │  —   │   —    │   —    │ [x]           │
│ Activity      │ [x]  │   —    │  —   │   —    │   —    │   —           │
│ Screenshots   │ [ ]  │   —    │  —   │   —    │   —    │   —           │
│ Billing       │ [ ]  │   —    │  —   │   —    │ [ ]    │   —           │
│ Settings      │ [ ]  │   —    │ [ ]  │   —    │ [ ]    │   —           │
│ « maps to Permission{module,action} · TDD §8 »                         │
└───────────────────────────────────────────────────────────────────────┘
```

## 23.3 Clone Role / Assign Permissions
Clone = duplicate matrix into a new named role. Assign permissions = the matrix itself (checkbox grid).

## 23.4 Feature / Navigation / Dashboard Access Control
Within the role editor, extra tabs:
- **Feature access:** toggles per module (which features this role sees).
- **Navigation access:** which sidebar items appear (sidebar is generated from `role.permissions`, SPEC §5).
- **Dashboard access:** which dashboards/widgets the role can open.

## 23.5 Assign Members  `/roles/[id]/members`
Member list with add/remove; bulk assign users to role.

---

# Section 24 — Feature Management  `/settings/features`

Org-level module on/off (SPEC §3 #24). Settings sub-area.
```
┌───────────────────────────────────────────────────────────────────────┐
│ Settings ▸ Features        ⓘ Disabling hides the module org-wide        │
├───────────────────────────────────────────────────────────────────────┤
│ Time Tracking        [●] on    Activity Monitoring   [●] on            │
│ Screenshots          [●] on    AI                    [●] on            │
│ Jobs                 [◯] off   Billing               [●] on            │
│ Reports              [●] on    Integrations          [●] on            │
│ Communication        [●] on    Approvals             [●] on            │
│ ──────────────────────────────────────────────────────────────────    │
│ Changing a toggle → confirm dialog ("hide for 150 users?")   [Save]    │
└───────────────────────────────────────────────────────────────────────┘
```

---

# Section 25 — Security Center  `/security`

Tabs: **MFA · SSO · Password · Sessions · Login history · Devices · Events · Audit trail**.

## 25.1 Security Overview  `/security`
```
│ Security                                                      │
│ ┌────────┐┌────────┐┌────────┐┌────────┐                      │
│ │MFA     ││SSO     ││Active  ││Open    │  KPIs                │
│ │ on ✓   ││ Google ││sessions││ events │                      │
│ │        ││ ✓      ││  37    ││  2 ⚠   │                      │
│ └────────┘└────────┘└────────┘└────────┘                      │
│ Security checklist · recent events feed                       │
```

## 25.2 MFA  `/security/mfa`
Enforce MFA org-wide [toggle] · allowed methods (App/SMS/Email [x]) · grace period · backup codes policy.

## 25.3 SSO  `/security/sso`
Providers (Google/Microsoft) connect cards · enforce SSO [toggle] · domain restriction `@acme.com` · SCIM (future, disabled).

## 25.4 Password Policies  `/security/password`
Min length [12] · require upper/number/symbol [x] · expiry [90d] · reuse limit · lockout after [5] attempts.

## 25.5 Session Policies  `/security/sessions`
Idle timeout ▼ · max session length ▼ · concurrent sessions limit · "remember device" days.

## 25.6 Login History  `/security/login-history`
Table: user · time · IP · location · device · result (Success/Fail/Blocked). Filter + export.

## 25.7 Device Management  `/security/devices`
```
│ Active devices / sessions                                     │
│ 💻 Chrome · Windows · Mumbai · current        [This device]  │
│ 📱 Safari · iPhone · Mumbai · 2h ago          [Revoke]       │
│ 💻 Firefox · Mac · Delhi · 3d ago             [Revoke]       │
│ [ Revoke all other sessions ]                                 │
```
(Section 2.7 Session Management surfaces here.)

## 25.8 Security Events  `/security/events`
Feed of security-relevant events (failed logins, permission escalations, new device) with severity + [Investigate].

## 25.9 Audit Trail
Link/embed into Audit Logs (Section 26).

---

# Section 26 — Audit Logs  `/audit-logs`

```
┌───────────────────────────────────────────────────────────────────────┐
│ Audit Logs   🔍   [Actor ▼][Category ▼][Date ▼]          [⬇ Export]     │
│ Tabs:[User activity][Permission changes][Login events]                  │
│      [Tracking events][Config changes][Security events]                 │
├──────────┬──────────┬─────────────────────────────┬────────────────────┤
│ Time     │ Actor    │ Action                      │ Target / detail    │
│ 09:14    │ A.Rao    │ updated task                │ PROJ-2 status→Doing│
│ 09:02    │ Admin    │ changed permission          │ Manager: +Export   │
│ 08:55    │ M.Khan   │ login                       │ Chrome · Mumbai    │
│ 08:40    │ System   │ config change               │ idle threshold 5→3 │
│ … TanStack: virtualized, immutable, row click → JSON detail drawer      │
└──────────┴──────────┴─────────────────────────────┴────────────────────┘
```
- Read-only. Tabs = categories 26.1–26.6. Row → full before/after detail drawer.

---

# Section 27 — Remote Support Center  `/remote-support`

> Approval-gated, **simulated** remote support (SPEC §2.2 — replaces "reverse shell"). No real remote execution.

## 27.1 Sessions  `/remote-support`
```
┌───────────────────────────────────────────────────────────────────────┐
│ Remote Support      ⚠ All sessions are consent- & approval-gated        │
│ Tabs:[Requests][Approvals][Diagnostics][Agent logs][History]            │
├───────────────────────────────────────────────────────────────────────┤
│ Active / pending sessions:                                              │
│ 👤 S.Lee · Device DESKTOP-12 · Requested 09:10 · PENDING  [Approve][✕] │
│ 👤 J.Diaz· Device LT-44 · In session 12m · ●live          [End]       │
└───────────────────────────────────────────────────────────────────────┘
```

## 27.2 Session Requests  `/remote-support/requests`
Form/list: technician requests access → target user/device · reason · scope (view-only/diagnostics) · expiry. Goes to approvals.

## 27.3 Session Approvals  `/remote-support/approvals`
Pending requests with [Approve][Deny] + the **end-user consent prompt** mock:
```
        ┌─────────────────────────────────────┐
        │ Allow remote support?               │
        │ IT (A.Admin) requests view-only      │
        │ access to your device for 30 min.   │
        │ Reason: "Fix VPN config"            │
        │        [ Deny ]      [ Allow ]      │
        └─────────────────────────────────────┘
```

## 27.4 Device Diagnostics  `/remote-support/diagnostics`
Read-only mock device panel: OS · CPU/mem · network · agent version · running processes (mock) · [Run diagnostic].

## 27.5 Agent Logs  `/remote-support/logs`
Streamed mock log viewer (timestamped lines) with level filter; download.

## 27.6 Support History  `/remote-support/history`
Table of past sessions: technician · user · device · duration · actions · consent record. Audit-linked.

---

# Section 28 — Desktop Agent Management  `/agents`

## 28.1 Agents Overview  `/agents`
```
┌───────────────────────────────────────────────────────────────────────┐
│ Desktop Agents      [OS ▼][Status ▼][Version ▼]   🔍                    │
│ ┌────────┐┌────────┐┌────────┐┌────────┐                                │
│ │Online  ││Offline ││Outdated││Issues  │  KPIs                          │
│ │ 132    ││  18    ││  9     ││  3 ⚠   │                                │
│ └────────┘└────────┘└────────┘└────────┘                                │
├──────────┬──────────┬──────────┬──────────┬──────────┬──────────────────┤
│ Device   │ User     │ Status   │Monitoring│ Version  │ Health           │
│ DESKTOP-1│ A.Rao    │ ●online  │ ●on      │ 2.4.1    │ ▰▰▰▰▰ good       │
│ LT-44    │ J.Diaz   │ ◐idle    │ ◯silent  │ 2.3.0 ⬆  │ ▰▰▰▱▱ warn       │
│ MAC-07   │ S.Lee    │ ○offline │ —        │ 2.4.1    │ — last seen 3d   │
│ row → agent detail drawer (config · policies · logs · [Update][Restart])│
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────────────┘
```
- Columns cover 28.1 Agent / 28.2 Device / 28.3 Monitoring / 28.4 Silent / 28.7 Version / 28.8 Health status.

## 28.5 Agent Configuration  `/agents/config`
Per-agent / global config: capture intervals · idle threshold · upload cadence · proxy · update channel ▼ (stable/beta).

## 28.6 Agent Policies  `/agents/policies`
Policy list: name · applies to (team/role) · settings summary · [Edit]; assign policies to device groups.

## 28.7 Version Management  `/agents/versions`
Release list (version · channel · rollout %) + [Push update to selected] + rollback. Per-version adoption chart.

---

# Section 29 — Help Center  `/help`

## 29.1 Help Home  `/help`
```
┌───────────────────────────────────────────────────────────────────────┐
│                 How can we help?                                        │
│            🔍 [ Search documentation…                    ]              │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│ │📘 Docs   │ │🎬 Videos │ │🧭 Guided │ │❓ FAQs   │                     │
│ │ guides   │ │ tutorials│ │ walkthru │ │          │                     │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘                    │
│ Popular articles · Contact support · [Open a ticket]                    │
└───────────────────────────────────────────────────────────────────────┘
```

## 29.2 Documentation / Product Guides  `/help/docs`
Two-pane: left category/article tree · right article (prose, screenshots, code). Breadcrumb + "Was this helpful?".

## 29.3 Video Tutorials  `/help/videos`
Grid of video cards (thumbnail · title · duration) → player modal.

## 29.4 Guided Walkthroughs  `/help/walkthroughs`
List of interactive tours → launches **react-joyride** overlay on the relevant module (reuses onboarding tour engine).

## 29.5 FAQs  `/help/faq`
Searchable accordion grouped by topic.

## 29.6 Support Tickets  `/help/tickets`
```
│ My tickets                                   [+ New ticket]   │
│ #1042 Timer not saving      Open · High    · 2h ago    [View] │
│ #1037 Export PDF blank      Resolved       · Jun 18    [View] │
│ Ticket detail → thread + status + attachments + reply box     │
```

## 29.7 Contact Support  `/help/contact`
Channels: live chat (→ AI Assistant fallback) · email form · phone/SLA info by plan.
