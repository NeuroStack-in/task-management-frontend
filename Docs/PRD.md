# Product Requirements Document

**Product:** Workforce Activity & Productivity Management Platform (Frontend Phase)

> **Canonical authority:** [SPEC.md](SPEC.md) reconciles this document with TDD.md and PAGES.md. Where they conflict, SPEC.md wins. Scope is **PAGES.md V2 (29 sections)**; this PRD has been aligned to it.

## Table of Contents

1. [Overview](#1-overview)
2. [Goals](#2-goals)
3. [Success Metrics](#3-success-metrics)
4. [Technology Stack](#4-technology-stack)
5. [User Roles](#5-user-roles)
6. [Role Based Access Control](#6-role-based-access-control)
7. [Core Modules](#7-core-modules)
8. [Design System](#8-design-system)
9. [Demo Data Requirements](#9-demo-data-requirements)
10. [Future Backend Scope](#10-future-backend-scope)

- [Version](#version)

---

## 1. Overview

### Product Vision

Build a modern SaaS platform that combines:

- Time Tracking
- Task Management
- Employee Activity Monitoring
- Productivity Analytics
- AI Insights
- Workforce Management

The platform enables organizations to monitor work activities, manage tasks, improve productivity, and generate actionable insights through AI-powered analytics.

The initial phase focuses entirely on UI/UX implementation using realistic mock data and simulated workflows without backend integrations.

---

## 2. Goals

### Business Goals

- Demonstrate complete SaaS workflow
- Validate product usability
- Enable stakeholder demos
- Accelerate backend development
- Establish scalable frontend architecture

### User Goals

**Organization Owner**

- Configure organization settings
- Manage subscriptions
- Create custom roles
- Access company-wide analytics

**Manager**

- Monitor team productivity
- Review reports
- Approve manual entries
- Manage projects and tasks

**Employee**

- Track time
- Manage tasks
- View personal productivity
- Access reports

---

## 3. Success Metrics

### UI Metrics

- Fully navigable application
- 100% clickable workflows
- Dark/Light theme support
- Responsive design
- Mobile compatibility

### UX Metrics

- Dashboard accessible within 2 clicks
- Timer accessible globally
- Task switching under 3 interactions
- Report generation under 2 interactions

---

## 4. Technology Stack

### Frontend

- Next.js 15
- TypeScript
- TailwindCSS
- Shadcn/UI

### State Management

- Zustand

### Validation

- Zod
- React Hook Form

### Tables

- TanStack Table

### Charts

- Recharts

### Calendar

- FullCalendar

### Theme

- next-themes

### Drag & Drop

- dnd-kit

### Guided Tour

- react-joyride

### PDF Export

- jsPDF
- html2canvas

### CSV Export

- PapaParse

### Mock Data Generation

- @faker-js/faker (seed scripts → static JSON)

### Tooling

- Package Manager: npm
- Linting: ESLint (Next config)
- Formatting: Prettier

### Testing

- Vitest (unit / component)
- Playwright (E2E of clickable workflows)

---

## 5. User Roles

### System Roles

- **Organization Owner** — Full system access
- **Admin** — Organization administration
- **Manager** — Team management
- **HR** — Employee management
- **Finance** — Billing and invoices
- **Employee** — Personal workspace
- **Custom Roles** — User-defined permissions

---

## 6. Role Based Access Control

### Requirements

Organization creators can:

- Create roles
- Clone roles
- Edit permissions
- Delete roles
- Assign permissions

### Permission Categories

**Dashboard**

- View Dashboard
- Edit Dashboard

**Tasks**

- Create Task
- Edit Task
- Delete Task
- Assign Task

**Projects**

- Create Project
- Manage Project

**Reports**

- View Reports
- Export Reports

**Activity Tracking**

- View Activity
- View Screenshots

**Billing**

- View Billing
- Manage Subscription

**Employees**

- View Employees
- Manage Employees

**Attendance**

- View Attendance
- Manage Attendance

**Payroll**

- View Payroll
- Run Payroll
- Export Payslips

**Leave**

- View Leave Requests
- Submit Leave Request

**Approvals**

- View Approvals
- Approve Requests

**Settings**

- Organization Settings
- Security Settings

### Role-Scoped Experience

Pages are **scoped to the viewer's access**. A self-scoped role (e.g. Employee —
no `employees:view` / `activity:view`) sees only their own data, never org-wide
aggregates:

- **Dashboard** renders a personal view (own productivity, tasks, attendance, projects).
- **Attendance** shows the individual's own calendar, not the organization roll-up.
- **Projects** are limited to projects the user is a member of (list and detail).
- Org-only sections (org Reports, AI Insights, Employees directory) are hidden.

Approver-only and oversight roles (Owner / Admin / Manager / HR) get the full
organization view.

---

## 7. Core Modules

### Module 1: Landing Website

**Features**

- Hero Section
  - Product introduction
  - Call-to-action buttons
  - Demo video
- Features Section
  - Time Tracking
  - Activity Monitoring
  - AI Insights
  - Reports
- Testimonials
- Pricing
- FAQ
- Footer
  - Privacy Policy
  - Terms & Conditions
  - Contact

### Module 2: Authentication

**Features**

- Login
  - Email Login
  - Password Login
- SSO
  - Google
  - Microsoft
- MFA
  - OTP Verification
- Password Recovery
  - Forgot Password
  - Reset Password

### Module 3: Onboarding

**Steps**

1. Organization Setup
2. Invite Team
3. Create Roles
4. Tracking Configuration
5. Dashboard Personalization

### Module 4: Dashboard

**Features**

- KPI Widgets
  - Active Users
  - Inactive Users
  - Productivity Score
  - Running Timers
  - Open Tasks
  - Deadlines
- Analytics Widgets
  - Team Productivity
  - Activity Trends
  - Daily Comparison
  - Weekly Comparison
- AI Summary Widget
- Alerts Widget
- Billing Overview

**Role-aware** — Employees and other self-scoped roles see a **personal**
dashboard (own productivity, open tasks, this-week attendance, their projects)
instead of the company-wide one. Org roles get the full bento dashboard with a
**range filter** (Today / 7d / 30d) and **team filter**.

**Dashboard Customization** — users can:

- Add Widgets
- Remove Widgets
- Rearrange Widgets (free drag-and-drop)
- Save Layouts

### Module 5: Time Tracking

**Features**

- Global Timer — always visible
- Timer Actions
  - Start
  - Pause
  - Stop
  - Resume
- Task Switching — switch active task without stopping timer
- Automatic Task Submission — submit work log after timer completion
- Timeline — activity timeline visualization

### Module 6: Task Management

**Views**

- List View
- Kanban View
- Calendar View
- Timeline View

**Task Features**

- Create Task
- Edit Task
- Assign Task
- Set Deadline
- Add Attachments
- Comments

### Module 7: Project Management

**Features**

- Project Dashboard
- Team Assignment
- Progress Tracking
- Time Tracking
- Resource Allocation

### Module 8: Activity Monitoring

**Metrics**

- Active Time
- Inactive Time
- Productivity Percentage
- Keyboard Activity
- Mouse Activity

**Visualizations**

- Heatmaps
- Activity Charts
- Trend Analysis

### Module 9: Screenshots

**Features**

- Screenshot Gallery
- Timeline View
- Employee View
- Project View
- Screenshot Filtering
- Screenshot Frequency Settings — randomized threshold simulation

### Module 10: Reports

**Report Types**

- Productivity Reports
- Activity Reports
- Time Reports
- Employee Reports
- Project Reports
- AI Reports

**Export Options**

- CSV
- PDF

### Module 11: Employee Management

**Features**

- Employee Directory
- Create / Invite Employee — add a new account (name, email, role, department, team, status) via an in-app form
- Employee Profiles
- Productivity Overview
- Assigned Projects
- Reports
- Activity Records
- Export directory (CSV / PDF)

### Module 12: Approval Center

> The Approval Center is the **approver side** (review / approve / reject). The
> **requester side** for leave lives in Module 31 (Leave Management), so regular
> employees submit and track their own requests separately from approvers.

**Approval Types**

- Manual Time Entry
- Timesheet Approval
- Correction Requests
- Leave Requests

### Module 13: AI Assistant

**Features**

- AI Chatbot
- Productivity Summary
- Daily Summary
- Weekly Summary
- Employee Comparison
- AI Recommendations
- AI Insights

### Module 14: Anomaly Detection

**Features** — simulated frontend detection:

- Long Inactivity
- Unusual Activity Patterns
- Missing Screenshots
- Low Productivity Alerts
- Burnout Indicators

### Module 15: Internal Job Portal

**Features**

- Job Listings
- Applications
- Candidate Tracking
- Referral Management

### Module 16: Notifications

**Notification Types**

- Email Notifications
- Deadline Alerts
- Task Reminders
- Approval Notifications
- Productivity Warnings

### Module 17: Integrations

**Supported Integrations**

- Slack
- Microsoft Teams
- Jira
- Asana
- Trello
- GitHub
- GitLab
- Google Workspace
- Outlook

### Module 18: Billing & Subscription

**Features**

- Plans
- Subscription Management
- Invoice History
- Usage Overview
- Payment Methods
- Billing Reports

### Module 19: Security

**Features**

- MFA
- SSO
- Session Management
- Password Policies
- Access Controls

### Module 20: Settings

**Organization Settings**

- Company Information
- Branding
- Working Hours
- Timezone

**Tracking Settings**

- Idle Threshold
- Screenshot Frequency
- Silent Tracking Mode
- URL Tracking Rules
- Application Tracking Rules

**Notification Settings**

- Email Preferences
- Warning Preferences
- Reminder Settings

### Module 21: Audit Logs

**Features**

- User Actions
- Permission Changes
- Security Events
- Login Activity

### Module 22: Help Center

**Features**

- Documentation
- FAQs
- Tutorials
- Demo Videos
- Support Tickets

### Module 23: Organization Management

**Features**

- Company Information
- Departments
- Teams
- Locations
- Working Hours
- Holidays
- Policies
- Branding
- **Ownership & deletion** (owner-only) — transfer the Organization Owner role
  to another active member, or permanently close the organization. Closure is
  gated: export organization data → acknowledge consequences → type the org name
  to confirm.

### Module 24: Monitoring Configuration

**Features**

- Idle Thresholds
- Screenshot Thresholds
- Productivity Thresholds
- Daily Work Hour Rules
- Alert Thresholds
- Silent Monitoring Settings

### Module 25: Application & URL Management

**Features**

- Application Tracking
- URL Tracking
- Allow Lists
- Block Lists
- Productivity Categories
- Productivity Scoring Rules

### Module 26: Internal Communication

**Features**

- Business Mail Inbox
- Sent / Drafts
- Organization Announcements
- Team Announcements
- Templates

### Module 27: Feature Management

Organization-level module enable/disable control over: Time Tracking, Activity Monitoring, Screenshots, AI, Jobs, Billing, Reports, Integrations, Communication, Approvals.

### Module 28: Remote Support Center

> Replaces the previously-listed "Reverse Shell Access" concept. Approval-gated, simulated remote support only.

**Features**

- Session Requests
- Session Approvals
- Device Diagnostics
- Agent Logs
- Support History

### Module 29: Desktop Agent Management

**Features**

- Agent Status
- Device Status
- Monitoring Status
- Silent Mode
- Agent Configuration
- Agent Policies
- Version Management
- Health Monitoring

### Module 30: Payroll

> Added after the original 29-section scope. Phase-1 frontend only — no real
> payments.

**Features**

- Monthly pay run — per-employee payslips derived from logged working hours × a
  deterministic hourly rate (by department + seniority)
- Summary KPIs (net payout, gross, employees paid, hours logged)
- Pay-period switcher, search, department/status filters, pagination
- Per-payslip PDF download and full-run CSV export

### Module 31: Leave Management

> The self-service **requester** counterpart to the Approval Center (Module 12).

**Features**

- Leave balances by type (Vacation / Sick / Personal / Unpaid)
- Request leave — type, date range, reason; auto-counts working days
- Track own requests with status (Pending / Approved / Rejected)
- Withdraw a still-pending request
- Available to all roles; requests start **Pending** awaiting an approver

---

## 8. Design System

### Themes

- Light Theme
- Dark Theme

### Typography

Inter Font Family

### Design Style

Modern SaaS

### Components

- Cards
- Tables
- Charts
- Modals
- Forms
- Drawers
- Dialogs
- Tooltips
- Command Palette

---

## 9. Demo Data Requirements

### Mock Entities

| Entity | Volume |
|--------|--------|
| Users | 100+ |
| Tasks | 500+ |
| Projects | 50+ |
| Activity Logs | 10,000+ |
| Screenshots | 1,000+ |
| Reports | 100+ |

> All mock entities are produced via @faker-js/faker seed scripts into static JSON under `src/data/`, not hand-authored.

---

## 10. Future Backend Scope

Not included in Phase 1:

- Actual Activity Monitoring
- Screenshot Capture Engine
- Remote Support Engine (approval-gated; replaces "Reverse Shell Access")
- URL Blocking Engine
- Application Blocking Engine
- Real Anomaly Detection
- Real Email Delivery
- Real MFA
- Real SSO
- Payment Gateway Processing
- AI Model Integration
- AWS Infrastructure

Frontend will simulate all workflows using mock services and static datasets.

---

## Version

- **Version:** 1.2
- **Status:** Frontend Phase Approved — aligned to SPEC.md (PAGES.md V2, 29 sections + Payroll & Leave Management additions)
- **1.2 changes:** added Payroll (Module 30) and Leave Management (Module 31); role-scoped (self-service) experience for Employees; role-aware dashboard with range/team filters; create/invite employee; organization ownership transfer & deletion.
