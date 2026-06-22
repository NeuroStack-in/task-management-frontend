# 05 · Reports Center · AI Center · Anomaly Detection

Sections 14–16 (SPEC §3). Inside the [global app shell](00-index.md).

---

# Section 14 — Reports Center  `/reports`

## 14.1 Reports Home
```
┌───────────────────────────────────────────────────────────────────────┐
│ Reports   🔍   [Range ▼]            [+ Custom report] [📅 Schedule]      │
├───────────────────────────────────────────────────────────────────────┤
│ REPORT TYPES (cards → open generated report)                            │
│ ┌──────────┐┌──────────┐┌──────────┐┌──────────┐                       │
│ │Productiv.││ Activity ││  Time    ││ Project  │                        │
│ └──────────┘└──────────┘└──────────┘└──────────┘                       │
│ ┌──────────┐┌──────────┐┌──────────┐┌──────────┐                       │
│ │  Team    ││ Employee ││   AI     ││Executive │                        │
│ └──────────┘└──────────┘└──────────┘└──────────┘                       │
│ ┌──────────┐┌──────────┐┌──────────┐┌──────────┐                       │
│ │Comparison││Utilizat. ││Leaderbrd ││ Custom…  │                        │
│ └──────────┘└──────────┘└──────────┘└──────────┘                       │
├───────────────────────────────────────────────────────────────────────┤
│ Recent / saved reports (table) · Scheduled reports →                    │
└───────────────────────────────────────────────────────────────────────┘
```

## 14.2 Generated Report View  `/reports/[type]`
```
┌───────────────────────────────────────────────────────────────────┐
│ Productivity Report   [Range ▼][Team ▼][User ▼]   [⬇ Export ▼]     │
│                                                    CSV · PDF       │
├───────────────────────────────────────────────────────────────────┤
│ Summary KPIs:  Avg prod 84%  · Hours 1,240 · Top team: Eng         │
│ ┌───────────────────────────┬───────────────────────────┐         │
│ │ ░░ trend line ░░           │ ░░ comparison bars ░░      │         │
│ └───────────────────────────┴───────────────────────────┘         │
│ Detail table (TanStack): user·hours·active%·score·trend           │
└───────────────────────────────────────────────────────────────────┘
```
- Export ▼: **CSV** (PapaParse) / **PDF** (jsPDF + html2canvas). Covers report types 14.x: Productivity · Activity · Time · Project · Team · Employee · Executive · Utilization.

## 14.3 AI Reports  `/reports/ai`
Same frame but narrative-first: AI-written summary block on top, supporting charts below, "Regenerate" + "Ask follow-up" → AI Center.

## 14.4 Comparison Reports  `/reports/comparison`
Pick 2+ entities (users/teams/periods) → side-by-side KPI columns + overlaid charts.

## 14.5 Utilization Reports  `/reports/utilization`
Billable vs non-billable, capacity vs logged, per person/project utilization %.

## 14.6 Leaderboards  `/reports/leaderboards`
```
│ Leaderboard   [Metric: Productivity ▼][Period ▼]              │
│ 🥇 A. Rao    96%  ▰▰▰▰▰                                       │
│ 🥈 M. Khan   93%  ▰▰▰▰▱                                       │
│ 🥉 S. Lee    90%  ▰▰▰▰▱                                       │
│ 4. J. Diaz   88%  …                                           │
```

## 14.7 Custom Report Builder  `/reports/custom`
```
┌──────────────────────────┬────────────────────────────────────┐
│ CONFIG                   │ LIVE PREVIEW                         │
│ Metrics  [+ add ▼]       │ ┌──────────────────────────────────┐ │
│  · Productivity          │ │ ░░ chart preview ░░              │ │
│  · Hours                 │ │                                  │ │
│ Dimensions ▼ (by user…)  │ │ table preview…                   │ │
│ Filters: team/date/proj  │ └──────────────────────────────────┘ │
│ Visualization ▼ (line…)  │                                      │
│ [ Save report ]          │ [⬇ Export]  [📅 Schedule]            │
└──────────────────────────┴────────────────────────────────────┘
```

## 14.8 Scheduled Reports  `/reports/scheduled`
Table: report · cadence ▼ · recipients · format · next run · enabled [toggle]; `[+ Schedule report]` modal (report, frequency, recipients, format).

---

# Section 15 — AI Center  `/ai`

