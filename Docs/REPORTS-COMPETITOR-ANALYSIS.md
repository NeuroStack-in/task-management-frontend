# Reports — Competitor Analysis, Gap-Closing & Differentiation Plan

> **Status:** Research + proposed plan (not yet implemented). Phase 1, frontend-only / mock data.
> **Scope:** The report catalog — both the *downloadable* report surfaces (formats/delivery) **and** the *report types* (content) — benchmarked against the workforce-analytics category, with a positioning plan to make WorkPulse standalone and corporate-attractive.

**Verdict up front:** WorkPulse already covers **~80% of the table-stakes reports** every competitor ships. The play is not "add 30 reports" — it is (a) close ~6 real content gaps, (b) close the format/delivery gaps (Excel, scheduling, builder), and (c) lean hard into 4 differentiators none of them combine well.

---

## 1. What competitors provide as downloadable reports

Across the category (Time Doctor, Hubstaff, ActivTrak, Insightful, DeskTime, Teramind, Toggl, Clockify) the downloadable report catalog is **highly standardized**. It clusters into these types:

| # | Report | Contains | Representative vendors |
|---|--------|----------|------------------------|
| 1 | **Time & Activity / Timesheet** | Hours tracked, billable vs non-billable, activity % per person/day | All |
| 2 | **Attendance & Absence** | Clock in/out, late, leave, absence calendar | Hubstaff, DeskTime, ActivTrak |
| 3 | **Productivity** | Productive vs unproductive time, score, trend | Time Doctor, ActivTrak, Insightful |
| 4 | **Apps & Websites usage** | Categorized (productive/unproductive) app + URL time | Time Doctor, ActivTrak, DeskTime |
| 5 | **Projects & Tasks** | Time per project/task, budgets, allocation | Hubstaff, Toggl, Clockify |
| 6 | **Utilization / Capacity** | Billable utilization %, capacity vs logged | Hubstaff, ActivTrak |
| 7 | **Payroll / Amounts owed / Invoices** | Hours→pay, rates, gross/net, client invoices | Hubstaff, Time Doctor, Clockify |
| 8 | **Screenshots / Monitoring** | Screenshot compliance, gaps, idle time | Insightful, DeskTime, Teramind |
| 9 | **Executive / Summary** | Org-level KPI rollup | ActivTrak, Time Doctor |
| 10 | **Leaderboards / Rankings** | Ranked productivity | Time Doctor, Insightful |
| 11 | **Custom report builder** | Pick metrics/dimensions/filters → export | Time Doctor, ActivTrak, Toggl |

**Formats:** CSV, **XLSX (Excel)**, and PDF are the norm (PDF = shareable/branded).
**Delivery:** **Scheduled + emailed reports** (daily/weekly to recipients) is near-universal.

---

## 2. What WorkPulse already ships (parity — don't rebuild)

WorkPulse is **not behind** — it already covers almost the entire standardized list with **real CSV + PDF** downloads. The Insights report library (`reports-experimental.tsx`, driven by `REPORTS` in `src/lib/mock-insights.ts`) plus per-module exports.

**Central Insights report library** (`/insights/ai-reports`, gated by `reports:export`), each with per-report CSV/PDF + bulk "Download all/selected":

- Productivity Report · Productivity Leaderboard (workforce)
- Timesheet Summary · Utilization Report (time & billing)
- Project Time Allocation (projects)
- Attendance Summary (attendance)
- App & Website Usage (activity)
- Anomaly & Risk Report · Screenshot Compliance (monitoring)

**Per-module exports (real files):**

| Feature | Route | Format | Data |
|---------|-------|--------|------|
| Payroll run | `/payroll` | CSV | Employee, Email, Dept, Hours, Rate, Gross, Tax, Benefits, Net, Status |
| Payslip | `/payroll` | PDF | Per-employee payslip (gross/tax/benefits/net) |
| Employee roster | `/employees` | CSV / PDF | ID, Name, Email, Role, Title, Dept, Team, Status, Productivity % |
| Employee profile | `/employees/[id]` | CSV / PDF | Profile + performance + projects |
| Project report | `/projects/[id]` | PDF | Overview, task-status breakdown, task list |
| Billing invoice | `/billing` | PDF | Per-invoice (number, amount, line items) |
| Attendance log | `/attendance` | CSV | Employee, Dept, Status, Clock in/out, Hours |
| Attendance calendar | `/attendance` | CSV | Date, Weekday, Present, Late, On leave, Absent, Total, Rate % |
| My timesheet | `/time-tracking` | CSV | Task, Project, Start, End, Duration, Billable, Activity % |
| Org data export | `/settings/ownership` | JSON | Full org export |

Plus the supporting modules: Activity monitoring (active/idle, app/URL, heatmaps), **AI Insights / summaries**, **Anomaly detection** (burnout, long inactivity, missing screenshots, low productivity), **Payroll**, **Leave** (self-service), **Approvals** (timesheets).

