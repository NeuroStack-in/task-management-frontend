/**
 * Static mock data for the Help Center page.
 * All content is deterministic — no Math.random() / Date.now().
 */

import type { LucideIcon } from "lucide-react"
import {
  Activity,
  BookOpen,
  CreditCard,
  FileBarChart,
  HelpCircle,
  Plug,
  ShieldCheck,
  Timer,
} from "lucide-react"
import type { PermissionId } from "@/types/rbac"

export type HelpCategory =
  | "getting-started"
  | "time-tracking"
  | "monitoring"
  | "reports"
  | "billing"
  | "security"
  | "integrations"
  | "general"

export interface HelpCategoryDef {
  key: HelpCategory
  label: string
  icon: LucideIcon
  count: number
}

export const HELP_CATEGORIES: HelpCategoryDef[] = [
  { key: "getting-started", label: "Getting Started", icon: BookOpen, count: 6 },
  { key: "time-tracking", label: "Time Tracking", icon: Timer, count: 5 },
  { key: "monitoring", label: "Monitoring", icon: Activity, count: 4 },
  { key: "reports", label: "Reports", icon: FileBarChart, count: 5 },
  { key: "billing", label: "Billing", icon: CreditCard, count: 3 },
  { key: "security", label: "Security", icon: ShieldCheck, count: 4 },
  { key: "integrations", label: "Integrations", icon: Plug, count: 3 },
  { key: "general", label: "General", icon: HelpCircle, count: 4 },
]