## 15.1 AI Chatbot / Assistant  `/ai`  (also the global slide-over panel)
```
┌──────────────┬────────────────────────────────────────────────────┐
│ CONVERSATIONS│  🤖 AI Assistant                                    │
│ + New chat   │  ┌──────────────────────────────────────────────┐  │
│ · Weekly recap│  │ You: Summarize this week for Engineering     │  │
│ · Compare A/B │  │ ──────────────────────────────────────────── │  │
│ · Burnout chk │  │ 🤖: Engineering logged 412h, avg prod 84%    │  │
│ · …           │  │     (▲4% w/w). 2 burnout risks flagged…      │  │
│               │  │     [📊 view chart] [📄 open report]         │  │
│               │  └──────────────────────────────────────────────┘  │
│               │  Suggested:                                         │
│               │  [Generate report][Compare employees]              │
│               │  [Show productivity][Summarize week]               │
│               │  ┌──────────────────────────────────────────────┐  │
│               │  │ Ask anything…                          [Send] │  │
│               │  └──────────────────────────────────────────────┘  │
└──────────────┴────────────────────────────────────────────────────┘
```
- Backed by mock AI service (`generateSummary`/`compareEmployees`/`analyzeProductivity`, TDD §12). Quick-action chips run canned flows.

## 15.2 AI Summaries hub  `/ai/summaries`
Cards: Daily · Weekly · Monthly. Each → narrative + supporting mini-charts; [Regenerate][Share][Export].

## 15.3 Daily Summary `/ai/daily` · 15.4 Weekly Summary `/ai/weekly`
Narrative report: highlights · risks · recommendations · key metrics; date navigator.

## 15.5 Productivity Insights  `/ai/insights`
Feed of AI insight cards: "Focus time dropped 12% on Wed", each with evidence chart + [Act] (create task / notify).

## 15.6 Employee Comparison `/ai/compare/employees` · 15.7 Team Comparison `/ai/compare/teams`
Select entities → AI narrative + comparison charts (see Reports 14.4 styling) with AI commentary.

## 15.8 Burnout Detection  `/ai/burnout`
```
│ Burnout risk                              [Team ▼]            │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐                       │
│ │ 👤 M.Khan│ │ 👤 R.Sen │ │ 👤 …     │  «risk cards»         │
│ │ HIGH ⚠   │ │ MED      │ │ LOW      │                       │
│ │ 46h/wk · │ │ overtime │ │          │                       │
│ │ no breaks│ │ 3 days   │ │          │                       │
│ │[Recommend]│ │[Recommend]│ │          │                      │
│ └──────────┘ └──────────┘ └──────────┘                       │
```

## 15.9 Risk Detection  `/ai/risk` · 15.10 Trend Analysis  `/ai/trends`
Risk: ranked risk list (productivity, attendance, anomaly) with scores. Trends: long-range trend charts + AI annotations of inflection points.

## 15.11 Recommendations  `/ai/recommendations`
Actionable cards: recommendation · rationale · impact estimate · [Apply][Dismiss].

## 15.12 AI Generated Reports  `/ai/reports`
Library of AI-authored reports (links into Reports 14.3).

---

# Section 16 — Anomaly Detection Center  `/anomalies`

> Simulated frontend detection only (PRD §14).

## 16.1 Risk Dashboard  `/anomalies`
```
┌───────────────────────────────────────────────────────────────────────┐
│ Anomalies ▸ Risk Dashboard          [Range ▼][Severity ▼]               │
│ ┌────────┐┌────────┐┌────────┐┌────────┐                                │
│ │Open    ││Critical││ Today  ││Resolved│  KPIs                          │
│ │  14    ││   3 ⚠  ││   5    ││  62    │                                │
│ └────────┘└────────┘└────────┘└────────┘                                │
│ ░░ anomalies-over-time chart ░░     │ ░░ by-type donut ░░               │
├───────────────────────────────────────────────────────────────────────┤
│ Recent anomalies (feed):                                                │
│ ⚠ Long inactivity · J.Diaz · 2h13m gap · 11:00     [Review]            │
│ 🔴 Productivity drop · Team C · −22% vs avg          [Review]           │
│ 🟡 Missing screenshots · S.Lee · 4 gaps             [Review]           │
└───────────────────────────────────────────────────────────────────────┘
```

## 16.2 Inactivity Detection  `/anomalies/inactivity`
List of long-inactivity events: user · duration · window · timer state · [Dismiss][Flag].

## 16.3 Unusual Activity Detection  `/anomalies/unusual`
Pattern outliers (off-hours spikes, impossible activity) with baseline-vs-observed mini chart.

## 16.4 Productivity Drops  `/anomalies/productivity`
Users/teams with sharp drops vs baseline; severity; trend sparkline.

## 16.5 Missing Data Detection `/anomalies/missing` · 16.6 Screenshot Gaps `/anomalies/screenshot-gaps`
Tables of expected-but-absent data windows; capture/upload gaps; [Notify agent].

## 16.7 Behavioral Analysis  `/anomalies/behavioral`
Per-user behavior baseline vs current (active hours, app mix, idle pattern) with deviation score.

## 16.8 Alert Management  `/anomalies/alerts`
```
│ Alert rules                                   [+ New rule]    │
│ Type ▼            │ Threshold │ Severity │ Channel │ On/Off   │
│ Long inactivity   │ > 30 min  │ Med      │ in-app  │ [●]      │
│ Productivity drop │ < −20%    │ High     │ email   │ [●]      │
│ Missing screenshot│ > 3 gaps  │ Low      │ in-app  │ [◯]      │
```
