/**
 * Static content for the Help Center — knowledge-base categories, articles, FAQs,
 * and video tutorials. This is legitimate authored content, not fabricated backend
 * data: there is no help/content API, so it lives with the module. Support tickets
 * are the exception — those are real (see ../services/support.service.ts) and are
 * intentionally not modelled here.
 *
 * All content is deterministic — no Math.random() / Date.now().
 */

import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BookOpen,
  CreditCard,
  FileBarChart,
  HelpCircle,
  Plug,
  ShieldCheck,
  Timer,
} from "lucide-react";
import type { PermissionId } from "@/types/rbac";

export type HelpCategory =
  | "getting-started"
  | "time-tracking"
  | "monitoring"
  | "reports"
  | "billing"
  | "security"
  | "integrations"
  | "general";

/** A category's article count is derived from {@link HELP_ARTICLES}, never stored — see help-page. */
export interface HelpCategoryDef {
  key: HelpCategory;
  label: string;
  icon: LucideIcon;
}

export const HELP_CATEGORIES: HelpCategoryDef[] = [
  { key: "getting-started", label: "Getting Started", icon: BookOpen },
  { key: "time-tracking", label: "Time Tracking", icon: Timer },
  { key: "monitoring", label: "Monitoring", icon: Activity },
  { key: "reports", label: "Reports", icon: FileBarChart },
  { key: "billing", label: "Billing", icon: CreditCard },
  { key: "security", label: "Security", icon: ShieldCheck },
  { key: "integrations", label: "Integrations", icon: Plug },
  { key: "general", label: "General", icon: HelpCircle },
];

export interface HelpArticle {
  slug: string;
  title: string;
  category: HelpCategory;
  excerpt: string;
  readMins: number;
  body: string;
}

/**
 * Every claim here is about the shipped product, and was checked against the code that does it (QA
 * audit 2026-10-08, WP-247): several articles used to describe a web timer, manual time entry,
 * scheduled reports, Slack commands, offline alerts and recovery codes that don't exist. When the
 * product changes, change the article — a help page that lies is worse than none.
 */