export interface HelpArticle {
  slug: string
  title: string
  category: HelpCategory
  excerpt: string
  readMins: number
  body: string
}

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "quick-start",
    title: "Getting started with WorkPulse",
    category: "getting-started",
    excerpt:
      "Set up your organization, invite your team, and start tracking in under 10 minutes.",
    readMins: 4,
    body: "WorkPulse is designed to be set up quickly. Begin by completing your organization profile in Settings → Organization, then invite your team members from the Employees page. Once your team is added, assign roles that match their responsibilities. The dashboard will populate automatically as team members start logging time and the desktop agent begins collecting activity data. We recommend starting with a small pilot group to fine-tune your monitoring thresholds before rolling out to the full team.",
  },
  {
    slug: "invite-employees",
    title: "How to invite and onboard employees",
    category: "getting-started",
    excerpt:
      "Send invitations, assign roles, and guide new members through the onboarding flow.",
    readMins: 3,
    body: "Navigate to Employees → Invite and enter the email addresses of your team members. Each person will receive an invitation email with a link to create their account. During onboarding, they'll be guided through connecting the desktop agent and setting their preferences. You can track invitation status (Pending, Active, Declined) from the Employees list. For bulk invites, use the CSV import feature in the Employees section.",
  },
  {
    slug: "roles-and-permissions",
    title: "Understanding roles and permissions",
    category: "getting-started",
    excerpt:
      "Learn how the Owner, Admin, Manager, HR, Finance, and Employee roles differ.",
    readMins: 5,
    body: "WorkPulse uses a role-based access control (RBAC) system with six built-in roles: Owner, Admin, Manager, HR, Finance, and Employee. Each role has a predefined set of permissions controlling what they can see and do. Owners have full access and can manage billing. Admins control organization settings. Managers can view reports and approve time-off. HR can access employee profiles. Finance can view billing. You can create custom roles in Settings → Roles & Permissions to fit your exact needs.",
  },
  {
    slug: "dashboard-overview",
    title: "Dashboard overview and widgets",
    category: "getting-started",
    excerpt:
      "Customize your dashboard with productivity metrics, team activity, and AI insights.",
    readMins: 3,
    body: "The dashboard is your real-time command center. You can add, remove, and reorder widgets by clicking Customize in the top right. Available widgets include: Team Activity Heatmap, Active vs Inactive breakdown, Top Performers leaderboard, AI Summary, upcoming task deadlines, and billing status. Your widget layout is saved automatically and persists across sessions. Each role sees only the widgets relevant to their permissions.",
  },
  {
    slug: "install-desktop-agent",
    title: "Installing the desktop agent",
    category: "getting-started",
    excerpt:
      "The desktop agent enables real-time monitoring, screenshots, and activity tracking.",
    readMins: 6,
    body: "The WorkPulse desktop agent is a lightweight background process that captures activity data, takes periodic screenshots, and reports time to the platform. Download the installer from Settings → Desktop Agents → Download. The agent supports Windows 10+, macOS 12+, and Ubuntu 20.04+. After installation, the agent appears in the system tray and connects automatically using your organization token. Employees are notified when monitoring is active. Admins can manage agent versions and policies from the Agents page.",
  },
  {
    slug: "notifications-guide",
    title: "Managing notifications and alerts",
    category: "getting-started",
    excerpt: "Configure which events trigger in-app and email notifications.",
    readMins: 2,
    body: "WorkPulse sends notifications for key events: task assignments, approval decisions, productivity anomalies, and system alerts. You can configure your notification preferences in Settings → Notifications. Each notification type can be set to in-app only, email only, or both. Managers and Admins can also configure org-wide alert thresholds in Settings → Monitoring to control when anomaly notifications are triggered.",
  },
  {
    slug: "log-time",
    title: "How to log time manually",
    category: "time-tracking",
    excerpt: "Add, edit, and submit time entries directly from the Time Tracking page.",
    readMins: 3,
    body: "To log time manually, go to Time Tracking and click Add Entry. Select the project and task, enter the duration or start/end times, and optionally add a note. Entries can be edited until they are submitted for approval. Submitted entries are locked and require manager approval to change. You can also use the global timer in the top navigation bar — press Start, work on your task, then press Stop to create an entry automatically.",
  },
  {
    slug: "timesheets",
    title: "Submitting and approving timesheets",
    category: "time-tracking",
    excerpt: "Learn the weekly timesheet workflow from submission to approval.",
    readMins: 4,
    body: "At the end of each week, employees submit their timesheet for manager review. Go to Time Tracking → Timesheets and click Submit Week. Your manager will receive a notification and can approve or reject the submission with a comment. Approved timesheets are locked and feed into billing and payroll reports. Rejected timesheets are returned with feedback for correction. Admins can configure the submission deadline in Settings → Monitoring.",
  },
  {
    slug: "global-timer",
    title: "Using the global timer",
    category: "time-tracking",
    excerpt: "Start, pause, and stop the global timer from anywhere in the app.",
    readMins: 2,
    body: "The global timer lives in the top navigation bar and is always accessible no matter where you are in WorkPulse. Click the timer icon to assign it to a project and task, then press Start. The timer continues running even as you navigate between pages. Press Pause to take a break — idle time will be separated automatically if idle detection is enabled. When you Stop the timer, a time entry is created and added to your current day. Timer state persists across browser refreshes.",
  },
  {
    slug: "idle-detection",
    title: "How idle detection works",
    category: "monitoring",
    excerpt:
      "WorkPulse detects mouse and keyboard inactivity to separate active from idle time.",
    readMins: 3,
    body: "Idle detection monitors keyboard and mouse activity at the OS level via the desktop agent. If no input is detected for the configured threshold (default: 5 minutes), the timer is automatically paused and the period is marked as idle. Idle time is displayed separately in reports and does not count toward productive hours. You can configure the idle threshold in Settings → Monitoring. If Count Idle as Break is enabled, idle periods are logged as break time rather than untracked.",
  },
  {
    slug: "screenshot-settings",
    title: "Screenshot capture and privacy settings",
    category: "monitoring",
    excerpt:
      "Configure capture frequency, blur rules, and employee notification settings.",
    readMins: 4,
    body: "Screenshots are captured periodically by the desktop agent at the interval set in Settings → Monitoring → Screenshots. By default, employees are notified via the system tray icon whenever a screenshot is taken. You can enable Blur by Default to automatically blur screenshots before they are uploaded. Screenshots are stored for the configured retention period (default: 30 days) and then deleted automatically. Employees can view their own screenshots in Analytics → Screenshots.",
  },
  {
    slug: "productivity-scores",
    title: "Understanding productivity scores",
    category: "monitoring",
    excerpt:
      "How WorkPulse calculates productivity from app usage, active time, and task completion.",
    readMins: 5,
    body: "Productivity scores are calculated from three signals: active vs idle time ratio, application category usage (productive/neutral/distracting), and task completion rate. Each signal is weighted and combined into a 0–100 score. Admins can adjust the productive and low-activity thresholds in Settings → Monitoring → Productivity Thresholds. Application categories can be customized in Settings → Application & URL Rules to match your team's workflow.",
  },
  {
    slug: "export-reports",
    title: "Exporting reports to CSV and PDF",
    category: "reports",
    excerpt: "Download productivity, time, and project data in CSV or PDF format.",
    readMins: 2,
    body: "Reports can be exported from Analytics → Reports. Select the report you want and click Export CSV or Export PDF. CSV exports are formatted for import into Excel or Google Sheets. PDF exports include charts and are suitable for sharing with stakeholders. Export access requires the Export Reports permission — contact your Admin if the buttons are grayed out.",
  },
  {
    slug: "scheduled-reports",
    title: "Scheduling automated report delivery",
    category: "reports",
    excerpt:
      "Set up recurring reports delivered to your inbox on a weekly or monthly schedule.",
    readMins: 3,
    body: "Scheduled reports let you automatically receive key metrics without logging in. Go to Analytics → Reports and click the clock icon on any report card to open the schedule dialog. Choose the frequency (daily, weekly, monthly), the recipients, and the delivery format (CSV or PDF). Scheduled reports run at midnight UTC on the configured cadence. You can manage or delete schedules from the same dialog.",
  },
  {
    slug: "change-plan",
    title: "Upgrading or downgrading your subscription",
    category: "billing",
    excerpt:
      "Change your plan, add seats, or cancel directly from the Billing page.",
    readMins: 3,
    body: "Go to Billing → Subscription to view your current plan and available options. To upgrade, click Upgrade Plan and select a new tier. Upgrades take effect immediately and are prorated for the remaining billing cycle. Downgrades take effect at the start of the next billing cycle. To add seats, click Add Seats and enter the number of additional users. Billing is per active seat — suspended or uninvited users do not count.",
  },
  {
    slug: "mfa-setup",
    title: "Setting up multi-factor authentication",
    category: "security",
    excerpt:
      "Add TOTP-based MFA to your account or enforce it across the organization.",
    readMins: 4,
    body: "MFA adds a second layer of security to your WorkPulse account. To enable it for your personal account, go to Settings → Security → Multi-Factor Authentication and scan the QR code with an authenticator app (Google Authenticator, Authy, or 1Password). Admins can enforce MFA for all users in Security → Policies. Recovery codes are shown once during setup — store them securely.",
  },
  {
    slug: "slack-integration",
    title: "Connecting Slack to WorkPulse",
    category: "integrations",
    excerpt:
      "Receive WorkPulse alerts, approval requests, and summaries directly in Slack.",
    readMins: 3,
    body: "The Slack integration delivers WorkPulse notifications to your chosen channels. Go to Integrations → Slack and click Connect. Authorize WorkPulse to access your Slack workspace, then select which channels should receive which notification types (anomaly alerts, approval requests, daily summaries). The integration also enables /workpulse slash commands in Slack for checking your daily summary or starting/stopping the timer.",
  },
]

