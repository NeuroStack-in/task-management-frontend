/**
 * Facts that both the Privacy Policy and the DPA state, written once here so the two documents
 * can't disagree.
 *
 * Each entry names where the fact was verified (as of 2026-10-09). If the product changes, re-check
 * the source before editing the text. A legal document that describes the product inaccurately is
 * worse than one that is merely incomplete.
 */
import type { ReactNode } from "react";
import { B, Code, LI, Table, UL } from "./prose";

/* ------------------------------------------------------------------------------------------------
 * Categories of personal data
 * ----------------------------------------------------------------------------------------------*/

const DATA_CATEGORIES: { name: string; detail: ReactNode }[] = [
  {
    // Sign-up / invite / profile forms (signup-experience.tsx, invite-accept-form.tsx); /v1/me/profile.
    name: "Account and profile",
    detail:
      "Name, work email address, phone number, work location, date of birth, work mode (on-site, hybrid or remote) and profile photo. Passwords are managed by Amazon Cognito.",
  },
  {
    name: "Employment",
    detail:
      "Job title, department, team, role and permissions, employee ID and account status.",
  },
  {
    // Managed agent: timer runs from Windows sign-in to sign-out, sleep excluded (MANAGED-AGENT.md).
    name: "Time tracking",
    detail:
      "Timer sessions with their start and end times, the project and task, and any description typed. On company-managed devices set up for automatic tracking, the time between signing in to Windows and signing out, excluding sleep.",
  },
  {
    // wp-agent-contract: `keystrokes` and `mouse` are per-minute COUNTS; lib.rs states no field can
    // carry keystroke content, clipboard or audio. AppSpan carries app + window title. (Its `url`
    // field exists but the agents can't read page addresses yet, per rules-editor.tsx. Revisit this
    // line if URL capture ships.)
    name: "Activity monitoring (if the employer enables it)",
    detail:
      "The names of the applications used and their window titles (a browser's window title usually includes the title of the page), active and idle time, and counts of keyboard and mouse activity per minute. The agents never record what is typed: no keystroke content, clipboard contents or audio.",
  },
  {
    // fleet.service.ts: cadence, capture-now (the device refuses with no timer running). blur_level
    // is still in the wire type (0–3) but has no control, and every monitoring save sends 0 (WP-331),
    // so screenshots are not described as blurred. rules-editor.tsx: privacy exceptions record nothing
    // while focused — matched by application only, since the agents read no URL yet (WP-343).
    name: "Screenshots (if the employer enables them)",
    detail:
      "Images of the screen, taken at the interval the employer sets while tracking is running. Administrators with permission can also request one on demand, which the device declines if tracking isn't running. Screenshots are not blurred. Employers can exclude applications; nothing is recorded while an excluded one is in focus.",
  },
  {
    // ingest fold_batch/location.rs: the agent sends a fix only with consent and an OS position;
    // live-map.tsx: the accuracy radius, and WiFi/IP positioning on desktops without GPS.
    name: "Location (if enabled, and permitted on the device)",
    detail:
      "The device's approximate location as reported by its operating system (from GPS, Wi-Fi or IP address), and how accurate that estimate is, recorded while the timer is running.",
  },
  {
    // wp-agent-contract envelope.rs: Heartbeat {hostname, os, os_version, agent_version, ip, cpu_pct,
    // mem_pct}; OsUser {sid, sam, domain, upn, email}; capture-gap reasons (locked, suspended…).
    name: "Device information",
    detail:
      "Hostname, operating system and version, IP address, CPU and memory usage, and agent version. On company-managed devices, also the Windows account signed in (account name, domain, security identifier and, where Windows provides it, the sign-in email address) and when sessions start, lock, sleep and end.",
  },
  {
    name: "Attendance and leave",
    detail:
      "Attendance records, leave requests and balances, and documents uploaded with leave requests, which can include medical certificates or other sensitive information.",
  },
  {
    name: "Payroll (if used)",
    detail: "Pay type and rate, deductions and payslips.",
  },
  {
    name: "Support",
    detail: "Support tickets, messages and attachments.",
  },
  {
    // lib/device.ts: a random per-browser id plus a label from the user agent. Web sessions store
    // no IP address (Cognito exposes none on this tier).
    name: "Security and audit",
    detail:
      "A log of changes made in the workspace (who did what, and when); a record of each browser signed in to an account (browser and operating system, a random identifier for the browser, and when it was last active); and multi-factor authentication settings.",
  },
  {
    name: "AI features",
    detail:
      "Summaries and reports generated by AI, and conversations with the in-app assistant.",
  },
  {
    // onboarding.service.ts requestOrg: reviewed by WorkPulse staff (ops/org-requests).
    name: "Workspace requests",
    detail:
      "If you sign in with Google and request a new workspace, the organization and profile details you submit. WorkPulse staff review them.",
  },
  {
    // No analytics package in package.json and no tracking script anywhere in src/.
    name: "Website visits",
    detail:
      "The IP address, browser details and pages requested, as received by our hosting providers. We do not use analytics.",
  },
];

