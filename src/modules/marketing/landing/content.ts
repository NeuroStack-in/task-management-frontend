/* ============================================================= *
 *  WorkPulse — Landing content (warm editorial redesign)         *
 *  Data only. Palette-agnostic. Landing-only.                    *
 * ============================================================= *
 *
 *  ⚠️  EVERY CLAIM ON THIS PAGE MUST BE TRUE TODAY.
 *
 *  This file was rewritten on 2026-07-20 because it wasn't. It
 *  advertised SSO/SAML and SCIM (cut — `WorkPulse-SSO.md` is
 *  PROPOSED, not approved, and `plans.rs` has a regression test
 *  asserting `security.sso` must NOT exist), an integrations
 *  marketplace with webhooks and a REST API (deferred, no design,
 *  no slices — same test guards `integrations`), approval-gated
 *  remote support (CUT, LLD §18: "no remote sessions"), data
 *  residency and a signed DPA (neither exists), a mobile app and
 *  GPS clock-in (no mobile client, and `locations` has no backend
 *  at all), import-from-your-tools (nothing to import with), and
 *  burnout/anomaly detection (not built).
 *
 *  The convention now: present tense only for what ships today.
 *  Anything still coming says so **in the copy itself** — see the
 *  activity block, which is labelled beta rather than described as
 *  though it works. If a reader could sign up expecting it and be
 *  wrong, the sentence is a bug.
 *
 *  Plan features below mirror `Plan::allowed()` in
 *  `crates/wp-contracts/src/plans.rs`, which is the server's real
 *  entitlement ceiling. Keep them in step.
 * ============================================================= */

import {
  Activity,
  BrainCircuit,
  Clock,
  Eye,
  Fingerprint,
  FolderKanban,
  HeartPulse,
  KeyRound,
  Layers,
  MonitorSmartphone,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  PRODUCTS,
  RESOURCES,
  SOLUTIONS,
  productHref,
  type NavLink,
} from "@/modules/marketing/products";

export type VisualKind = "pulse" | "time" | "insight" | "board" | "ai";

/* ---- Hero: word-tokens (em = serif-italic terracotta emphasis) ---- */
export interface Word {
  w: string;
  em?: boolean;
}
export const HERO_LINES: Word[][] = [
  [{ w: "Run" }, { w: "your" }, { w: "whole" }],
  [{ w: "workforce" }, { w: "on" }, { w: "one" }],
  [{ w: "calm", em: true }, { w: "pulse.", em: true }],
];
export const HERO_LEAD = "Time, attendance, projects and people — in one calm place.";
export const HERO_SUB =
  "WorkPulse brings timesheets, attendance, leave, projects and payroll onto a single record, and reads your day back to you each morning in plain language. Calm, not clinical.";
export const HERO_MICRO = "Free during beta · No credit card required";

/* ---- Use-case marquee ---- */
export const USE_CASES = [
  "Field service",
  "Remote & hybrid",
  "Agencies",
  "BPO & support",
  "Startups",
  "Consultancies",
  "Construction",
  "Healthcare ops",
  "Enterprises",
];

/* ---- Oversized stat band ----
   Numbers only where they're checkable. `44` is the live permission catalog
   (`GET /v1/permissions`); `3` is the seeded system roles in `wp-contracts`. */
export interface Stat {
  value: string;
  to?: number;
  suffix?: string;
  label: string;
}
export const STATS: Stat[] = [
  { value: "44", to: 44, label: "granular permissions" },
  { value: "3", to: 3, label: "system roles, plus your own" },
  { value: "1", to: 1, label: "record for time, people & projects" },
  { value: "AI", label: "summary of your day, in plain words" },
];

