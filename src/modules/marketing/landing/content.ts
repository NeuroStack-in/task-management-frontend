/* ============================================================= *
 *  WorkPulse — Landing content (warm editorial redesign)         *
 *  Data only. Palette-agnostic. Landing-only.                    *
 * ============================================================= */

import {
  Activity,
  BrainCircuit,
  Clock,
  Eye,
  Fingerprint,
  FolderKanban,
  Globe,
  Headset,
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
export const HERO_LEAD = "Track time, see activity, and run projects — in one calm place.";
export const HERO_SUB =
  "WorkPulse unifies time, attendance, activity, and projects into a single clear signal — with AI that tells you what actually needs attention. Calm, not clinical.";
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

/* ---- Oversized stat band (honest) ---- */
export interface Stat {
  value: string;
  to?: number;
  suffix?: string;
  label: string;
}
export const STATS: Stat[] = [
  { value: "29", to: 29, label: "modules in one platform" },
  { value: "5", to: 5, label: "role types, fully permissioned" },
  { value: "1", to: 1, suffix: "-tap", label: "timer on web, desktop & mobile" },
  { value: "AI", label: "insight on every metric" },
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
    title: "Time that tracks itself.",
    body: "A one-tap timer turns into clean, automatic timesheets — idle-aware, switchable between tasks, and ready for approval, payroll, and billing without the chasing.",
    bullets: ["One-tap & idle-aware timer", "Automatic weekly timesheets", "Approvals, corrections & exports"],
    visual: "time",
    slug: "time-tracking",
  },
  {
    idx: "02",
    kicker: "Insight",
    icon: Activity,
    title: "See where the day really goes.",
    body: "Active vs. idle time, app and website usage, and a productivity score per person and team — presented as calm context, never as surveillance theatre.",
    bullets: ["Active vs. idle analysis", "App & website breakdown", "Team productivity trends"],
    visual: "insight",
    slug: "activity-monitoring",
  },
  {
    idx: "03",
    kicker: "Projects",
    icon: FolderKanban,
    title: "Plans, people, and capacity — one board.",
    body: "Kanban projects sit right next to attendance, schedules, and leave, so delivery and capacity are always in the same view. Nobody is quietly overloaded.",
    bullets: ["Kanban projects & tasks", "Workload & capacity", "Attendance, schedules & leave"],
    visual: "board",
    slug: "projects",
  },
  {
    idx: "04",
    kicker: "Intelligence",
    icon: BrainCircuit,
    title: "An analyst that reads every signal for you.",
    body: "WorkPulse summarises the week in plain language, flags burnout and anomalies before they bite, and recommends the next move — so you lead on signal, not spreadsheets.",
    bullets: ["Daily & weekly AI summaries", "Burnout & anomaly detection", "Plain-language recommendations"],
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
    body: "One executive pulse across every team, with AI summarising what changed this week and where to look next.",
    points: ["Org-wide productivity & trends", "Burnout & anomaly signals", "Company reports & exports"],
    visual: "ai",
  },
  {
    id: "manager",
    label: "Managers",
    icon: FolderKanban,
    headline: "Assign the work, watch the capacity.",
    body: "Keep projects moving, see who is over- or under-loaded, and approve timesheets in a couple of clicks.",
    points: ["Team workload & capacity", "Kanban projects & deadlines", "One-click approvals"],
    visual: "board",
  },
  {
    id: "hr",
    label: "HR",
    icon: Users,
    headline: "Attendance & leave, minus the spreadsheets.",
    body: "Clock-in, schedules, leave balances, and approvals in one place — with a clean audit trail behind every change.",
    points: ["Attendance & schedules", "Leave balances & requests", "Directory, teams & departments"],
    visual: "time",
  },
  {
    id: "finance",
    label: "Finance",
    icon: Wallet,
    headline: "Hours become payroll and billing.",
    body: "Approved time flows straight into pay periods and client-billable reports, with per-payslip and full-run exports.",
    points: ["Billable hours & utilisation", "Pay periods & payslips", "CSV / PDF exports"],
    visual: "time",
  },
  {
    id: "it",
    label: "IT & Security",
    icon: ShieldCheck,
    headline: "Governed, monitored, and auditable.",
    body: "Role-based access, SSO/SCIM, device and agent management, and a full audit log — with monitoring that is consent-first by design.",
    points: ["RBAC, SSO/SAML & SCIM", "Desktop agent & device fleet", "Audit logs & approval gates"],
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
  { icon: Clock, title: "Time & projects", items: ["One-tap timer & timesheets", "Kanban projects & tasks", "Attendance & schedules", "Leave & approvals"] },
  { icon: Users, title: "People & payroll", items: ["Employee directory & profiles", "Departments, teams & roles", "Payroll periods & exports"] },
  { icon: Activity, title: "Monitoring", items: ["Active vs. idle & app usage", "Screenshots & timelines", "Consent-first controls"] },
  { icon: Sparkles, title: "Insights & AI", items: ["Live dashboards & reports", "AI summaries & recommendations", "Anomaly & burnout detection"] },
  { icon: ShieldCheck, title: "Control & security", items: ["Roles & permissions (RBAC)", "SSO / SAML, SCIM & MFA", "Audit logs & remote support"] },
  { icon: Layers, title: "Integrations", items: ["Slack, GitHub & Google", "Webhooks & REST API", "Import from your tools"] },
];

/* ---- How it works ---- */
export interface Step {
  n: string;
  title: string;
  body: string;
}
export const STEPS: Step[] = [
  { n: "01", title: "Invite your team", body: "Bring people in by email or SSO and group them into teams and projects in minutes." },
  { n: "02", title: "Track time & activity", body: "The timer and lightweight agent capture hours, attendance, and activity automatically." },
  { n: "03", title: "Act on the pulse", body: "Read one clear signal, approve timesheets, and catch burnout or overruns early." },
];

/* ---- Security ---- */
export interface EnterpriseItem {
  icon: LucideIcon;
  title: string;
  body: string;
}
export const ENTERPRISE: EnterpriseItem[] = [
  { icon: KeyRound, title: "SSO / SAML & SCIM", body: "Single sign-on and automated provisioning, architected in from day one." },
  { icon: Fingerprint, title: "MFA & session policies", body: "Enforce multi-factor, session limits, and device-level controls." },
  { icon: ScrollText, title: "Audit logs", body: "Every action, permission change, and login — captured and searchable." },
  { icon: Globe, title: "Data residency & DPA", body: "Choose where data lives; encrypted in transit and at rest." },
  { icon: Headset, title: "Approval-gated remote support", body: "Consent-based remote sessions with a full audit trail." },
  { icon: MonitorSmartphone, title: "Desktop agent management", body: "Roll out, configure, and monitor agent health at scale." },
];

/* ---- Principles (honest — no fabricated testimonials) ---- */
export interface Principle {
  icon: LucideIcon;
  title: string;
  body: string;
}
export const PRINCIPLES: Principle[] = [
  { icon: HeartPulse, title: "Calm by design", body: "We turn many noisy streams into one clear pulse. Signal over noise — a quiet control surface, not a wall of dashboards." },
  { icon: Eye, title: "Consent-first monitoring", body: "Activity and screenshots are optional, policy-gated, transparent to your team, and fully audited. Built to support people, not surveil them." },
  { icon: Layers, title: "One source of truth", body: "Time, people, projects, and insights share a single data model — nothing to reconcile, no tool sprawl to manage." },
];

/* ---- Pricing ---- */
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
    name: "Pro",
    price: "$12",
    tagline: "For growing teams that need real insight.",
    features: ["Time tracking & timesheets", "Activity & productivity", "Unlimited projects & tasks", "Reports & exports", "Priority support"],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Max",
    price: "$22",
    tagline: "For organizations operating at scale.",
    features: ["Everything in Pro", "SSO / SAML & SCIM", "Anomaly & burnout AI", "Audit logs, DPA & residency", "Dedicated success manager"],
    cta: "Start free",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    tagline: "Procurement, security review & volume.",
    features: ["Everything in Max", "Custom contracts & invoicing", "SAML & SCIM at scale", "Tailored onboarding", "Premier SLA & support"],
    cta: "Get started",
    featured: false,
  },
];
export const PRICING_NOTE =
  "Prices shown are indicative for launch. WorkPulse is free while we're in beta — no credit card required.";

