# Technical Design Document

**Project:** Workforce Activity & Productivity Management Platform
**Version:** 1.2

> **Canonical authority:** [SPEC.md](SPEC.md) reconciles this document with PRD.md and PAGES.md. Where they conflict, SPEC.md wins. Scope is **PAGES.md V2 (29 sections)**; the timeline is **MVP-first phasing** (see [§25](#25-development-sequence)), not a literal 5-day target.

> **Status as of 2026-07-27:** the "Backend services intentionally excluded / mock APIs" scope below is historical. The app is now wired to a real backend (Cognito auth + 21 module services over 110+ live `/v1/*` routes). This TDD stays authoritative for **frontend architecture**; see [CLAUDE.md](../CLAUDE.md) and [BACKEND-ALIGNMENT.md](BACKEND-ALIGNMENT.md) for current wiring.

## Scope

This document defines the technical architecture for the Frontend Phase of the application.

Backend services are intentionally excluded in this phase.

All features will operate using:

- Mock APIs
- Static JSON datasets
- Simulated workflows
- Local state management

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [Application Architecture](#2-application-architecture)
3. [App Router Structure](#3-app-router-structure)
4. [Module Architecture](#4-module-architecture)
5. [Layout Architecture](#5-layout-architecture)
6. [Design System Structure](#6-design-system-structure)
7. [Dashboard Widget System](#7-dashboard-widget-system)
8. [RBAC Architecture](#8-rbac-architecture)
9. [Authentication Flow](#9-authentication-flow)
10. [State Management](#10-state-management)
11. [Global Timer Architecture](#11-global-timer-architecture)
12. [AI Assistant Architecture](#12-ai-assistant-architecture)
13. [Activity Monitoring Architecture](#13-activity-monitoring-architecture)
14. [Screenshot Module](#14-screenshot-module)
15. [Reports Architecture](#15-reports-architecture)
16. [Billing Module](#16-billing-module)
17. [Notification Architecture](#17-notification-architecture)
18. [Integrations Module](#18-integrations-module)
19. [Mock Data Strategy](#19-mock-data-strategy)
20. [API Mock Layer](#20-api-mock-layer)
21. [UX Standards](#21-ux-standards)
22. [Theme Architecture](#22-theme-architecture)
23. [Performance Targets](#23-performance-targets)
24. [Future Backend Integration Points](#24-future-backend-integration-points)
25. [Development Sequence](#25-development-sequence)

- [Architecture Status](#architecture-status)

---

## 1. Technology Stack

### Core

```yaml
Framework: Next.js 15
Language: TypeScript
Styling: TailwindCSS
UI Library: Shadcn/UI
Icons: Lucide React
```

### Tooling & Testing

```yaml
Package Manager: npm
Linting: ESLint (Next config)
Formatting: Prettier
Unit/Component Tests: Vitest
E2E Tests: Playwright
Mock Data Generation: @faker-js/faker
```

### State Management

```yaml
Zustand
```

Purpose:

- User State
- Organization State
- Theme State
- Dashboard State
- Permission State
- Notification State

### Form Management

```yaml
React Hook Form
Zod
```

### Data Table

```yaml
TanStack Table
```

Used for:

- Users
- Tasks
- Projects
- Reports
- Billing
- Audit Logs

### Charts

```yaml
Recharts
```

Used for:

- Productivity Trends
- Active vs Inactive
- Comparison Reports
- Dashboard Widgets

### Drag and Drop

```yaml
dnd-kit
```

Used for:

- Dashboard Widgets
- Task Boards
- Custom Layouts

### Theme

```yaml
next-themes
```

Supports:

- Light Theme
- Dark Theme

### PDF Export

```yaml
jsPDF
html2canvas
```

### CSV Export

```yaml
PapaParse
```

### Guided Tour

```yaml
react-joyride
```

---

## 2. Application Architecture

```text
src/
│
├── app/
├── components/
├── modules/
├── hooks/
├── stores/
├── services/
├── data/
├── providers/
├── types/
├── constants/
├── lib/
├── utils/
└── config/
```

---

## 3. App Router Structure

```text
app
│
├── (marketing)
│   ├── page.tsx
│
├── (auth)
│   ├── login
│   ├── forgot-password
│   ├── reset-password
│   ├── mfa
│
├── onboarding
│
├── dashboard
│
├── time-tracking
│
├── tasks
│
├── projects
│
├── activity
│
├── screenshots
│
├── reports
│
├── employees
│
├── attendance
│
├── payroll
│
├── leave-requests   (self-service Leave Management)
│
├── approvals
│
├── ai
│
├── anomalies
│
├── jobs
│
├── integrations
│
├── billing
│
├── notifications
│
├── inbox            (Internal Communication)
│
├── security
│
├── remote-support
│
├── agents           (Desktop Agent Management)
│
├── roles
│
├── audit-logs
│
├── settings           (hub — admin sections relocated here, permission-gated)
│   ├── profile
│   ├── notifications
│   ├── appearance
│   ├── organization
│   ├── features
│   ├── ownership       (transfer ownership / delete organization)
│   ├── monitoring
│   ├── tracking-rules  (Application & URL Management)
│   ├── roles
│   ├── security
│   ├── audit-logs
│   ├── integrations
│   ├── remote-support
│   └── agents          (Desktop Agent Management)
│
└── help
```

---

## 4. Module Architecture

```text
modules/
│
├── dashboard/
├── time-tracking/
├── tasks/
├── projects/
├── activity/
├── screenshots/
├── reports/
├── employees/
├── attendance/
├── payroll/
├── leave/            (self-service Leave Management)
├── approvals/
├── ai/
├── anomalies/
├── jobs/
├── billing/
├── settings/          (org · monitoring · tracking-rules · features)
├── integrations/
├── communication/
├── security/
├── remote-support/
├── agents/
├── help/
├── marketing/
├── roles/
├── audit-logs/
└── notifications/
```

Each module contains:

```text
module-name/
│
├── components/
├── hooks/
├── services/
├── types/
├── constants/
├── mock-data/
└── index.ts
```

---

## 5. Layout Architecture

### Root Layout

Contains:

```text
Theme Provider
Toast Provider
Query Provider
```

### Dashboard Layout

Contains:

```text
Sidebar
Top Navbar
Command Palette
Global Timer
AI Assistant
Notifications
```

---

## 6. Design System Structure

```text
components/ui
```

Generated from:

```text
shadcn/ui
```

### Shared Components

```text
components/shared
│
├── PageHeader
├── StatCard
├── MetricCard
├── EmptyState
├── DataTable
├── SearchInput
├── ThemeSwitcher
├── UserAvatar
├── ExportMenu
├── WidgetContainer
└── Loader
```

---

## 7. Dashboard Widget System

### Widget Types

```text
Productivity
Activity
Tasks
Projects
Deadlines
AI Summary
Billing
Reports
Employees
```

### Widget Structure

```typescript
interface DashboardWidget {
  id: string;
  title: string;
  type: string;
  position: number;
  visible: boolean;
}
```

### Features

- Add Widget
- Remove Widget
- Drag Widget (free reordering via dnd-kit + DragOverlay)
- Save Layout (persisted, `wp-dashboard`)

### Role-Aware Rendering

`DashboardView` branches on `useIsSelfScoped()`:

- **Self-scoped (Employee):** a fixed `PersonalDashboard` (own productivity, open
  tasks, this-week attendance, member projects) — no widget store, no org data.
- **Org roles:** the customizable bento grid plus range (Today / 7d / 30d) and
  team filters that recompute KPIs and widget data.

---

## 8. RBAC Architecture

### Permission Model

```typescript
interface Permission {
  id: string;
  module: string;
  action: string;
}
```

### Role Model

```typescript
interface Role {
  id: string;
  name: string;
  permissions: Permission[];
}
```

### Route Protection

```typescript
canAccess(
  role,
  permission
)
```

### Navigation Filtering

Sidebar automatically generated based on:

```typescript
role.permissions
```

### Permission Ids & Actions

Ids are `"<module>:<action>"` (or `"*"` wildcard). Actions include
`view · create · edit · delete · assign · manage · export · approve · request`
(`request` added for `leave:request`). New permission modules: `payroll`
(`view` / `manage` / `export`) and `leave` (`view` / `request`).

### Self-Scoped Roles

`useIsSelfScoped()` returns `true` when a role lacks both `employees:view` and
`activity:view` (e.g. Employee). Pages use it to render personal vs. org views
(Dashboard, Attendance, Projects), so a self-scoped user never sees org-wide
data — UI-level scoping that maps to server-side authorization later.

---

## 9. Authentication Flow

Frontend Simulation:

```text
Login
↓
MFA
↓
Role Fetch
↓
Dashboard
```

Mock JWT stored in:

```text
localStorage
```

---

## 10. State Management

### Auth Store

```typescript
user
role
permissions
isAuthenticated
```

### Dashboard Store

```typescript
widgets
layout
filters
```

### Theme Store

```typescript
theme
```

### Notification Store

```typescript
notifications
```

### Timer Store

```typescript
activeTask
elapsedTime
status
```

### Additional Stores

Runtime-created data uses persisted Zustand stores keyed `wp-*`, merged on top of
the seeded JSON in the views:

```text
roles            wp-roles            custom roles (system roles merged in)
employees        wp-employees        accounts created via "Add employee"
leave-requests   wp-leave-requests   self-service leave requests + balances
projects         wp-projects         session projects (seed + created)
tasks            (session)           working copy of tasks (create/edit/move)
assistant                            AI assistant panel open state + prompt
features         wp-features         org-level module enable/disable
ui               wp-ui               sidebar collapse + ⌘K command-palette state
```

---

## 11. Global Timer Architecture

### Persistent Timer

Visible throughout application.

### Features

```text
Start
Pause
Resume
Stop
Switch Task
Auto Submit
```

### State Model

```typescript
interface Timer {
  taskId: string;
  startedAt: string;
  duration: number;
  status: string;
}
```

---

## 12. AI Assistant Architecture

### Components

```text
Chat Panel
Conversation List
Suggestions
Quick Actions
```

### Suggested Commands

```text
Generate Report
Compare Employees
Show Productivity
Summarize Week
```

### Mock AI Service

```typescript
generateSummary()
compareEmployees()
analyzeProductivity()
```

---

## 13. Activity Monitoring Architecture

### Activity Model

```typescript
interface Activity {
  userId: string;
  activePercentage: number;
  inactivePercentage: number;
  keyboardActivity: number;
  mouseActivity: number;
}
```

### Dashboard Visualizations

```text
Heatmap
Bar Chart
Line Chart
Trend Analysis
```

---

## 14. Screenshot Module

### Screenshot Model

```typescript
interface Screenshot {
  id: string;
  userId: string;
  timestamp: string;
  productivityScore: number;
}
```

### Views

```text
Gallery
Timeline
Employee
Project
```

---

## 15. Reports Architecture

### Report Types

```text
Productivity
Time Tracking
Activity
Project
Employee
AI Summary
```

### Export Service

```typescript
exportPDF()
exportCSV()
```

---

## 16. Billing Module

### Models

```typescript
Invoice
Subscription
Plan
Usage
```

### Views

```text
Invoices
Plans
Payments
Usage
```

---

## 17. Notification Architecture

### Notification Types

```text
Task Deadline
Approval
Productivity Alert
Billing Alert
System Alert
```

### Channels

```text
In-App
Email (Mock)
```

---

## 18. Integrations Module

### Integration Model

```typescript
interface Integration {
  id: string;
  name: string;
  status: string;
}
```

### Supported Integrations

```text
Slack
Microsoft Teams
GitHub
GitLab
Jira
Asana
Trello
Google Workspace
Outlook
```

---

## 19. Mock Data Strategy

All datasets are generated via @faker-js/faker seed scripts (not hand-authored), then written as static JSON:

```text
data/
│
├── users.json
├── tasks.json
├── projects.json
├── activity.json
├── screenshots.json
├── reports.json
├── invoices.json
├── roles.json
├── permissions.json
├── notifications.json
├── departments.json
├── teams.json
├── integrations.json
├── jobs.json
├── auditLogs.json
└── agents.json
```

---

## 20. API Mock Layer

### Service Pattern

```typescript
services/
│
├── auth.service.ts
├── task.service.ts
├── project.service.ts
├── report.service.ts
├── activity.service.ts
└── billing.service.ts
```

### Example

```typescript
export const getTasks = async () => {
  return mockTasks;
};
```

---

## 21. UX Standards

### Navigation

Maximum:

```text
3 Click Rule
```

### Responsive Breakpoints

```text
Mobile
Tablet
Desktop
Ultra Wide
```

### Accessibility

```text
Keyboard Navigation
Screen Reader Labels
Focus States
ARIA Attributes
```

---

## 22. Theme Architecture

### Light Theme

```text
Professional SaaS
```

### Dark Theme

```text
Developer-Friendly
```

### CSS Variables

```css
--background
--foreground
--primary
--secondary
--border
--card
```

---

## 23. Performance Targets

### Page Load

```text
< 2 Seconds
```

### Lighthouse

```text
Performance > 90
Accessibility > 90
SEO > 90
Best Practices > 90
```

---

## 24. Future Backend Integration Points

### AWS Services

```text
API Gateway
Lambda
DynamoDB
S3
Cognito
SES
SNS
EventBridge
CloudWatch
```

### Future Desktop Agent

```text
Activity Monitoring
Screenshot Engine
Silent Tracking
Application Blocking
URL Blocking
```

Frontend interfaces should be designed now so backend integration requires minimal UI changes.

---

## 25. Development Sequence

> Phasing is **MVP-first**, not a literal 5-day schedule. Phases 1–2 constitute the demoable MVP (auth, RBAC, dashboard, tasks, time tracking). See [SPEC.md §6](SPEC.md).

### Phase 1 — Core Foundation

```text
Layout
Theme
Authentication
RBAC
Sidebar
Navigation
```

### Phase 2 — Productivity Modules

```text
Dashboard
Tasks
Projects
Time Tracking
```

### Phase 3 — Monitoring Modules

```text
Activity
Screenshots
Reports
Employees
```

### Phase 4 — Business Modules

```text
Billing
Jobs
Approvals
Notifications
Integrations
Internal Communication
Settings (Organization / Monitoring / Tracking Rules / Features)
Security
Audit Logs
```

### Phase 5 — Finalization

```text
AI Center
Anomaly Detection
Remote Support Center
Desktop Agent Management
Help Center
Guided Tour
Landing Page
Accessibility
Testing
Polish
```

---

## Architecture Status

Approved for Frontend Development.

- **Version:** 1.2
- **Phase:** UI/UX Development
- **Phasing:** MVP-first (5 phases; see SPEC.md §6) — duration driven by scope, not a fixed 5 days
- **1.2 changes:** added Payroll and self-service Leave modules + routes; Settings
  hub reorganization (admin sections under `/settings/*`, incl. ownership);
  role-aware dashboard (`useIsSelfScoped` personal vs org); new permission modules
  (`payroll`, `leave`) and the `request` action; documented the additional `wp-*`
  Zustand stores.