export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: "quick-start",
    title: "Getting started with WorkPulse",
    category: "getting-started",
    excerpt:
      "Set up your organization, invite your team, and get the desktop app tracking.",
    readMins: 4,
    body: "Start with your organization's details in Settings → Organization, then invite your team from the Employees page — each invite carries a role, a department and a job title. Once people accept, they install the WorkPulse desktop app from Download agent in the top bar and sign in with their WorkPulse email and password. Time, attendance and activity all come from what that app records while its timer runs, and the dashboard fills in as it reports. (Organizations that track company computers with the managed service enrol those computers under Settings → Device agents instead.) A small pilot group is a good way to settle your monitoring settings in Settings → Monitoring before everyone joins.",
  },
  {
    slug: "invite-employees",
    title: "How to invite and onboard employees",
    category: "getting-started",
    excerpt:
      "Send invitations with a role, department and title, and follow up on pending ones.",
    readMins: 3,
    body: "On the Employees page, choose Invite. Enter one address, or paste up to 100 at once — everyone in a paste gets the same role, department, team and job title, and department and job title are required. To give each person their own details, import a CSV of up to 500 rows instead. Each person receives an email with a link and an invite code. Accepting is one short form — their name, the code, a password and a few profile details — after which they're signed in to WorkPulse. Pending invites appear in the Invited section below the employee list, where you can send a new invite or revoke one.",
  },
  {
    slug: "roles-and-permissions",
    title: "Understanding roles and permissions",
    category: "getting-started",
    excerpt: "The built-in Owner, Admin and Employee roles, and how custom roles work.",
    readMins: 5,
    body: "WorkPulse has three built-in roles. The Owner has full access, including billing and ownership; Admins run the organization's settings and people; Employees see their own work. Admin and Employee can be adjusted for your organization, and Restore to default puts them back. For anything else — a Manager, HR or Finance role, say — create a custom role in Settings → Roles & permissions, either from scratch with Create role or by cloning an existing role and adjusting its permissions. You can only grant permissions you hold yourself.",
  },
  {
    slug: "dashboard-overview",
    title: "Dashboard overview and widgets",
    category: "getting-started",
    excerpt: "What the dashboard shows, and how owners and admins arrange its widgets.",
    readMins: 3,
    body: "The dashboard is your starting point. People who can view employees — owners and admins, typically — get the organization dashboard: a grid of widgets you arrange with Customize, adding, removing and dragging them into order. Widgets include the AI summary, Attendance, Working now, Department comparison, Top performers, Needs attention, Employment status, Where time went, Productivity trends, Upcoming deadlines, Activity heatmap, Headcount by status and Billing overview. The layout is saved to your account, so it follows you between devices. Everyone else gets a personal dashboard with their own figures, tasks and week, which isn't customizable.",
  },
  {
    slug: "install-desktop-agent",
    title: "Installing the desktop app",
    category: "getting-started",
    excerpt: "Download the WorkPulse desktop app, sign in, and start your timer.",
    readMins: 4,
    body: "The WorkPulse desktop app is what records your work. Download it from Download agent in the top bar — it's available for Windows 10 and 11, macOS 12 and later, and Ubuntu/Debian (a .deb or an AppImage). Install it and sign in with the same WorkPulse email and password you use here; there's no separate setup. While it runs, a WorkPulse icon sits in the system tray, and it records activity only while your timer is on. Admins see every device, with its version and connectivity, under Settings → Device agents, and set capture and update policies under Settings → Monitoring. Organizations that track company computers with the managed service enrol them under Settings → Device agents instead — there is nothing for employees to install.",
  },
  {
    slug: "notifications-guide",
    title: "Managing notifications",
    category: "getting-started",
    excerpt: "What WorkPulse notifies you about, and how to switch each type on or off.",
    readMins: 2,
    body: "WorkPulse notifies you in the app about things that concern you: tasks assigned to you, leave requests and their decisions (including requests waiting for your approval), security changes such as a reset two-factor device, plan changes you made, and a few system notices. They appear under the bell in the top bar and on the Notifications page. Choose what you receive in Settings → Notification preferences, where Task assignments, Approvals, Billing & account and Security alerts each have an in-app switch.",
  },
  {
    slug: "log-time",
    title: "How your time gets recorded",
    category: "time-tracking",
    excerpt:
      "Your timesheet on the Time Tracking page comes from the desktop app's timer — there's no manual entry.",
    readMins: 2,
    body: "WorkPulse records time from the desktop app, not from forms. Start the app's timer on a project and task, and each session is sent to WorkPulse on its own; the Time Tracking page then shows your sessions and your totals for each day. The web app can't add, edit or delete time entries — by design, so what you see always matches what the desktop app actually recorded. (On company computers tracked by the managed service, time runs from Windows sign-in to sign-out instead.) If a day looks wrong, talk to your manager or admin.",
  },
  {
    slug: "global-timer",
    title: "The timer in the top bar",
    category: "time-tracking",
    excerpt:
      "A live view of your desktop app's running session — it doesn't start or stop anything.",
    readMins: 1,
    body: "The timer in the top navigation bar mirrors the session running in your WorkPulse desktop app: which task it's on and how long it has been running. It's view-only — there's no start, pause or stop on the web, by design. To start or stop tracking, use the desktop app. It appears for people who track their own time.",
  },
  {
    slug: "idle-detection",
    title: "How idle time is handled",
    category: "monitoring",
    excerpt: "How the desktop app treats time without keyboard or mouse input.",
    readMins: 2,
    body: "The desktop app notices whether there's keyboard and mouse input — never what was typed. After a minute without input, time counts as idle rather than active. After 5 minutes it asks whether you're still working, and after 15 minutes it stops the timer, starting it again by itself if you come back within 4 hours. These timings are built into the app. For company computers tracked by the managed service, an admin sets when an inactive session ends under Settings → Monitoring → Machine tracking → Stop after inactivity.",
  },
  {
    slug: "screenshot-settings",
    title: "Screenshot capture and retention",
    category: "monitoring",
    excerpt:
      "How often screenshots are captured, how long they're kept, and who can see them.",
    readMins: 3,
    body: "The desktop app captures screenshots while it's tracking, at the cadence an admin sets in Settings → Monitoring → Screenshot capture → Capture cadence: off, every 3, 5 or 10 minutes, or a custom interval of 1 to 60 minutes. Every 5 minutes is the default. Screenshots are kept for the Retention period on the same card — 7, 30, 90, 180 or 365 days, 90 unless it's changed — and then deleted automatically. They're reviewed in Analytics → Screenshots by people whose role includes it; employees don't see captures in the app.",
  },
  {
    slug: "productivity-scores",
    title: "Understanding productivity scores",
    category: "monitoring",
    excerpt:
      "How the daily 0–100 score is built from utilization, quality, focus and reliability.",
    readMins: 4,
    body: "Each person gets a daily score from 0 to 100, computed from that day's activity — the AI never decides a score. It combines four parts: Utilization (25%), the share of the time on the timer spent active at the computer (against the expected day when no timer ran); Quality (40%), the average AI rating of the day's screenshots, or — when there are none — tracked time weighted by app category, where productive counts fully, neutral counts half and distracting counts zero; Focus (15%), the share of active time with real keyboard or mouse input; and Reliability (20%), punctuality and hours worked. Task completion isn't part of it. Admins can change the four weights in Settings → Organization → Productivity score weights (or for a single department), and decide which apps and sites count as productive in Settings → Tracking rules.",
  },
  {
    slug: "export-reports",
    title: "Exporting reports to CSV and PDF",
    category: "reports",
    excerpt: "Download report data as CSV or PDF from Analytics → AI reports.",
    readMins: 2,
    body: "Reports are downloaded from Analytics → AI reports, in the All reports library. Each report card has Download CSV and Download PDF; tick several and use Download selected, or take everything with Download all. A CSV opens in Excel or Google Sheets, and a PDF is ready to share. The library covers the last workday or the current week — there's no custom date range. Downloading needs the Export Reports permission; without it the buttons are greyed out, so ask your admin.",
  },
  {
    slug: "change-plan",
    title: "Changing your plan",
    category: "billing",
    excerpt: "See your plan and seats, and switch plans from Settings → Billing.",
    readMins: 2,
    body: "Settings → Billing shows your organization's plan and how many seats are in use. People allowed to manage billing can move to another plan with Upgrade or Switch on that plan's card, and the change applies immediately. Nothing is charged — payments aren't enabled in WorkPulse yet, so there are no invoices, proration or billing cycles, and seats can't be added or removed here. To cancel, contact WorkPulse support.",
  },
  {
    slug: "mfa-setup",
    title: "Setting up multi-factor authentication",
    category: "security",
    excerpt: "Add an authenticator-app code (MFA) to your sign-in.",
    readMins: 3,
    body: "Multi-factor authentication adds a code from an authenticator app — Google Authenticator, Authy, 1Password and the like — to your sign-in. Go to Settings → Security and, on the Multi-factor authentication card, choose Enable, scan the QR code with your app and enter the code it shows. There are no recovery codes: if you lose the device, an owner or admin can reset your authenticator from their Security page, and you set it up again at your next sign-in. Multi-factor authentication can't yet be made mandatory for the whole organization.",
  },
  {
    slug: "slack-integration",
    title: "Connecting Slack to WorkPulse",
    category: "integrations",
    excerpt: "Post leave, joiner, payroll and task updates to your Slack channels.",
    readMins: 3,
    body: "The Slack integration posts WorkPulse updates to your channels. Go to Settings → Integrations, find Slack and choose Connect, then approve WorkPulse in your Slack workspace. Once it's connected, open Channel routing to pick a default channel and, if you like, a channel for each event: leave requested, approved or cancelled, an employee joining, payroll finalized, and a task being assigned. Invite the WorkPulse app to every channel you route to, or Slack refuses its messages. WorkPulse only posts messages and reads your channel list — there are no Slack commands.",
  },
];

