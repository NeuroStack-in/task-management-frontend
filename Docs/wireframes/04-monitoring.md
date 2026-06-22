# 04 · Activity Monitoring · Screenshots · Monitoring Config · App & URL Management

Sections 10–13 (SPEC §3). **All UI + mock data only — no real capture** (SPEC §2.4). Surveillance features sit behind the mock-service layer; show consent/ethics affordances throughout.

---

# Section 10 — Activity Monitoring  `/activity`

Tabs: **Live · Timeline · Active/Inactive · Keyboard · Mouse · Heatmap · Apps · Websites · User · Team**.

## 10.1 Live Activity  `/activity`
```
┌───────────────────────────────────────────────────────────────────────┐
│ Activity ▸ Live          [Team ▼] [Auto-refresh ●]   ⓘ Consent-based   │
├───────────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐                    │
│ │ 👤 A.Rao │ │ 👤 M.Khan│ │ 👤 S.Lee │ │ 👤 J.Diaz│  «live cards»      │
│ │ ● active │ │ ● active │ │ ◐ idle 4m│ │ ○ offline│                    │
│ │ 92% ▰▰▰▰ │ │ 88% ▰▰▰▱ │ │ —        │ │ —        │                    │
│ │ VS Code  │ │ Figma    │ │ Slack    │ │ —        │  «current app»     │
│ │ ⏱ PROJ-2 │ │ ⏱ PROJ-5 │ │ ⏱ —      │ │ —        │                    │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘                    │
└───────────────────────────────────────────────────────────────────────┘
```

## 10.2 Activity Timeline  `/activity/timeline`
Per-user horizontal timeline (like Time Daily) colored by activity level; hover → app/url at that moment; gaps = idle/offline.

## 10.3 Active vs Inactive Analysis  `/activity/active-inactive`
Stacked area/bar of active vs inactive over time; donut of split; filter by user/team/range.

## 10.4 Keyboard Analytics  `/activity/keyboard` · 10.5 Mouse Analytics  `/activity/mouse`
```
│ Keyboard activity     [User ▼][Range ▼]                       │
│ ░░░░░░ keystrokes-over-time line ░░░░░░                        │
│ Avg 142/min · Peak 310 · Idle gaps: 6        ⓘ counts only,   │
│ « mouse view: clicks, distance, movement heatmap »   no keylog│
```

## 10.6 Productivity Heatmap  `/activity/heatmap`
```
│ Heatmap   [User/Team ▼]   [Week ▼]                            │
│        Mon Tue Wed Thu Fri                                    │
│ 08-10  ▓▓  ░░  ▓▓  ██  ▒▒    ██ high  ▓ med  ░ low  · none    │
│ 10-12  ██  ██  ▓▓  ██  ▓▓                                     │
│ 12-14  ░░  ▒▒  ░░  ▒▒  ░░                                     │
│ 14-16  ▓▓  ██  ██  ▓▓  ██                                     │
```

## 10.7 Application Usage  `/activity/apps` · 10.8 Website Usage  `/activity/websites`
Table + bar: app/site · category badge (Productive/Neutral/Distracting) · time · % · users. Filter by category; click → who used it.

## 10.9 User Monitoring  `/activity/user/[id]`
Single-user deep view: all the above scoped to one person + screenshot strip + current status.

## 10.10 Team Monitoring  `/activity/team/[id]`
Team rollup: members grid, aggregate active/inactive, top apps, team heatmap, outliers flagged.

---

# Section 11 — Screenshot Center  `/screenshots`

Tabs: **Gallery · Timeline · Employee · Project · Analytics · Risk · Missing · Thresholds**.
⚠ Banner: "Screenshots are simulated mock data in Phase 1; capture is consent-gated."

## 11.1 Screenshot Gallery  `/screenshots`
```
┌───────────────────────────────────────────────────────────────────────┐
│ Screenshots ▸ Gallery  [User ▼][Project ▼][Date ▼][Score ▼]  [⊞][≣]     │
├───────────────────────────────────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                   │
│ │░thumb│ │░thumb│ │░thumb│ │░thumb│ │░thumb│ │░thumb│  «grid of shots»  │
│ │09:14 │ │09:24 │ │09:34 │ │09:44 │ │09:54 │ │10:04 │                   │
│ │82% 👤│ │76% 👤│ │ 91%👤│ │ 45%⚠│ │ 88%👤│ │ 79%👤│  «score badge»    │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘                   │
│  click → lightbox (full image · user · time · app · score · prev/next)  │
└───────────────────────────────────────────────────────────────────────┘
```

