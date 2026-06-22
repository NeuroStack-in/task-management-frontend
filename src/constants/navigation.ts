import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Timer,
  CheckSquare,
  FolderKanban,
  Users,
  Activity,
  Camera,
  FileBarChart,
  CheckCheck,
  Bot,
  AlertTriangle,
  Mail,
  Bell,
  Briefcase,
  Plug,
  CreditCard,
  ShieldCheck,
  MonitorSmartphone,
  Headset,
  KeyRound,
  ScrollText,
  Settings,
  HelpCircle,
  Building2,
} from "lucide-react";
import type { PermissionId } from "@/types/rbac";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Permission required to see this item. null = always visible. */
  permission: PermissionId | null;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Full navigation tree for the 29 canonical sections (SPEC.md §3), grouped for
 * the sidebar. The sidebar generator filters items by the active role's
 * permissions via canAccess().
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        permission: "dashboard:view",
      },
      {
        label: "Time Tracking",
        href: "/time-tracking",
        icon: Timer,
        permission: "time-tracking:view",
      },
      {
        label: "Tasks",
        href: "/tasks",
        icon: CheckSquare,
        permission: "tasks:view",
      },
      {
        label: "Projects",
        href: "/projects",
        icon: FolderKanban,
        permission: "projects:view",
      },
    ],
  },
  {
    label: "Monitoring",
    items: [
      {
        label: "Activity",
        href: "/activity",
        icon: Activity,
        permission: "activity:view",
      },
      {
        label: "Screenshots",
        href: "/screenshots",
        icon: Camera,
        permission: "screenshots:view",
      },
      {
        label: "Anomalies",
        href: "/anomalies",
        icon: AlertTriangle,
        permission: "anomalies:view",
      },
      {
        label: "Reports",
        href: "/reports",
        icon: FileBarChart,
        permission: "reports:view",
      },
    ],
  },
  {
    label: "People",
    items: [
      {
        label: "Employees",
        href: "/employees",
        icon: Users,
        permission: "employees:view",
      },
      {
        label: "Approvals",
        href: "/approvals",
        icon: CheckCheck,
        permission: "approvals:view",
      },
      {
        label: "Jobs",
        href: "/jobs",
        icon: Briefcase,
        permission: "jobs:view",
      },
    ],
  },
  {
    label: "Intelligence",
    items: [
      {
        label: "AI Center",
        href: "/ai",
        icon: Bot,
        permission: "ai:view",
      },
    ],
  },
  {
    label: "Communication",
    items: [
      {
        label: "Inbox",
        href: "/inbox",
        icon: Mail,
        permission: "communication:view",
      },
      {
        label: "Notifications",
        href: "/notifications",
        icon: Bell,
        permission: "notifications:view",
      },
    ],
  },
  {
    label: "Business",
    items: [
      {
        label: "Billing",
        href: "/billing",
        icon: CreditCard,
        permission: "billing:view",
      },
      {
        label: "Integrations",
        href: "/integrations",
        icon: Plug,
        permission: "integrations:view",
      },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        label: "Roles & Permissions",
        href: "/roles",
        icon: KeyRound,
        permission: "roles:view",
      },
      {
        label: "Security",
        href: "/security",
        icon: ShieldCheck,
        permission: "security:view",
      },
      {
        label: "Audit Logs",
        href: "/audit-logs",
        icon: ScrollText,
        permission: "audit-logs:view",
      },
      {
        label: "Remote Support",
        href: "/remote-support",
        icon: Headset,
        permission: "remote-support:view",
      },
      {
        label: "Desktop Agents",
        href: "/agents",
        icon: MonitorSmartphone,
        permission: "agents:view",
      },
      {
        label: "Organization",
        href: "/settings/organization",
        icon: Building2,
        permission: "settings:view",
      },
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
        permission: "settings:view",
      },
    ],
  },
  {
    label: "Support",
    items: [
      {
        label: "Help Center",
        href: "/help",
        icon: HelpCircle,
        permission: "help:view",
      },
    ],
  },
];