/* ---- Big editorial feature blocks ---- */
export interface FeatureBlock {
  idx: string;
  kicker: string;
  icon: LucideIcon;
  title: string;
  body: string;
  bullets: string[];
  visual: VisualKind;
  slug: string;
}
export const FEATURE_BLOCKS: FeatureBlock[] = [
  {
    idx: "01",
    kicker: "Time",
    icon: Clock,
    title: "Time that records itself.",
    body: "The desktop agent keeps the timer, so hours arrive as they happen and build into daily and weekly timesheets on their own. Entries are derived, never typed — which means a timesheet is a record of what happened, not of what someone remembered on Friday.",
    bullets: [
      "Timer lives in the desktop agent",
      "Daily & weekly timesheets build themselves",
      "Immutable by design — no silent edits",
    ],
    visual: "time",
    slug: "time-tracking",
  },
  {
    idx: "02",
    kicker: "Activity · in beta",
    icon: Activity,
    title: "Activity insight, arriving with the agent.",
    body: "Active and idle time, app and website context, and screenshot review are built into the desktop agent and rolling out through beta — they are not switched on for everyone yet. You set the app and URL rules up front, the agent asks for consent on the device, and nothing is captured while the timer is off.",
    bullets: [
      "Consent-first, and off until accepted",
      "App & URL rules you define, not us",
      "Rolling out with the desktop agent",
    ],
    visual: "insight",
    slug: "activity-monitoring",
  },
  {
    idx: "03",
    kicker: "Projects",
    icon: FolderKanban,
    title: "Plans and people, one record.",
    body: "Kanban projects sit beside attendance, leave and approvals, so who is working on what and who is actually available are the same question. No reconciling a board against a spreadsheet of who's off.",
    bullets: [
      "Kanban projects, tasks & priorities",
      "Project members with their own roles",
      "Attendance, leave & approvals alongside",
    ],
    visual: "board",
    slug: "projects",
  },
  {
    idx: "04",
    kicker: "Intelligence",
    icon: BrainCircuit,
    title: "Your day, read back in plain language.",
    body: "A daily summary written over your own hours, tasks and attendance — not generic advice. Ask the assistant a question about your workspace and it answers from the same record, so the numbers in the answer are the numbers on the page.",
    bullets: [
      "Daily summary over your real data",
      "Ask the assistant in plain language",
      "Grounded in your workspace, not the web",
    ],
    visual: "ai",
    slug: "ai-insights",
  },
];

/* ---- Roles ---- */
export interface Role {
  id: string;
  label: string;
  icon: LucideIcon;
  headline: string;
  body: string;
  points: string[];
  visual: VisualKind;
}
export const ROLES: Role[] = [
  {
    id: "owner",
    label: "Owners",
    icon: HeartPulse,
    headline: "The whole organization, in one glance.",
    body: "One dashboard across headcount, projects and plan usage, with a daily AI summary of what moved since yesterday.",
    points: ["Org dashboard & headcount", "Daily AI summary", "Plan, seats & feature control"],
    visual: "ai",
  },
  {
    id: "manager",
    label: "Managers",
    icon: FolderKanban,
    headline: "Assign the work, see who's actually in.",
    body: "Keep boards moving and approve leave in a couple of clicks, with the team's attendance in the same view.",
    points: ["Kanban projects & tasks", "Team attendance calendar", "Leave approvals, single or bulk"],
    visual: "board",
  },
  {
    id: "hr",
    label: "HR",
    icon: Users,
    headline: "Attendance & leave, minus the spreadsheets.",
    body: "Attendance, leave balances, requests and approvals in one place — with a clean audit trail behind every change.",
    points: ["Attendance & leave balances", "Directory, teams & departments", "Invites & onboarding"],
    visual: "time",
  },
  {
    id: "finance",
    label: "Finance",
    icon: Wallet,
    headline: "Compensation, deductions and pay runs.",
    body: "Set compensation per person, define deductions once, and generate a pay run whose totals you can trace back to their inputs.",
    points: ["Compensation & deductions", "Pay runs with traceable totals", "Plan, seats & billing"],
    visual: "time",
  },
  {
    id: "it",
    label: "IT & Security",
    icon: ShieldCheck,
    headline: "Governed, isolated, and auditable.",
    body: "Role-based access down to 44 permissions, MFA on every password sign-in, and an audit trail behind every change — with monitoring that is consent-first by design.",
    points: ["RBAC & custom roles", "MFA & session visibility", "Audit log & device fleet"],
    visual: "insight",
  },
];