## 11.2 Timeline View  `/screenshots/timeline`
Per-user horizontal strip of thumbnails along time axis; gaps highlighted (→ Missing). Scrub bar.

## 11.3 Employee Screenshots  `/screenshots/employee/[id]` · 11.4 Project Screenshots  `/screenshots/project/[id]`
Gallery pre-filtered to one employee / project; summary header (count · avg score · gaps).

## 11.5 Screenshot Analytics  `/screenshots/analytics`
Charts: shots/day, avg productivity score trend, score distribution, by-user comparison.

## 11.6 Screenshot Risk Analysis  `/screenshots/risk`
List of low-score / flagged shots with risk reason (low productivity, distracting app, blank screen); [Review][Dismiss].

## 11.7 Missing Screenshots  `/screenshots/missing`
Table: user · expected vs captured · gap windows · last seen · [Notify]. KPI: capture rate %.

## 11.8 Screenshot Threshold Rules  `/screenshots/thresholds`
```
│ Capture rules                                                 │
│ Frequency   ( ) Off ( ) Every 15m ◉ Every 10m ( ) 5m          │
│ Randomized threshold  [toggle ●]  jitter ± [3] min            │
│ Blur sensitive content [toggle ●]                             │
│ Capture only while timer running [toggle ●]                   │
│ Per-team overrides ▾                       [ Save rules ]     │
```

---

# Section 12 — Monitoring Configuration  `/settings/monitoring`

Settings sub-area (left settings nav as in [03 §9](03-employees-organization.md)).

## 12.1 Idle Thresholds
Idle after [5] min ▼ · prompt user on idle [toggle] · auto-pause timer on idle [toggle] · per-role overrides.

## 12.2 Screenshot Thresholds
Mirrors 11.8 from the config side (frequency, randomization, blur). Single source toggle.

## 12.3 Productivity Thresholds
```
│ Productive ≥ [70]%   Neutral [40–69]%   Low < [40]%           │
│ ▰▰▰▱  sliders                                                 │
│ Alert when team productivity < [55]% for [2] days             │
```

## 12.4 Daily Work Hour Rules
Expected hours/day [8] · min hours before alert [6] · overtime threshold [10] · flag under/over.

## 12.5 Alert Thresholds
Table of alert rules: metric ▼ · condition ▼ · value · severity ▼ · channel(s) · enabled [toggle]; `[+ Add rule]`.

## 12.6 Monitoring Policies
Which roles can view activity/screenshots; data retention period ▼; consent statement editor; anonymize toggle.

## 12.7 Silent Monitoring Settings
```
│ Silent mode  [toggle ◯]   ⚠ Requires consent policy enabled  │
│ Notify employees monitoring is active [toggle ●] (recommended)│
│ Show tray indicator [toggle ●]    Quiet hours [22:00–06:00]   │
```

---

# Section 13 — Application & URL Management  `/settings/tracking-rules`

Settings sub-area. Tabs: **Apps · URLs · Allow · Block · Categories · Scoring · Exceptions**.

## 13.1 Application Tracking
Table: application · category ▼ (Productive/Neutral/Distracting) · tracked [toggle] · #users. Search + bulk categorize.

## 13.2 URL Tracking
Same as apps but for domains/URLs; pattern support (`*.github.com`).

## 13.3 Allow Lists  `/settings/tracking-rules/allow` · 13.4 Block Lists  `/settings/tracking-rules/block`
```
│ Block list                                  [+ Add pattern]   │
│ ┌────────────────────────────────┬───────────┬─────┐         │
│ │ *.facebook.com                 │ Block     │ ✕   │         │
│ │ tiktok.com                     │ Block     │ ✕   │         │
│ │ steam://*                      │ Warn      │ ✕   │  «mock   │
│ └────────────────────────────────┴───────────┴─────┘  enforce»│
```

## 13.5 Productivity Categories
Manage category definitions: name · color ◼ · default weight; `[+ Add category]`. Drag to set priority.

## 13.6 Productivity Scoring Rules
```
│ Scoring                                                       │
│ Productive app/site  →  +[1.0] weight                         │
│ Neutral              →  +[0.5]                                │
│ Distracting          →  +[0.0] / penalize [-0.2]             │
│ Idle counts as       ( ) zero (◉) excluded                    │
│ Score = weighted active time. Preview: 87%   [ Save ]         │
```

## 13.7 Monitoring Exceptions
Per-user / per-team exceptions: who · what's exempt (screenshots/apps/urls) · reason · expiry. `[+ Add exception]`.
