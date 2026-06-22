# 06 · Approvals · Communication · Notifications · Jobs · Integrations · Billing

Sections 17–22 (SPEC §3, Phase 4). Inside the [global app shell](00-index.md).

---

# Section 17 — Approval Center  `/approvals`

## 17.1 Approvals Inbox  `/approvals`
```
┌───────────────────────────────────────────────────────────────────────┐
│ Approvals   [Type ▼][Status: Pending ▼]   queue: 12      [Bulk ▼]       │
│ Tabs: [Time entries][Timesheets][Leave][Expenses][Corrections]          │
├──────┬──────────────────────────────────────────────────────────────────┤
│ [ ]  │ 👤 A.Rao · Manual entry 1h30m · "client call" · Jun 21  [✓][✕][👁]│
│ [ ]  │ 👤 M.Khan· Timesheet wk Jun16–22 · 41h           [✓][✕][👁]│
│ [ ]  │ 👤 S.Lee · Leave 2 days · Jun 30–Jul 1           [✓][✕][👁]│
│ [ ]  │ 👤 J.Diaz· Time correction · +0h45m              [✓][✕][👁]│
├──────┴──────────────────────────────────────────────────────────────────┤
│ Selected → [ Approve all ] [ Reject all ]   ⓘ comment optional on action │
└───────────────────────────────────────────────────────────────────────┘
```
- `👁` → detail drawer (full request + history + approve/reject with comment). Tabs cover types 17.1–17.5.

## 17.2 Request Detail (drawer)
Requester · type · values (before/after for corrections) · attachments · timeline · [Approve][Reject][Request changes] + comment box.

## 17.3 Escalation Rules  `/approvals/escalation`
Table: if not actioned in [24h] ▼ → escalate to [role/person ▼]; auto-approve under [threshold]; per-type rules. `[+ Add rule]`.

---

# Section 18 — Internal Communication  `/inbox`

## 18.1 Business Mail Inbox  `/inbox`
```
┌──────────────┬──────────────────────┬──────────────────────────────────┐
│ FOLDERS      │ MESSAGE LIST         │ READING PANE                     │
│ 📥 Inbox (4) │ ● A.Rao  Re: sprint  │ Subject: Re: sprint planning     │
│ 📤 Sent      │   M.Khan Design rev  │ From A.Rao · Jun 22 09:14        │
│ 📝 Drafts(2) │   HR     Policy upd  │ ──────────────────────────────  │
│ 📢 Org annc. │   S.Lee  PTO         │ Body…                            │
│ 👥 Team annc.│   …                  │                                  │
│ 🗂 Templates  │                      │ [Reply][Reply all][Forward]      │
│ 🕓 History   │ [Compose ✎]          │                                  │
└──────────────┴──────────────────────┴──────────────────────────────────┘
```

## 18.2 Sent Mail `/inbox/sent` · 18.3 Drafts `/inbox/drafts`
Same three-pane; list scoped to folder; drafts open in composer.

## 18.4 Compose (modal/drawer)
To ▼ (people/teams) · Subject · rich-text body · attachments ▢ · [Use template ▼] · [Save draft][Send].

## 18.5 Organization Announcements `/inbox/org` · 18.6 Team Announcements `/inbox/team`
Feed of announcement cards (title · author · audience · date · read count); `[+ New announcement]` → audience picker + body + pin toggle.

## 18.7 Templates  `/inbox/templates`
List of message templates: name · category · preview · [Edit][Use]; `[+ New template]` (rich editor with variables `{{name}}`).

## 18.8 Notification History  `/inbox/history`
Table of all sent system/comms notifications: type · recipient · channel · status · time. (Links with Notification Center.)

---

# Section 19 — Notification Center  `/notifications`

## 19.1 All Notifications  `/notifications`
```
┌───────────────────────────────────────────────────────────────────────┐
│ Notifications   [All ▼][Unread]   [Mark all read]  [⚙ Preferences]      │
│ Filter chips: [Deadlines][Productivity][Approvals][Billing][Security]   │
├───────────────────────────────────────────────────────────────────────┤
│ ● ⚠ Deadline   PROJ-2 due in 2h                          09:12  [→]    │
│   ✓ Approval   Your timesheet was approved               08:40  [→]    │
│ ● 📉 Productiv. Team C below threshold (54%)              Yesterday     │
│   💳 Billing    Invoice #1042 paid                        Jun 20        │
│   🛡 Security    New login from Chrome · Mumbai            Jun 19        │
└───────────────────────────────────────────────────────────────────────┘
```
- Covers types 19.1–19.6 (Email/Deadline/Productivity/Approval/Billing/Security) as filter categories.

## 19.2 Notification Preferences  `/notifications/preferences`
```
│ Preferences                                                   │
│ Category          │ In-app │ Email │ Frequency               │
│ Deadlines         │ [x]    │ [x]   │ Realtime ▼              │
│ Productivity      │ [x]    │ [ ]   │ Daily digest ▼          │
│ Approvals         │ [x]    │ [x]   │ Realtime ▼              │
│ Billing           │ [x]    │ [x]   │ Realtime ▼              │
│ Security          │ [x]    │ [x]   │ Realtime ▼              │
│ Quiet hours [22:00–07:00]   [ Save preferences ]              │
```

---

# Section 20 — Job Portal  `/jobs`