export interface Faq {
  q: string
  a: string
  /** If set, only roles holding this permission see the FAQ (e.g. admin-only). */
  permission?: PermissionId
}

export const FAQS: Faq[] = [
  {
    q: "How does idle detection work?",
    a: "The desktop agent monitors keyboard and mouse activity at the OS level. If no input is detected for the configured threshold (default: 5 minutes), the current session is marked as idle. Idle time is shown separately in reports and does not count toward productive hours. You can adjust the threshold in Settings → Monitoring.",
  },
  {
    q: "Are employees notified when screenshots are taken?",
    a: "Yes. By default, a system tray icon pulses briefly whenever a screenshot is captured, so employees are always aware. This behavior can be configured in Settings → Monitoring → Screenshots. Admins can also enable Blur by Default so captured images are blurred before upload.",
  },
  {
    q: "Can I use WorkPulse without the desktop agent?",
    a: "Yes. The web app supports manual time logging and task management without the agent. However, automatic time tracking, screenshot capture, and application/URL monitoring require the desktop agent to be installed on the employee's machine.",
  },
  {
    q: "How is the productivity score calculated?",
    a: "Productivity scores combine three signals: the ratio of active to total logged time, the proportion of time spent in productive vs distracting applications, and task completion rate. Each signal is weighted and combined into a 0–100 score. Thresholds can be adjusted in Settings → Monitoring → Productivity Thresholds.",
  },
  {
    q: "What data is collected by the desktop agent?",
    a: "The agent collects: active application names and window titles, keyboard and mouse activity levels (counts only — no keylogging), periodic screenshots (configurable frequency), and time spent in each application. No keystrokes or clipboard content are recorded. Employees can view their collected data in Analytics → Activity and Screenshots.",
  },
  {
    q: "How do I add or remove seats from my plan?",
    a: "Go to Billing → Subscription and click Add Seats or Remove Seats. Changes take effect immediately. Upgrades are prorated for the current billing cycle; downgrades take effect at the start of the next cycle. Suspended users and pending invitations do not count toward your seat limit.",
    permission: "billing:view",
  },
  {
    q: "Can I export data for a custom date range?",
    a: "Yes. In Analytics → Reports, use the date picker to select a custom range before exporting. The selected range applies to all report types on that page. CSV and PDF exports both respect the chosen date range.",
    permission: "reports:view",
  },
  {
    q: "What happens if the desktop agent goes offline?",
    a: "If the agent loses its connection, it stores activity data locally and syncs when the connection is restored. You will see an alert in Settings → Desktop Agents for any agents offline for more than 30 minutes. Manual time entries can still be submitted via the web app during agent downtime.",
  },
  {
    q: "Is WorkPulse GDPR compliant?",
    a: "WorkPulse is designed with GDPR compliance in mind. Employees have visibility into all data collected about them. Admins can configure data retention periods and request data deletion. All data is encrypted in transit and at rest. For a Data Processing Agreement (DPA), contact your account manager.",
  },
]

