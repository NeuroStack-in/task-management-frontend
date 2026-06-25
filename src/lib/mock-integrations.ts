/**
 * Static dummy data for the Integrations Marketplace.
 * Deterministic — no Math.random() / Date.now(). Phase 1 is frontend-only.
 */

export type IntegrationCategory =
  | "Communication"
  | "Developer"
  | "Productivity"
  | "HR & Finance"
  | "Automation"
  | "CRM"

export const INTEGRATION_CATEGORIES: IntegrationCategory[] = [
  "Communication",
  "Developer",
  "Productivity",
  "HR & Finance",
  "Automation",
  "CRM",
]

export interface Integration {
  id: string
  name: string
  category: IntegrationCategory
  domain: string
  description: string
  features: string[]
  connected: boolean
  account?: string
  lastSync?: string
  popular?: boolean
}

export const INTEGRATIONS: Integration[] = [
  {
    id: "slack",
    name: "Slack",
    category: "Communication",
    domain: "slack.com",
    description:
      "Send productivity summaries, approval requests, and alerts straight to your Slack channels.",
    features: [
      "Post daily productivity summaries to channels",
      "Receive approval and anomaly alerts in Slack",
      "Start and stop the timer with /workpulse",
    ],
    connected: true,
    account: "acme-corp.slack.com",
    lastSync: "2026-06-25 08:40",
    popular: true,
  },
  {
    id: "github",
    name: "GitHub",
    category: "Developer",
    domain: "github.com",
    description:
      "Link commits and pull requests to time entries and track engineering activity automatically.",
    features: [
      "Attach commits and PRs to time entries",
      "Track coding activity per repository",
      "Map repositories to WorkPulse projects",
    ],
    connected: true,
    account: "acme-corp (organization)",
    lastSync: "2026-06-25 09:05",
    popular: true,
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    category: "Productivity",
    domain: "calendar.google.com",
    description:
      "Turn meetings into time entries and keep focus blocks in sync with your schedule.",
    features: [
      "Convert meetings into time entries",
      "Auto-block focus time",
      "Show your schedule on the dashboard",
    ],
    connected: true,
    account: "alex@acme.test",
    lastSync: "2026-06-25 07:15",
  },
  {
    id: "teams",
    name: "Microsoft Teams",
    category: "Communication",
    domain: "microsoft.com",
    description:
      "Deliver WorkPulse alerts and approvals to Teams channels and chats.",
    features: [
      "Receive alerts in Teams channels",
      "Approve time-off requests from Teams",
      "Daily standup summaries",
    ],
    connected: false,
  },
  {
    id: "jira",
    name: "Jira",
    category: "Productivity",
    domain: "atlassian.com",
    description:
      "Sync Jira issues to WorkPulse tasks and log time directly against tickets.",
    features: [
      "Sync issues to WorkPulse tasks",
      "Log time against Jira tickets",
      "Two-way status updates",
    ],
    connected: false,
    popular: true,
  },
  {
    id: "linear",
    name: "Linear",
    category: "Productivity",
    domain: "linear.app",
    description:
      "Keep Linear issues and cycles in sync and attach tracked time to your work.",
    features: [
      "Sync issues and cycles",
      "Attach time to Linear issues",
      "Auto-update issue status",
    ],
    connected: false,
  },
  {
    id: "gitlab",
    name: "GitLab",
    category: "Developer",
    domain: "gitlab.com",
    description:
      "Connect merge requests and pipelines to projects and time entries.",
    features: [
      "Link merge requests to tasks",
      "Track pipeline activity",
      "Map repositories to projects",
    ],
    connected: false,
  },
  {
    id: "asana",
    name: "Asana",
    category: "Productivity",
    domain: "asana.com",
    description: "Import Asana tasks and projects and log time without leaving WorkPulse.",
    features: [
      "Import tasks and projects",
      "Log time on Asana tasks",
      "Sync completion status",
    ],
    connected: false,
  },
  {
    id: "zoom",
    name: "Zoom",
    category: "Communication",
    domain: "zoom.us",
    description:
      "Automatically log meeting durations and turn calls into time entries.",
    features: [
      "Log meeting durations",
      "Auto-create time entries from calls",
      "Attendance from meetings",
    ],
    connected: false,
  },
  {
    id: "zapier",
    name: "Zapier",
    category: "Automation",
    domain: "zapier.com",
    description:
      "Connect WorkPulse to 6,000+ apps and automate workflows with no code.",
    features: [
      "Connect to 6,000+ apps",
      "Trigger workflows on WorkPulse events",
      "Build no-code automations",
    ],
    connected: false,
    popular: true,
  },
  {
    id: "bamboohr",
    name: "BambooHR",
    category: "HR & Finance",
    domain: "bamboohr.com",
    description:
      "Keep your employee directory and time-off balances in sync with BambooHR.",
    features: [
      "Sync the employee directory",
      "Import time-off balances",
      "Two-way PTO sync",
    ],
    connected: false,
  },
  {
    id: "quickbooks",
    name: "QuickBooks",
    category: "HR & Finance",
    domain: "quickbooks.intuit.com",
    description:
      "Export billable hours and generate invoices from approved timesheets.",
    features: [
      "Export billable hours",
      "Generate invoices from timesheets",
      "Sync payroll data",
    ],
    connected: false,
  },
  {
    id: "trello",
    name: "Trello",
    category: "Productivity",
    domain: "trello.com",
    description: "Sync Trello boards and track time per card as work moves across lists.",
    features: [
      "Sync boards and cards",
      "Track time per card",
      "Move cards on status change",
    ],
    connected: false,
  },
  {
    id: "salesforce",
    name: "Salesforce",
    category: "CRM",
    domain: "salesforce.com",
    description:
      "Log time against opportunities and surface activity reports inside Salesforce.",
    features: [
      "Log time against opportunities",
      "Sync accounts and contacts",
      "Activity reports in Salesforce",
    ],
    connected: false,
  },
]