## 20.1 Internal Jobs / Open Positions  `/jobs`
```
┌───────────────────────────────────────────────────────────────────────┐
│ Jobs   🔍   [Dept ▼][Location ▼][Type ▼]      [+ Post a job]            │
├───────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────┐ ┌─────────────────────────────┐        │
│ │ Senior Backend Engineer     │ │ Product Designer            │        │
│ │ Engineering · Remote · FT   │ │ Design · Mumbai · FT        │        │
│ │ 14 applicants · Open        │ │ 7 applicants · Open         │        │
│ │ [View][Refer]               │ │ [View][Refer]               │        │
│ └─────────────────────────────┘ └─────────────────────────────┘        │
└───────────────────────────────────────────────────────────────────────┘
```

## 20.2 Job Detail / Applications  `/jobs/[id]`
Header (title · dept · type · location · status) + tabs: Description · Applications (table: candidate · stage · score · applied · [View]) · Referrals.

## 20.3 Candidate Pipeline  `/jobs/[id]/pipeline`
```
│ Pipeline (Kanban)                                             │
│ Applied(14) │ Screen(6) │ Interview(3) │ Offer(1) │ Hired(0)  │
│ ┌────────┐  │ ┌────────┐│ ┌────────┐  │ ┌────────┐│           │
│ │👤 cand │  │ │👤 cand ││ │👤 cand │  │ │👤 cand ││  «drag    │
│ │ score  │  │ │        ││ │        │  │ │        ││  stages»  │
│ └────────┘  │ └────────┘│ └────────┘  │ └────────┘│           │
```

## 20.4 Referrals  `/jobs/referrals`
List of referrals: referrer · candidate · job · stage · reward status; `[+ Refer someone]` form.

## 20.5 Hiring Dashboard  `/jobs/dashboard`
KPIs (open roles · applicants · time-to-hire · offer rate) + funnel chart + by-department breakdown.

---

# Section 21 — Integrations Marketplace  `/integrations`

## 21.1 Marketplace  `/integrations`
```
┌───────────────────────────────────────────────────────────────────────┐
│ Integrations   🔍   [Category ▼]  [Connected only ◯]                    │
├───────────────────────────────────────────────────────────────────────┤
│ ┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐                      │
│ │ Slack  ││ Teams  ││  Jira  ││ Asana  ││ Trello │                      │
│ │●Connect││ Connect││●Connect││ Connect││ Connect│  «status badge»      │
│ └────────┘└────────┘└────────┘└────────┘└────────┘                      │
│ ┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐                      │
│ │ GitHub ││ GitLab ││GWorkspc││Outlook ││  Zoom  │                      │
│ └────────┘└────────┘└────────┘└────────┘└────────┘                      │
├───────────────────────────────────────────────────────────────────────┤
│ [ Custom Webhooks → ]   [ API Keys → ]                                  │
└───────────────────────────────────────────────────────────────────────┘
```

## 21.2 Integration Detail  `/integrations/[name]`
Logo · description · permissions requested · [Connect]/[Disconnect] · config form (channel mapping, sync options) · last sync status.

## 21.3 Custom Webhooks  `/integrations/webhooks`
Table: name · URL · events ▼ · status · last delivery · [Test][Edit]; `[+ Add webhook]`.

## 21.4 API Keys  `/integrations/api-keys`
```
│ API Keys                                      [+ Generate key]│
│ Name        │ Key (masked)        │ Created │ Last used │     │
│ CI bot      │ sk_live_••••4f2a 👁📋│ Jun 1   │ 2h ago    │ ✕   │
│ ⚠ Keys shown once on creation.                               │
```

---

# Section 22 — Billing & Subscription  `/billing`

Tabs: **Overview · Plans · Subscription · Invoices · Usage · Payment Methods · Reports · Tax**.

## 22.1 Billing Overview  `/billing`
```
┌───────────────────────────────────────────────────────────────────────┐
│ Billing ▸ Overview                                                      │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                      │
│ │ Current plan │ │ This cycle   │ │ Seats        │                      │
│ │ Business     │ │ $1,776       │ │ 148 / 150    │                      │
│ │ [Change plan]│ │ due Jul 1    │ │ ▰▰▰▰▰▰▰▱     │                      │
│ └──────────────┘ └──────────────┘ └──────────────┘                      │
│ ░░ spend-over-time chart ░░    │ Next invoice preview                   │
│ Recent invoices (mini table)   [View all →]                            │
└───────────────────────────────────────────────────────────────────────┘
```

## 22.2 Plans  `/billing/plans`
Plan comparison cards (Free/Pro/Business/Enterprise) with current highlighted; [Upgrade]/[Downgrade] → confirm modal (proration note).

## 22.3 Subscription Management  `/billing/subscription`
Status · renewal date · billing cycle (Monthly/Annual toggle) · seats stepper · [Cancel subscription] (danger) · auto-renew toggle.

## 22.4 Invoices  `/billing/invoices`
TanStack table: invoice # · date · amount · status (Paid/Due/Overdue) · [⬇ PDF][View]. Filters by status/date.

## 22.5 Usage Analytics  `/billing/usage`
Charts: active seats over time, feature usage, storage; cost breakdown by module.

## 22.6 Payment Methods  `/billing/payment-methods`
```
│ Payment methods                              [+ Add card]     │
│ ◉ Visa •••• 4242   exp 08/27   default       [Edit][Remove]   │
│ ○ Mastercard •••• 1881  exp 03/26            [Edit][Remove]   │
│ Billing email [finance@acme.com]                              │
```

## 22.7 Payment Gateway (checkout modal)
Mock checkout: plan summary · card form · billing address · [Pay $X] → success/failure states (simulated).

## 22.8 Billing Reports `/billing/reports` · 22.9 Tax Settings `/billing/tax`
Reports: exportable spend/seat reports. Tax: tax ID · region ▼ · tax rate · reverse-charge toggle.