/* ---- FAQ ---- */
export interface Faq {
  q: string;
  a: string;
}
export const FAQS: Faq[] = [
  { q: "Is WorkPulse employee monitoring or surveillance?", a: "No. WorkPulse focuses on transparent, mostly-aggregate signals — hours, attendance, and productivity context — with clear controls and consent. Optional screenshots are policy-gated, blurred by default, and audited. It's built to support teams, not spy on them." },
  { q: "Does it work on mobile, desktop, and for field teams?", a: "Yes. There's a one-tap timer on web, desktop, and mobile, plus GPS-aware clock-in for crews on the move." },
  { q: "How does billing work?", a: "Plans are per active user, billed monthly or annually. You can start free during our beta — no card required — and upgrade any time." },
  { q: "Is my organization's data secure?", a: "Data is encrypted in transit and at rest. Enterprise plans add SSO/SAML, SCIM, audit logs, and a signed DPA, with data-residency options." },
  { q: "Can I import from my current tool?", a: "Yes — import people, projects, and historical time from common tools, or use the API to bring everything across." },
];

/* ---- Footer nav ---- */
export const FOOTER_COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Time tracking", href: "/product/time-tracking" },
      { label: "Activity & productivity", href: "/product/activity-monitoring" },
      { label: "Projects & tasks", href: "/product/projects" },
      { label: "AI insights", href: "/product/ai-insights" },
      { label: "Integrations", href: "/product/integrations" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Field service", href: "/#roles" },
      { label: "Remote & hybrid", href: "/#roles" },
      { label: "Agencies", href: "/#roles" },
      { label: "Enterprise", href: "/#security" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "FAQ", href: "/#faq" },
      { label: "Security", href: "/#security" },
      { label: "Log in", href: "/login" },
    ],
  },
];