export interface Faq {
  q: string;
  a: string;
  /** If set, only roles holding this permission see the FAQ (e.g. admin-only). */
  permission?: PermissionId;
}

export const FAQS: Faq[] = [
  {
    q: "How does idle detection work?",
    a: "The desktop app notices whether there's keyboard and mouse input, never what was typed. After a minute without input, time counts as idle rather than active. After 5 minutes it asks whether you're still working, and after 15 minutes it stops the timer — starting again by itself if you come back within 4 hours. These timings are built into the app; for company computers on the managed service, Settings → Monitoring → Machine tracking sets when an inactive session ends.",
  },
  {
    q: "Are employees notified when screenshots are taken?",
    a: "The desktop app keeps a WorkPulse icon in the system tray the whole time it runs, and its panel shows a capture indicator while screenshots are being taken. It doesn't flash a separate notice for each screenshot.",
  },
  {
    q: "Can I use WorkPulse without the desktop app?",
    a: "Partly. The web app handles projects and tasks, leave, approvals, payroll and settings on its own. But time, attendance, activity and screenshots all come from the desktop app — there's no manual time entry on the web.",
  },
  {
    q: "How is the productivity score calculated?",
    a: "The score combines four parts into a 0–100 number: Utilization (25%) — the share of the time on the timer spent active at the computer (against the expected day when no timer ran); Quality (40%) — the average AI rating of the day's screenshots, or when there are none, time weighted by app category, where productive counts fully, neutral counts half and distracting counts zero; Focus (15%) — the share of active time with real keyboard or mouse input, which is what stops idle time being passed off as work; and Reliability (20%) — punctuality and hours worked. Task completion is not part of the score. App categories are set in Settings → Tracking rules.",
  },
  {
    q: "What data does the desktop app collect?",
    a: "While it's tracking, the desktop app records which application is active and its window title, how much keyboard and mouse activity there is each minute (counts only — never which keys), screenshots at your organization's cadence, and the computer's location with its regular check-ins. It doesn't record keystrokes, clipboard contents or web addresses. Employees don't see this data in the app, including their own: it's reviewed in Analytics by people whose role includes it. An employee's Profile shows only their tracked hours, attendance and tasks.",
  },
  {
    q: "Can I add or remove seats?",
    a: "Not in the app yet. Settings → Billing shows your plan and how many seats are in use, and the plan can be changed there. Nothing is charged — payments aren't enabled yet.",
    permission: "billing:view",
  },
  {
    q: "Can I export data for a custom date range?",
    a: "Not yet. The report library in Analytics → AI reports covers the last workday or the current week, and its CSV and PDF downloads use that period.",
    permission: "reports:view",
  },
  {
    q: "What happens if the desktop app goes offline?",
    a: "It keeps what it records on the computer and sends it when the connection comes back, so nothing is lost. Under Settings → Device agents, a device shows as Offline once it hasn't checked in for 10 minutes; there's no separate alert. Time can't be entered by hand on the web in the meantime.",
  },
  {
    q: "Is WorkPulse GDPR compliant?",
    a: "WorkPulse is designed with GDPR in mind. Data is encrypted in transit and at rest; screenshot retention is configurable in Settings → Monitoring, and screenshots are deleted automatically when it runs out; and the Owner can export the organization's data from Settings → Ownership & deletion. Employees don't see the activity and screenshots collected about them in the app, and there's no in-app request for deleting someone's data. For a Data Processing Agreement (DPA), contact WorkPulse support.",
  },
];