export function DataCategoryList() {
  return (
    <UL>
      {DATA_CATEGORIES.map((c) => (
        <LI key={c.name}>
          <B>{c.name}.</B> {c.detail}
        </LI>
      ))}
    </UL>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Sub-processors
 * ----------------------------------------------------------------------------------------------*/

const SUBPROCESSORS: { name: string; does: string; data: string; when: string }[] = [
  {
    // backend/infra: DynamoDB, S3, Cognito, SES (sandboxed today), IoT Core (push rail).
    name: "Amazon Web Services",
    does: "Hosting, database, file storage, sign-in (Amazon Cognito), email (Amazon SES) and live updates (AWS IoT Core)",
    data: "All categories of information listed in this document",
    when: "Always",
  },
  {
    // docs/OVERVIEW.md: the web app is deployed to Vercel. Not on the owner's brief. Page addresses
    // that reach it include invitation links (/invite/accept?…&token=…).
    name: "Vercel",
    does: "Hosting and delivery of the WorkPulse website and web application",
    data: "IP address, browser details and the addresses of the pages requested, which can contain identifiers such as an invitation link",
    when: "Whenever the website or web application is used",
  },
  {
    // notifications/src/consumers.rs: invitations (Resend first, SES fallback), the support inbox
    // (with attachments, no fallback), and workspace-request messages to staff and applicants.
    name: "Resend",
    does: "Delivery of transactional email: invitations, support tickets and workspace requests",
    data: "Recipients' names and email addresses, message content and, for support tickets, attachments",
    when: "When those emails are sent",
  },
  {
    // wp-platform/src/ai.rs: models::ASSISTANT and models::REDUCE route to Groq.
    name: "Groq",
    does: "AI text processing: summaries, reports and the in-app assistant",
    data: "The workspace information a request needs (for example time, attendance and activity records) and the questions asked",
    when: "When AI features are used",
  },
  {
    // wp-platform/src/ai.rs: models::VISION routes to OpenRouter (Groq has no vision model).
    // insights vision_map frame_brief: each image goes with its app name and the employee's
    // department and job title, so the frame is judged for that role (owner decision 2026-10-13).
    name: "OpenRouter",
    does: "AI analysis of screenshot images",
    data: "Screenshot images, with the name of the app in front and the employee's department and job title",
    when: "Only when screenshot analysis is in use",
  },
  {
    // sso-provider-buttons.tsx: Google is the only social provider (Microsoft removed 2026-09-30).
    // integrations google.rs: scope `calendar.freebusy` only.
    name: "Google",
    does: "Optional “Continue with Google” sign-in, and the Google Calendar integration",
    data: "Name and email address from the Google account; calendar free/busy times only, never event titles or details",
    when: "Only if someone signs in with Google, or the organization connects Google Calendar",
  },
  {
    // integrations slack.rs: scopes `chat:write,channels:read`.
    name: "Slack",
    does: "Posting WorkPulse notifications to the Slack channels the organization chooses",
    data: "The content of those notifications, and the organization's channel list",
    when: "Only if the organization connects Slack",
  },
  {
    // live-map.tsx: STYLE_URL defaults to tiles.openfreemap.org (overridable per deployment).
    name: "OpenFreeMap",
    does: "Map tiles for location maps",
    data: "The viewer's IP address and the area of the map being viewed",
    when: "When a location map is displayed",
  },
  {
    // components/ui/phone-input.tsx: <img src="https://flagcdn.com/w40/<iso>.png">. Not on the
    // owner's brief.
    name: "flagcdn.com",
    does: "Country flag images in phone-number fields",
    data: "The viewer's IP address and which flags are displayed",
    when: "When a phone-number field is displayed",
  },
];

export function SubprocessorTable() {
  return (
    <Table
      head={["Provider", "What it does", "Information involved", "When"]}
      rows={SUBPROCESSORS.map((s) => [s.name, s.does, s.data, s.when])}
      minWidth="44rem"
    />
  );
}

/* ------------------------------------------------------------------------------------------------
 * Retention
 * ----------------------------------------------------------------------------------------------*/

const RETENTION: { what: ReactNode; kept: string }[] = [
  {
    // fleet::retention_sweep enforces CONFIG#TRACK retention_days (1..=365, default 90) hourly;
    // the S3 rule on screenshots/ is only a backstop above 365.
    what: "Screenshots",
    kept: "The retention period the employer sets (from 1 to 365 days; 90 days unless changed), then deleted automatically.",
  },
  {
    // ingest fold_batch/location.rs: LOCATION_TTL_SECS = 90 days, fixed (not the employer's setting).
    what: "Location history",
    kept: "90 days, then deleted automatically.",
  },
  {
    // wp-platform/src/audit.rs: RETENTION_SECS = 365 days.
    what: "Audit log",
    kept: "1 year.",
  },
  {
    // identity upsert_my_session: SESSION_TTL_DAYS = 30, refreshed on each sign-in or refresh.
    what: "Sign-in session records",
    kept: "30 days after the browser was last active.",
  },
  {
    // notifications/src/consumers.rs: TTL_SECS = 30 days.
    what: "In-app notifications",
    kept: "30 days.",
  },
  {
    // infra storage_stack.py: `exports/` lifecycle rule, 7 days; links last about 15 minutes.
    what: "Workspace export files",
    kept: "7 days. Download links expire after about 15 minutes.",
  },
  {
    // Owner's brief. CDK sets 90 days only on the auth-trigger and event-consumer log groups;
    // the API Lambdas (api_stack.py) create their own log groups with no retention set, and CloudWatch
    // keeps those forever unless retention is set elsewhere. REVIEW: true only once that is fixed.
    what: "Service logs",
    kept: "Up to 90 days.",
  },
  {
    what: (
      <>
        Everything else: profiles, time, attendance, leave, payroll, activity, support
        tickets, AI summaries and assistant conversations
      </>
    ),
    kept: "Until the organization deletes it or closes its account.",
  },
  {
    // identity ownership: close/reopen run the 30-day grace, then purge.
    what: "After a workspace is closed",
    kept: "A 30-day grace period, during which an owner can reopen it. After that, permanently deleted.",
  },
  {
    // infra data_stack.py: point-in-time recovery on, no custom period, so the AWS default of 35 days.
    what: "Database backups",
    kept: "Deleted data can remain in encrypted backups for up to 35 days, until those backups expire.",
  },
];

export function RetentionTable() {
  return (
    <Table
      head={["Information", "How long it is kept"]}
      rows={RETENTION.map((r) => [r.what, r.kept])}
      minWidth="30rem"
    />
  );
}

/* ------------------------------------------------------------------------------------------------
 * Browser storage (Cookie Policy). Verified against src/: every `document.cookie`, `localStorage`
 * and `sessionStorage` call, the persisted Zustand stores, next-themes' default key, and
 * `clearWorkPulseState()` (auth.service.ts), which removes every `wp-*` key except `wp-ui` and
 * `wp-font` at sign-out.
 * ----------------------------------------------------------------------------------------------*/

type StorageRow = [ReactNode, string, string];

/** localStorage: signing in and security. */
export const SIGN_IN_STORAGE: StorageRow[] = [
  [
    <Code key="k">CognitoIdentityServiceProvider.*</Code>,
    "Your sign-in tokens, kept by Amazon Cognito's sign-in library.",
    "Until you sign out",
  ],
  [
    <Code key="k">wp-auth</Code>,
    "A copy of your signed-in profile (name, email address, role) so pages can load without waiting for the server.",
    "Until you sign out",
  ],
  [
    <Code key="k">wp-ephemeral</Code>,
    "Records that you chose not to stay signed in.",
    "Until you sign out",
  ],
  [
    <Code key="k">wp-sso-hosted</Code>,
    "Records that you signed in with Google, so signing out also ends that sign-in session.",
    "Until you sign out",
  ],
  [
    <Code key="k">wp-push-identity</Code>,
    "Connects this browser to WorkPulse's live-update service (AWS IoT Core).",
    "Until you sign out",
  ],
  [
    <Code key="k">wp.device.id</Code>,
    "A random identifier for this browser, so it appears once in your list of signed-in sessions, where you can sign it out.",
    "Until you clear your browser's storage",
  ],
];

/** localStorage: preferences and app state. */
export const PREFERENCE_STORAGE: StorageRow[] = [
  [
    <Code key="k">wp-ui</Code>,
    "Whether the sidebar is collapsed, and whether you have seen the latest desktop-app release notice.",
    "Until you clear your browser's storage",
  ],
  [
    <Code key="k">wp-font</Code>,
    "Your font choice.",
    "Until you clear your browser's storage",
  ],
  [
    <Code key="k">theme</Code>,
    "Light, dark or system theme.",
    "Until you clear your browser's storage",
  ],
  [
    <Code key="k">wp-theme-chosen</Code>,
    "Whether you chose that theme yourself.",
    "Until you sign out",
  ],
  [<Code key="k">wp-palette</Code>, "Your color palette.", "Until you sign out"],
  [<Code key="k">wp-dashboard</Code>, "Your dashboard layout.", "Until you sign out"],
  [
    <Code key="k">wp-fab-pos</Code>,
    "Where you have placed the assistant button.",
    "Until you sign out",
  ],
  [
    <Code key="k">wp-notifications-dismissed</Code>,
    "Notifications you have dismissed.",
    "Until you sign out",
  ],
  [
    <Code key="k">wp-org-export</Code>,
    "A workspace export in progress, so the page can pick it up again (workspace owners only).",
    "Until the export finishes, or you sign out",
  ],
  [
    <>
      <Code>wp-roles</Code>, <Code>wp-employees</Code>
    </>,
    "Working copies of role and directory settings, cached between page loads.",
    "Until you sign out",
  ],
];

/** sessionStorage: cleared when the tab closes, and each item as soon as it has been used. */
export const SESSION_STORAGE: StorageRow[] = [
  [
    <>
      <Code>wp-sso-pkce-verifier</Code>, <Code>wp-sso-state</Code>
    </>,
    "One-time security values for the round trip to Google during sign-in.",
    "Used once, then removed",
  ],
  [
    <Code key="k">wp-email-handoff</Code>,
    "Carries your email address from one sign-in page to the next, so it never appears in the page address.",
    "Used once, then removed",
  ],
  [
    <Code key="k">wp-integration-pending-provider</Code>,
    "Remembers which integration (Slack or Google Calendar) you are connecting while you approve it.",
    "Used once, then removed",
  ],
];