**Shared infra:** `src/modules/insights/lib/report-export.ts` (`exportCsv`, `exportPdf`, `exportAllPdf`, `exportSelectedCsv`) + `src/lib/download.ts` (`downloadBlob`). All reports use the `ReportDef` shape: `{ id, name, description, category, period, columns: string[], rows: (string|number)[][] }`.

---

## 3. Gap A — delivery & format (how reports ship)

| Gap | Detail |
|-----|--------|
| **No Excel (XLSX)** | Only CSV + PDF; competitors add Excel. |
| **Scheduled/emailed reports** | Specced (`Docs/wireframes/05-reports-ai-anomalies.md` §14.8) but not built. |
| **Custom Report Builder** | Specced (§14.7) but only the library exists, no builder. |
| **Executive & Comparison reports** | Specced but not surfaced as downloads. |
| **Simulated buttons** | Security Center + Audit Logs "Download report" only fire a toast — no real file. |

> Everything specced lives in `Docs/wireframes/05-reports-ai-anomalies.md` (§14 Reports, §15 AI Center). Reporting is slated for **Phase 3 (Monitoring)** per `SPEC.md` §6. Permissions: `reports:view` / `reports:export` (`reports:create` does **not** exist).

---

## 4. Gap B — missing report *types* (content competitors have, we don't)

These are new **report types**, not new formats. Most reuse data we already generate, so effort is low.