export interface VideoTutorial {
  title: string;
  duration: string;
  category: HelpCategory;
  /**
   * Where the video lives. **Absent = not filmed yet**, and the card says so rather than pretending
   * — six tiles that all open nothing is worse than one that plays and five that are honest.
   */
  src?: string;
  /**
   * `file` → a direct MP4/WebM played by `<video>`. `embed` → an iframe (YouTube, Loom, Vimeo).
   *
   * This one field is why the host isn't a lock-in: moving from S3 to Cloudflare Stream or an
   * unlisted YouTube link is an edit here, not a component rewrite.
   */
  kind?: "file" | "embed";
  /** Still frame shown before playback. Without one the tile keeps its gradient. */
  poster?: string;
  /**
   * Required to be shown this video — the same idiom the FAQs use.
   *
   * Getting-started exists as two cuts because the product genuinely differs by role: an employee
   * has no Employees, Payroll, Analytics or Settings, so a walkthrough of those is noise to them.
   * Ungated ⇒ everyone, which is right for the team-facing cut. An owner sees both, and the titles
   * say which is which — knowing what your team is shown is a fair thing for an owner to want.
   */
  permission?: PermissionId;
}

/**
 * Hosted in the **existing public downloads bucket**, alongside the agent installers — not in
 * `public/`. A 125 MB file in the repo would bloat every clone and every Vercel deploy forever,
 * and S3 already serves large public binaries here with a bucket policy that allows exactly
 * `s3:GetObject`.
 */
const VIDEO_HOST = "https://wp-downloads-dev.s3.ap-south-1.amazonaws.com/help/videos";

export const VIDEO_TUTORIALS: VideoTutorial[] = [
  {
    title: "Getting started — for your team",
    duration: "2:20",
    category: "getting-started",
    src: `${VIDEO_HOST}/getting-started-employee.mp4`,
    kind: "file",
  },
  {
    title: "Getting started — for owners and admins",
    duration: "2:17",
    category: "getting-started",
    src: `${VIDEO_HOST}/getting-started-owner.mp4`,
    kind: "file",
    // Held by Owner/Admin/Manager, never by Employee — so this cut appears only for the people
    // whose screens it actually shows.
    permission: "employees:view",
  },
  {
    title: "Setting up your first project",
    duration: "3:45",
    category: "getting-started",
  },
  { title: "How time gets tracked", duration: "2:18", category: "time-tracking" },
  { title: "Reading activity reports", duration: "4:30", category: "monitoring" },
  // Not filmed yet. Titled for what exists: there are no monitoring "thresholds" and no report
  // scheduling to film (WP-247).
  { title: "Configuring monitoring settings", duration: "6:12", category: "monitoring" },
  { title: "Exporting reports", duration: "3:55", category: "reports" },
];