/* ---- Breadth (one platform) ---- */
export interface ModuleGroup {
  icon: LucideIcon;
  title: string;
  items: string[];
}
export const MODULE_GROUPS: ModuleGroup[] = [
  {
    icon: Clock,
    title: "Time & attendance",
    items: ["Automatic timesheets", "Attendance calendar", "Leave balances & requests", "Approvals, single or bulk"],
  },
  {
    icon: FolderKanban,
    title: "Projects & tasks",
    items: ["Kanban boards & tasks", "Priorities & estimates", "Project members & roles"],
  },
  {
    icon: Users,
    title: "People",
    items: ["Employee directory & profiles", "Departments & teams", "Invites & onboarding"],
  },
  {
    icon: Wallet,
    title: "Payroll & billing",
    items: ["Compensation & deductions", "Pay runs & totals", "Plan, seats & invoices"],
  },
  {
    icon: Sparkles,
    title: "AI",
    items: ["Daily summary of your day", "Assistant grounded in your data"],
  },
  {
    icon: ShieldCheck,
    title: "Control & security",
    items: ["Roles & 44 permissions", "Audit log", "Feature toggles & tracking rules"],
  },
];

/* ---- How it works ---- */
export interface Step {
  n: string;
  title: string;
  body: string;
}
export const STEPS: Step[] = [
  {
    n: "01",
    title: "Create your workspace",
    body: "Set up your organization, then invite your team by email. Everyone joins with a role, so access is right from the first sign-in.",
  },
  {
    n: "02",
    title: "Install the desktop agent",
    body: "Your team installs the agent and accepts on-device consent. From then on, hours arrive on their own and build into timesheets.",
  },
  {
    n: "03",
    title: "Read the pulse",
    body: "Check the dashboard, approve leave, and start each day with a plain-language summary of what actually changed.",
  },
];

/* ---- Security ----
   All six are things the platform does today. What used to sit here — SSO/SAML,
   SCIM, data residency, a signed DPA, approval-gated remote support — is either
   cut or unbuilt, and two of those are guarded by a test in `plans.rs` precisely
   so nobody can entitle them by accident. */
export interface EnterpriseItem {
  icon: LucideIcon;
  title: string;
  body: string;
}
export const ENTERPRISE: EnterpriseItem[] = [
  {
    icon: KeyRound,
    title: "Managed sign-in & MFA",
    body: "Authentication runs on Amazon Cognito, with time-based one-time codes available on every password account.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    body: "Three system roles plus your own, built from 44 granular permissions. The server checks every request, not just the menu.",
  },
  {
    icon: ScrollText,
    title: "Audit log",
    body: "Permission changes, sign-ins and administrative actions are recorded and searchable by category.",
  },
  {
    icon: Fingerprint,
    title: "Tenant isolation",
    body: "Every record is keyed to your organization at the database level, so another tenant's data is unreachable by construction.",
  },
  {
    icon: Eye,
    title: "Consent-first monitoring",
    body: "The agent captures nothing until the person on the device accepts, and nothing at all while the timer is off.",
  },
  {
    icon: MonitorSmartphone,
    title: "Device fleet visibility",
    body: "See which machines are enrolled, which are reporting, and which have gone quiet.",
  },
];

/* ---- Principles (honest — no fabricated testimonials) ---- */
export interface Principle {
  icon: LucideIcon;
  title: string;
  body: string;
}
export const PRINCIPLES: Principle[] = [
  {
    icon: HeartPulse,
    title: "Calm by design",
    body: "We turn many noisy streams into one clear pulse. Signal over noise — a quiet control surface, not a wall of dashboards.",
  },
  {
    icon: Eye,
    title: "Consent-first monitoring",
    body: "Activity capture is opt-in on the device, bounded by rules you set, and paused whenever the timer is. Built to support people, not surveil them.",
  },
  {
    icon: Layers,
    title: "One source of truth",
    body: "Time, people, projects and pay share a single record — nothing to reconcile, no tool sprawl to manage.",
  },
];

