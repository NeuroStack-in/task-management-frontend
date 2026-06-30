import {
  Activity,
  BarChart3,
  CalendarCheck,
  Clock,
  FolderKanban,
  Plug,
  ShieldCheck,
  Sparkles,
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

export const PRODUCTS: ProductMeta[] = [
  { slug: "time-tracking", name: "Time Tracking", tagline: "Timers, timesheets & idle detection", icon: Clock },
  { slug: "activity-monitoring", name: "Activity & Productivity", tagline: "Activity, app & URL analytics", icon: Activity },
  { slug: "projects", name: "Project & Task Management", tagline: "Kanban, capacity & budgets", icon: FolderKanban },
  { slug: "attendance", name: "Attendance & Scheduling", tagline: "Clock-in, shifts & leave", icon: CalendarCheck },
  { slug: "workforce", name: "Workforce Management", tagline: "Directory, roles & org structure", icon: Users },
  { slug: "payroll", name: "Payroll & Billing", tagline: "Pay periods, rates & exports", icon: Wallet },
  { slug: "reports", name: "Reports & Analytics", tagline: "Dashboards & scheduled exports", icon: BarChart3 },
  { slug: "ai-insights", name: "AI Insights", tagline: "Anomaly & burnout detection", icon: Sparkles },
  { slug: "integrations", name: "Integrations & API", tagline: "Connectors, REST API & webhooks", icon: Plug },
  { slug: "security", name: "Security & Compliance", tagline: "SSO, RBAC, audit & residency", icon: ShieldCheck },
];

export const productHref = (slug: string) => `${PRODUCT_BASE}/${slug}`;
export const productBySlug = (slug: string) => PRODUCTS.find((p) => p.slug === slug);