| Report | Who has it | Why it matters | Effort | Data we already have |
|--------|-----------|----------------|--------|----------------------|
| **Day Timeline** (chronological view of one person's day) | Time Doctor, Teramind | The #1 "prove the day" artifact managers ask for | Low | activity + attendance |
| **Project Budget / Profitability** (budget burn, cost vs billable) | Hubstaff, Toggl | Turns time into money → agencies/PS orgs buy on this | Low | `projects.json` has budget/spent |
| **Time-off / Absence report** | Clockify, DeskTime | Natural rollup of the new **Leave** module | Low | leave store + attendance |
| **Capacity / Workload & burnout-risk** | Insightful, ActivTrak | Ops planning + duty-of-care | Low | anomaly/burnout signals |
| **Billing & Invoicing** (billable, amounts owed, invoices) | Hubstaff, Toggl, Clockify | Client-billing from tracked hours (we only have *subscription* billing) | Medium | timesheet + rates |
| **Expenses** | Hubstaff, Clockify | Completes the "whole cost of work" story | Medium | new |

---

## 5. Gap C — differentiators that make corporates *choose* us

These go beyond parity. We already have the raw ingredients (AI Insights, Anomaly, unified data), so these are **positioning + packaging**, not from-scratch builds.

1. **Executive Summary / Board Report** — one page: workforce health, utilization, cost, burnout, trend + **AI narrative**. *This is what the buyer (VP/CFO) actually reads.* Competitors gate this behind "executive dashboard"; we make it the headline.
2. **AI-narrated reports** — our unfair advantage. Everyone shows charts; **we explain them** ("Utilization fell 4% — driven by Design overtime; 2 people at burnout risk; recommend redistributing"). Reports that write their own summary + recommendations = the demo moment.
3. **Employee-facing "My Report" (privacy-forward)** — ActivTrak is the only one doing "Personal Insights." Giving employees their *own* transparent, exportable report kills the "surveillance tool" objection that stalls corporate rollouts. We already have the personal dashboard — formalize it as a report. A **trust wedge** that wins deals.
4. **Compliance & Audit Evidence pack** (GDPR / SOC 2 / HIPAA-style) — Teramind owns this and charges enterprise for it. We have **audit logs + consent-aware screenshots**; package them as a compliance/evidence report → unlocks regulated-industry procurement.

**Second-tier corporate magnets (fast follow):** **License / SaaS-cost optimization** (ActivTrak — pure ROI, "we found $X of unused licenses"), **Industry Benchmarks** (C-suite context), **Wellbeing / Work-life-balance** report (retention + ESG narrative).

---

## 6. Positioning

> **WorkPulse = the AI-narrated, privacy-forward workforce-intelligence platform that unifies time, productivity, attendance, payroll *and* leave — with reports that explain themselves and are safe to show the employee.**

Nobody in the benchmark set combines **payroll + leave + monitoring + AI narrative + employee transparency** in one product. Toggl/Clockify are time-only; Teramind is security-only; ActivTrak is analytics-only; Hubstaff is field/payroll. WorkPulse sits in the middle with the AI + trust layer on top.

---

## 7. Prioritized roadmap

Combines the format/delivery work (§3) with the new report types (§4) and differentiators (§5).

- **P0 — close gaps, highest demo value:** Day Timeline · Project Budget/Profitability · Time-off report (reuse Leave) · **Executive Summary** · Excel (XLSX) export · real files for the two simulated buttons.
- **P1 — differentiate:** **AI-narrated report layer** · Employee **"My Report"** · Capacity/Workload · Custom Report Builder.
- **P2 — enterprise/ROI:** **Compliance & Audit pack** · License/SaaS-cost optimization · Industry Benchmarks · Billing/Invoicing · Expenses · Scheduled reports.

---

## 8. Implementation detail — the format/delivery gaps (§3)

All frontend-only, reuse-first (everything flows through `ReportDef` + `report-export.ts`). Schedule delivery is honestly **simulated** (no backend/email).

### A. Excel (XLSX) export
- Add SheetJS: `npm i xlsx`.
- New helpers in `report-export.ts`: `exportXlsx(report)` (one sheet) and `exportAllXlsx(reports)` (one sheet per report, 31-char sheet-name cap).
- Add a "Download Excel" item to the three export menus in `reports-experimental.tsx` (`ExportMenu`, `DownloadAllButton`, selection menu), gated by the existing `canExport`.
- *Optional:* extend XLSX to the per-module CSV buttons (Payroll, Employees, Attendance, Time-tracking).

### B. Real files for the two simulated buttons
- **Audit Logs** (`audit-logs.tsx` ~L230): build a real CSV from the already-filtered rows via `Papa.unparse` + `downloadBlob`.
- **Security Center** (`security-center.tsx` ~L399): build a `ReportDef` from `SECURITY_OVERVIEW` / policies / methods / activity and export via `exportPdf`/`exportCsv`.

### C. Custom Report Builder (§14.7)
- **Route:** `src/app/(app)/insights/ai-reports/builder/page.tsx` → `/insights/ai-reports/builder` (nested so `permissionForPath()` auto-inherits the `reports:view` guard — avoids the fail-open a `/insights/builder` route would hit).
- **Helper `report-builder.ts`:** `FIELD_CATALOG` (workforce = `EMPLOYEE_TIME`, projects = `PROJECT_HOURS`), `BuilderConfig`, and `buildReport(config, scopeIds): ReportDef` (filter → group → aggregate). Output **is** a `ReportDef`, so preview + export are pure reuse.
- **Component `report-builder.tsx`:** two-pane — config (dataset, metrics multi-select, dimension, filter, viz) + live preview (reuse `Table*` markup; charts via the Recharts pattern in `activity-tab.tsx`). Export dropdown → CSV/Excel/PDF; "Schedule" links to the scheduled surface.
- **Optional persisted store `custom-reports.store.ts`** (mirror `dashboard.store.ts`) so "Save report" persists the *config* (rebuild rows on read).

### D. Scheduled Reports (§14.8, simulated delivery)
- **Route:** `src/app/(app)/insights/ai-reports/scheduled/page.tsx`.
- **Persisted store `scheduled-reports.store.ts`** (mirror `dashboard.store.ts`): `ScheduledReport = { id, reportId, cadence, recipients[], format, enabled, createdAt }`; `add/update/toggle/remove/reset`; key `wp-scheduled-reports`, `version: 1`, `migrate`. Generate `id`/`createdAt` inside `add` (no `Date.now()` in render).
- **Deterministic `computeNextRun(cadence, anchor, now)`**; capture `now` once in `useEffect`, compute labels in `useMemo`.
- **Components:** `scheduled-reports.tsx` (banner: "delivery is simulated in this phase"; table Report · Cadence · Recipients · Format · Next run · Enabled; Run now = actual export) + `schedule-form-dialog.tsx` (Dialog + RHF + Zod, following `project-form-dialog.tsx`; recipients validated as emails).

### Cross-cutting
- Delete the dead duplicate `src/modules/insights/components/reports-tab.tsx` (imported nowhere).
- Reuse `reports:view` / `reports:export`; **no** `permissions.ts` / `navigation.ts` edits (nested routing handles gating).
- Determinism: build rows / timestamps only in `useMemo`/effects/handlers.

### Files
- **New:** `report-builder.ts`, `report-builder.tsx`, `scheduled-reports.store.ts`, `scheduled-reports.tsx`, `schedule-form-dialog.tsx`, `custom-reports.store.ts` (optional), two thin `page.tsx` under `insights/ai-reports/{builder,scheduled}/`.
- **Edit:** `report-export.ts`, `reports-experimental.tsx`, `audit-logs.tsx`, `security-center.tsx`, `package.json` (`xlsx`).
- **Delete:** `reports-tab.tsx`.

### Verification
1. `npm i xlsx` → `npx tsc --noEmit` clean.
2. `npm run dev`, login as owner (`owner@acme.test`):
   - `/insights/ai-reports`: each report menu offers CSV / Excel / PDF; `.xlsx` opens in Excel.
   - `/insights/ai-reports/builder`: workforce → group by Department → metrics → live table/chart → export works.
   - `/insights/ai-reports/scheduled`: add schedule → row with computed next-run → toggle → Run now downloads → persists on reload.
   - `/security` and `/audit-logs`: "Download report" downloads a real file.
3. Login as a non-privileged employee → builder/scheduled routes guarded; export actions disabled.
4. `npm run build` (the real lint+typecheck gate) passes.
