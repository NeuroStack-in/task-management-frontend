import {
  Activity,
  BarChart3,
  Briefcase,
  Building2,
  CalendarCheck,
  Clock,
  FolderKanban,
  HardHat,
  Headset,
  HelpCircle,
  Laptop,
  Lock,
  Plug,
  ShieldCheck,
  Sparkles,
  Tag,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export const PRODUCT_BASE = "/product";

/**
 * Central registry of the 10 core feature pages. Drives the nav mega-menu,
 * the footer product column, related-page links, and route generation so
 * everything stays in sync from one source.
 */
export interface ProductMeta {
  slug: string;
  name: string;
  tagline: string;
  icon: LucideIcon;
}

/**
 * ⚠️ These taglines appear in the nav mega-menu on **every** marketing page, so each one is a
 * product claim seen more often than the page it links to. They were corrected on 2026-07-20:
 *
 *  · AI Insights said "Anomaly & burnout detection" — `anomalies` has no implementation.
 *  · Security said "SSO, RBAC, audit & residency" — SSO is cut (`plans.rs` has a test asserting
 *    `security.sso` must not exist) and there is no data-residency option.
 *  · Time Tracking said "idle detection" — idle handling lives in the agent, not the product.
 *  · Projects said "capacity & budgets" — neither exists.
 *  · Reports said "scheduled exports" — nothing schedules anything.
 *
 * `integrations` is still listed because its page and route are generated from this array and
 * removing the entry would 404 a live URL. Its page copy needs the same correction pass — the
 * connectors, REST API and webhooks it describes are all deferred, with no design and no slices.
 */
export const PRODUCTS: ProductMeta[] = [
  { slug: "time-tracking", name: "Time Tracking", tagline: "Automatic timesheets from the agent", icon: Clock },
  { slug: "activity-monitoring", name: "Activity & Productivity", tagline: "App & URL rules · in beta", icon: Activity },
  { slug: "projects", name: "Project & Task Management", tagline: "Kanban boards, tasks & members", icon: FolderKanban },
  { slug: "attendance", name: "Attendance & Scheduling", tagline: "Attendance, leave & approvals", icon: CalendarCheck },
  { slug: "workforce", name: "Workforce Management", tagline: "Directory, roles & org structure", icon: Users },
  { slug: "payroll", name: "Payroll & Billing", tagline: "Compensation, deductions & pay runs", icon: Wallet },
  { slug: "reports", name: "Reports & Analytics", tagline: "Dashboards & exports", icon: BarChart3 },
  { slug: "ai-insights", name: "AI Insights", tagline: "Daily summary & assistant", icon: Sparkles },
  { slug: "integrations", name: "Integrations & API", tagline: "On the roadmap", icon: Plug },
  { slug: "security", name: "Security & Compliance", tagline: "RBAC, MFA & audit log", icon: ShieldCheck },
];

export const productHref = (slug: string) => `${PRODUCT_BASE}/${slug}`;
export const productBySlug = (slug: string) => PRODUCTS.find((p) => p.slug === slug);

/* ============================================================= *
 *  Shared marketing navigation
 *
 *  One source for the nav dropdowns AND the footer columns. They
 *  were separate lists that had already drifted — the landing
 *  footer, the shared `MarketingFooter` and the nav each named a
 *  different set of links, and two of them pointed at anchors that
 *  don't exist on the page you'd land on.
 *
 *  Anchors resolve against the landing page, so they are absolute
 *  (`/#roles`, not `#roles`) and work from `/pricing` and
 *  `/product/*` too.
 * ============================================================= */

export interface NavLink {
  label: string;
  href: string;
  /** Optional so footer-only entries (e.g. "Log in") don't have to invent one. */
  icon?: LucideIcon;
  tagline?: string;
}

/** Audience cuts. All five land on the landing page's role selector. */
export const SOLUTIONS: NavLink[] = [
  { label: "Field service", href: "/#roles", icon: HardHat, tagline: "Crews on the move" },
  { label: "Remote & hybrid", href: "/#roles", icon: Laptop, tagline: "Distributed teams" },
  { label: "Agencies", href: "/#roles", icon: Briefcase, tagline: "Project-based work" },
  { label: "BPO & support", href: "/#roles", icon: Headset, tagline: "Shift-based operations" },
  { label: "Enterprise", href: "/#security", icon: Building2, tagline: "Roles, audit & scale" },
];

/**
 * Deliberately short. `/help` is inside the authenticated app, so linking it
 * from a public page bounces a visitor to sign-in; a status page and API docs
 * don't exist. Only links a signed-out visitor can actually follow belong here.
 */
export const RESOURCES: NavLink[] = [
  { label: "Pricing", href: "/pricing", icon: Tag, tagline: "Plans & what's included" },
  { label: "FAQ", href: "/#faq", icon: HelpCircle, tagline: "Common questions" },
  { label: "Security", href: "/#security", icon: Lock, tagline: "How your data is protected" },
];