export interface VideoTutorial {
  title: string
  duration: string
  category: HelpCategory
}

export const VIDEO_TUTORIALS: VideoTutorial[] = [
  { title: "WorkPulse in 5 minutes", duration: "5:02", category: "getting-started" },
  { title: "Setting up your first project", duration: "3:45", category: "getting-started" },
  { title: "Using the global timer", duration: "2:18", category: "time-tracking" },
  { title: "Reading activity reports", duration: "4:30", category: "monitoring" },
  { title: "Configuring monitoring thresholds", duration: "6:12", category: "monitoring" },
  { title: "Exporting and scheduling reports", duration: "3:55", category: "reports" },
]

export interface SupportTicket {
  id: string
  subject: string
  category: HelpCategory
  status: "open" | "pending" | "resolved"
  createdAt: string
}

export const MOCK_TICKETS: SupportTicket[] = [
  {
    id: "TKT-1042",
    subject: "Screenshot blur not applying on macOS Sequoia",
    category: "monitoring",
    status: "open",
    createdAt: "2026-06-22",
  },
  {
    id: "TKT-1039",
    subject: "PDF export empty when filtering by date",
    category: "reports",
    status: "pending",
    createdAt: "2026-06-18",
  },
  {
    id: "TKT-1031",
    subject: "Idle time not syncing after agent v2.1 update",
    category: "monitoring",
    status: "resolved",
    createdAt: "2026-06-10",
  },
]

let ticketCounter = 1042

export function nextTicketId(): string {
  ticketCounter += 1
  return `TKT-${ticketCounter}`
}