/* ---- Pricing ----
   Feature lists mirror `Plan::allowed()` in `crates/wp-contracts/src/plans.rs`,
   which is the server's actual entitlement ceiling:
     Free       time.tracking · attendance · leave · projects · reports.basic
     Starter    + monitoring.activity
     Enterprise + monitoring.screenshots · ai.insights · ai.assistant ·
                  anomalies · insights.reports.ai_pdf
   Names and prices are kept in step with `app/pricing/page.tsx`. */
export interface PricingTier {
  name: string;
  price: string;
  tagline: string;
  features: string[];
  cta: string;
  featured: boolean;
}
export const PRICING: PricingTier[] = [
  {
    name: "Free",
    price: "$0",
    tagline: "For individuals and very small teams getting started.",
    features: [
      "Timesheets & attendance",
      "Leave & approvals",
      "Projects & tasks",
      "Basic reports",
      "Up to 5 members",
    ],
    cta: "Get started free",
    featured: false,
  },
  {
    name: "Starter",
    price: "$12",
    tagline: "For growing teams that need real insight.",
    features: [
      "Everything in Free",
      "Unlimited projects & tasks",
      "Activity insight (beta)",
      "Unlimited members",
    ],
    cta: "Choose Starter",
    featured: false,
  },
  {
    name: "Enterprise",
    price: "$22",
    tagline: "For organizations operating at scale.",
    features: [
      "Everything in Starter",
      "Screenshot review (beta)",
      "AI summaries & assistant",
      "PDF report export",
      "Audit log & role controls",
    ],
    cta: "Choose Enterprise",
    featured: true,
  },
];
export const PRICING_NOTE =
  "Prices are indicative for launch. WorkPulse is free for every plan while we're in beta — no card required — and features marked beta are still rolling out.";

/* ---- FAQ ---- */
export const FAQS: Faq[] = [
  {
    q: "Is WorkPulse employee monitoring or surveillance?",
    a: "It's built to be the opposite. Capture is opt-in on the device, stops whenever the timer stops, and stays inside app and URL rules you set yourself. Screenshots are blurred and reviewable. Nothing about it is designed to be hidden from the person it's about.",
  },
  {
    q: "Do you have a mobile app?",
    a: "Not yet. WorkPulse today is a web app plus a desktop agent for Windows, and the agent is what keeps the timer. A mobile client and location-aware clock-in for field crews are on the roadmap, not in your hands yet.",
  },
  {
    q: "How does billing work?",
    a: "Plans are priced per active user, monthly or annually. Everything is free while we're in beta — no card required — and you can change plan from Settings at any time.",
  },
  {
    q: "Is my organization's data secure?",
    a: "Sign-in runs on Amazon Cognito with MFA available, every record is keyed to your organization so other tenants can't reach it, access is checked server-side against 44 permissions, and data is encrypted in transit and at rest. Single sign-on and a signed DPA are not available yet.",
  },
  {
    q: "Can I import from my current tool?",
    a: "Not yet — there's no importer and no public API today. You can invite your team by email and start fresh; historical data has to stay where it is for now.",
  },
];
export interface Faq {
  q: string;
  a: string;
}

/* ---- Footer nav ----
   Derived from the same lists the navbar reads (`marketing/products.ts`), so the two can't drift.
   They previously did: the footer, the shared `MarketingFooter` and the nav each named a different
   set of links. The footer shows the first four products; the nav's mega-menu shows all ten. */
export const FOOTER_COLUMNS: { title: string; links: NavLink[] }[] = [
  {
    title: "Product",
    links: PRODUCTS.slice(0, 4).map((p) => ({ label: p.name, href: productHref(p.slug) })),
  },
  { title: "Solutions", links: SOLUTIONS },
  { title: "Resources", links: [...RESOURCES, { label: "Log in", href: "/login" }] },
];
