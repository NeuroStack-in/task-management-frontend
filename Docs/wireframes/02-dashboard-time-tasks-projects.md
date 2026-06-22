# 02 · Dashboard · Time Tracking · Tasks · Projects

Sections 4–7 (SPEC §3) — the **MVP productivity core** (Phase 2). All inside the [global app shell](00-index.md#global-app-shell-authenticated-layout).

---

# Section 4 — Dashboard Center  `/dashboard`

## 4.1 Executive Dashboard (default)
```
┌───────────────────────────────────────────────────────────────────────┐
│ Dashboard ▸ Executive            [ Range: This week ▼ ] [⚙ Customize]   │
├───────────────────────────────────────────────────────────────────────┤
│ ┌─────────┐┌─────────┐┌─────────┐┌─────────┐┌─────────┐┌─────────┐      │
│ │Product. ││ Active  ││Inactive ││ Running ││ Open    ││Deadlines│ KPIs │
│ │  87% ▲4 ││  142    ││   18    ││ timers  ││ tasks   ││  6 ⚠    │      │
│ │ ░score░ ││ ░░░░░   ││ ░░░░░   ││  37     ││  213    ││         │      │
│ └─────────┘└─────────┘└─────────┘└─────────┘└─────────┘└─────────┘      │
├──────────────────────────────────┬────────────────────────────────────┤
│ Productivity Trends              │ Department Comparison               │
│ ░░░░░░░░ line chart ░░░░░░░░░░    │ ░░░░ horizontal bar chart ░░░░      │
│                                  │                                     │
├──────────────────────────────────┼────────────────────────────────────┤
│ Top Performers                   │ 🤖 AI Summary                       │
│ 1. A. Rao    96% ▰▰▰▰▰          │ "Team productivity up 4% w/w.       │
│ 2. M. Khan   93% ▰▰▰▰▱          │  Engineering trending down — 2      │
│ 3. ...                           │  burnout risks flagged." [Details→] │
├──────────────────────────────────┼────────────────────────────────────┤
│ ⚠ Alerts                         │ 💳 Billing Snapshot                 │
│ • Low productivity: Team C       │ Plan: Business · 148/150 seats      │
│ • Missing screenshots: 3 users   │ Next invoice $1,776 · Jul 1         │
└──────────────────────────────────┴────────────────────────────────────┘
```
- Range selector filters all widgets. `⚙ Customize` → builder (4.4). Each widget card has a `⋮` (refresh / remove / configure).

## 4.2 Team Dashboard  `/dashboard/team`
Same grid, scoped to a selected team: `[Team: Engineering ▼]`. Widgets: team productivity, member leaderboard, active members, team deadlines, team activity heatmap.

## 4.3 Employee Dashboard  `/dashboard/me`
Personal: my productivity score, my timer/today's tracked time, my open tasks, my deadlines, my recent activity timeline, my AI tips. (Default landing for Employee role.)

## 4.4 Custom Dashboard Builder  `/dashboard/customize`
```
┌──────────────────────────────────────────────┬──────────────────────┐
│ CANVAS (drag to arrange · dnd-kit)            │ WIDGET LIBRARY        │
│ ┌──────┐ ┌──────┐ ┌──────────────┐            │ + Productivity        │
│ │ KPI  │ │ KPI  │ │  chart       │  ⋮drag     │ + Activity            │
│ └──────┘ └──────┘ └──────────────┘            │ + Tasks               │
│ ┌──────────────┐ ┌──────┐                     │ + Projects            │
│ │  chart       │ │ list │  «resize handles ⤡»│ + Deadlines           │
│ └──────────────┘ └──────┘                     │ + AI Summary          │
│                                               │ + Billing · Reports   │
│                                               │ + Employees           │
├───────────────────────────────────────────────┴──────────────────────┤
│ [ Cancel ]                       [ Save as… ]      [ Save layout ]     │
└────────────────────────────────────────────────────────────────────────┘
```
- Drag from library onto canvas; drag to reorder; resize; remove via `⋮`. `Save as…` names a layout (4.5).

## 4.5 Saved Dashboard Layouts  `/dashboard/layouts`
List of saved layouts (name · widgets count · last edited) with [Set default] · [Edit] · [Duplicate] · [Delete]; `[+ New layout]` → builder.

---

# Section 5 — Time Tracking  `/time-tracking`

Tabbed module: **Timer · Timesheets · Daily · Weekly · Manual · Approvals · Rules · Idle**.

## 5.1 Live Timer  `/time-tracking`
```
┌───────────────────────────────────────────────────────────────────┐
│ Time Tracking   [Timer][Timesheets][Daily][Weekly][Manual][Idle]    │
├───────────────────────────────────────────────────────────────────┤
│           ┌─────────────────────────────────────────┐               │
│           │            02 : 14 : 53                  │  «big timer»  │
│           │   Task ▼  Design login screen · PROJ-2   │               │
│           │   Project ▼  Acme Web App                │               │
│           │  [ ⏸ Pause ] [ ■ Stop ] [ ⇄ Switch task ]│               │
│           └─────────────────────────────────────────┘               │
│  Today's entries                                                     │
│  ┌──────────┬─────────────────────┬───────────┬─────────┐           │
│  │ 09:02    │ Design login        │ PROJ-2    │ 1h 12m  │           │
│  │ 10:30    │ Standup             │ —         │ 0h 18m  │           │
│  │ 11:05    │ Fix nav bug (active)│ PROJ-2    │ 2h 14m ⏱│           │
│  └──────────┴─────────────────────┴───────────┴─────────┘  Total 3h44m│
└───────────────────────────────────────────────────────────────────┘
```
- Stop → **Auto-submit worklog** dialog:
```
        ┌─────────────────────────────────────┐
        │ Submit work log                     │
        │ Task: Fix nav bug · PROJ-2          │
        │ Duration: 2h 14m  (11:05–13:19)     │
        │ Note  [_________________________]   │
        │ Billable [x]   Activity: 82% active │
        │        [ Discard ]   [ Submit ]     │
        └─────────────────────────────────────┘
```

## 5.2 Timesheets  `/time-tracking/timesheets`
TanStack table: week grid (rows = tasks/projects, cols = Mon–Sun, cells = hours), totals row/column. Header: `[Week ◀ Jun 16–22 ▶]` · `[Submit for approval]` · status badge (Draft/Submitted/Approved).

## 5.3 Daily Timeline  `/time-tracking/daily`
```
│ Daily · Mon Jun 22          [◀ ▶]  [Today]                    │
│ 08 ─────────────────────────────────────────────────── 18    │
│ ▐███ Design ▐  ▐ Standup ▐███████ Fix nav ███▐  ▐idle▐ ▐███▐  │
│ active ───────────── idle (gap) ──────────── active           │
│ Legend: ███ tracked  ▐idle▐ idle  □ untracked                 │
```

## 5.4 Weekly Timeline  `/time-tracking/weekly`
Seven daily lanes stacked; per-day totals on the right; week total header. Click a block → entry detail popover.

## 5.5 Manual Entries  `/time-tracking/manual`
```
│ + Add manual entry                                            │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │ Date [Jun 22 ▼]  Start [09:00] End [10:30]  = 1h 30m      │ │
│ │ Task ▼   Project ▼   Note [__________]  Billable [x]      │ │
│ │ Reason (required) [_______________]  « → approval queue » │ │
│ │                              [ Cancel ]  [ Submit entry ] │ │
│ └──────────────────────────────────────────────────────────┘ │
│ My manual entries (table): date·task·dur·status(Pending/Approved/Rejected)│
```

## 5.6 Approval Requests  `/time-tracking/approvals`
Employee's own submitted requests with status + manager comment. (Manager-side approval = Approval Center, [06](06-business.md).)

## 5.7 Auto Submission Rules  `/time-tracking/rules`
Form: auto-submit on stop [toggle] · round to nearest [5/15 min ▼] · idle handling (deduct / prompt / keep) · daily auto-submit at [time].

## 5.8 Task Switching
Behavior, not a page — the topbar timer `⇄ Switch task` (see [00-index Global Timer](00-index.md)). Timer continues; previous entry auto-closed and logged.

## 5.9 Idle Detection Summary  `/time-tracking/idle`
List of idle periods (start–end · duration · status) with bulk actions: [Keep] [Discard] [Convert to break]. Daily idle total KPI at top.

---

# Section 6 — Tasks & Work Management  `/tasks`

View switcher: **List · Kanban · Calendar · Timeline**. Shared toolbar: `🔍 search · [Filter ▼] · [Sort ▼] · [Group ▼] · [+ New task]`.

## 6.1 Task List  `/tasks`
```
┌───────────────────────────────────────────────────────────────────────┐
│ Tasks  [≣List][▤Kanban][📅Calendar][⊞Timeline]   🔍  [Filter▼] [+ New]  │
├───────────────────────────────────────────────────────────────────────┤
│ [ ] │ Title              │ Assignee │ Project │ Due    │ Priority│Status│
│ [ ] │ Design login       │ 👤 A.Rao │ Acme    │ Jun 24 │ High ▲  │ Todo │
│ [ ] │ Fix nav bug        │ 👤 M.Khan│ Acme    │ Jun 22 │ Urgent  │ Doing│
│ [x] │ Write API docs     │ 👤 S.Lee │ Globex  │ Jun 20 │ Low     │ Done │
│  … TanStack: sortable cols, pagination, row ⋮ (edit/assign/delete)      │
├───────────────────────────────────────────────────────────────────────┤
│ Bulk bar (on select): [Assign ▼] [Set due] [Status ▼] [Delete]          │
└───────────────────────────────────────────────────────────────────────┘
```

## 6.2 Kanban Board  `/tasks/board`
```
┌──────────┬──────────┬──────────┬──────────┐
│ Backlog  │ To Do    │ In Prog. │ Done      │  «dnd-kit columns»
│ (12)     │ (8)      │ (5)      │ (40)      │
│ ┌──────┐ │ ┌──────┐ │ ┌──────┐ │ ┌──────┐  │
│ │card  │ │ │card  │ │ │card⏱ │ │ │card  │  │  «drag cards between
│ │👤 due│ │ │👤 due│ │ │👤 due│ │ │      │  │   columns; WIP count»
│ └──────┘ │ └──────┘ │ └──────┘ │ └──────┘  │
│ + Add    │ + Add    │ + Add    │ + Add     │
└──────────┴──────────┴──────────┴───────────┘
```
- Card: title · labels · assignee avatar · due chip · timer badge if active · comment/attachment counts.

## 6.3 Calendar View  `/tasks/calendar`
FullCalendar month/week/day. Tasks render on due dates; drag to reschedule; click → details drawer. `[Month ▼] [◀ Today ▶]`.

## 6.4 Timeline View (Gantt)  `/tasks/timeline`
Rows = tasks/projects, horizontal date axis, bars = start→due; dependency connectors; drag bar to shift dates; today marker line.

## 6.5 Task Details  `/tasks/[id]` (drawer or full page)
```
┌────────────────────────────────────────────┬──────────────────┐
│ PROJ-2 · Fix nav bug            [⏱ Track]   │ DETAILS          │
│ Status ▼ Doing   Priority ▼ Urgent          │ Assignee 👤 ▼    │
│ ──────────────────────────────────────────  │ Reporter  👤     │
│ Description (rich text)                      │ Project ▼        │
│ …                                            │ Due [Jun 22 ▼]   │
│ ── Subtasks ──────────────                   │ Estimate 4h      │
│ [x] Repro    [ ] Patch   [ ] Test            │ Labels: bug,ui   │
│ ── Attachments ── ▢ ▢ + upload               │ Time logged 2h14m│
│ ── Comments ──────────────                   │ Watchers 👤👤    │
│ 👤 A.Rao: "Repro'd on mobile" · 1h           │ ──────────────── │
│ [ Write a comment…            ] [Send]       │ [Delete task]    │
└────────────────────────────────────────────┴──────────────────┘
```

## 6.6 Task Templates  `/tasks/templates`
List of reusable templates (name · checklist · default assignee/labels) with [Use template] · [Edit] · [+ New template].

## 6.7 Recurring Tasks  `/tasks/recurring`
Table of recurrence rules: task · cadence (Daily/Weekly/Monthly ▼) · next run · enabled toggle · [+ New recurrence].

## 6.8 Deadline Center  `/tasks/deadlines`
Grouped by Overdue / Today / This week / Later; each row: task · project · assignee · countdown chip. Sort by urgency.

## 6.9 Workload Management  `/tasks/workload`
```
│ Workload (this week)            [Team ▼]                       │
│ A. Rao   ▰▰▰▰▰▰▰▱  35h / 40h  (7 tasks)                        │
│ M. Khan  ▰▰▰▰▰▰▰▰▰ 46h / 40h  ⚠ over                          │
│ S. Lee   ▰▰▰▱▱▱▱▱  18h / 40h                                  │
│ « drag tasks between people to rebalance »                     │
```

---

# Section 7 — Project Management  `/projects`

## 7.1 Project Overview (list)  `/projects`
Card/table grid: each project → name · client · progress ▰▰▰▱ · members (avatars) · budget bar · status · due. `[+ New project]`. Filter by status/client/team.

## 7.2 Project Dashboard  `/projects/[id]`
```
┌───────────────────────────────────────────────────────────────────┐
│ Acme Web App ▸ Dashboard   Status: On track   [Edit] [+ Task]       │
│ ┌────────┐┌────────┐┌────────┐┌────────┐                            │
│ │Progress││ Hours  ││ Budget ││ Tasks  │   KPIs                     │
│ │ 68%    ││ 412h   ││ $48k/  ││ 34/50  │                            │
│ │▰▰▰▱    ││        ││ $70k   ││ done   │                            │
│ └────────┘└────────┘└────────┘└────────┘                            │
│ ┌───────────────────────────┬───────────────────────────┐          │
│ │ Burn-down ░░ chart ░░      │ Team allocation ░░ chart ░░│          │
│ └───────────────────────────┴───────────────────────────┘          │
│ Recent activity feed · upcoming milestones                          │
│ Sub-tabs: [Dashboard][Timeline][Team][Reports][Budget][Analytics]   │
└───────────────────────────────────────────────────────────────────┘
```

## 7.3 Project Timeline  `/projects/[id]/timeline`
Gantt of project tasks + milestones (diamonds); phases as grouped bands; critical path highlighted.

## 7.4 Team Allocation  `/projects/[id]/team`
Members table: person · role on project · allocation % · hours logged · [Add/Remove]. Allocation bars; over-allocation warnings.

## 7.5 Project Reports  `/projects/[id]/reports`
Pre-built project report cards (time, productivity, budget) → opens in Reports Center with project pre-filter; [Export CSV/PDF].

## 7.6 Budget Tracking  `/projects/[id]/budget`
```
│ Budget   $48,200 / $70,000        ▰▰▰▰▰▰▱▱▱▱ 69%               │
│ By category:  Dev $32k · Design $9k · QA $7k                   │
│ ░░ spend-over-time line vs budget line ░░                      │
│ Burn rate $4.1k/wk · projected overrun: none                   │
```

## 7.7 Project Analytics  `/projects/[id]/analytics`
Charts: velocity, cycle time, on-time completion %, productivity by member, activity mix. Date range filter + export.
