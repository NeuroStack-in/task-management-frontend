import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  SlidersHorizontal,
  Globe,
  ToggleRight,
  ShieldCheck,
  Bell,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";

export const metadata: Metadata = { title: "Settings" };

const GROUPS: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
}[] = [
  {
    href: "/settings/organization",
    icon: Building2,
    title: "Organization",
    description: "Company info, departments, teams, working hours, and branding.",
  },
  {
    href: "/settings/monitoring",
    icon: SlidersHorizontal,
    title: "Monitoring",
    description: "Idle, screenshot, and productivity thresholds.",
  },
  {
    href: "/settings/tracking-rules",
    icon: Globe,
    title: "Application & URL rules",
    description: "Allow lists, block lists, and productivity scoring.",
  },
  {
    href: "/settings/features",
    icon: ToggleRight,
    title: "Feature management",
    description: "Turn modules on or off for the whole organization.",
  },
  {
    href: "/security",
    icon: ShieldCheck,
    title: "Security",
    description: "MFA, SSO, session policies, and security events.",
  },
  {
    href: "/notifications",
    icon: Bell,
    title: "Notifications",
    description: "Alerts, reminders, and delivery preferences.",
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-5 pt-1">
      <PageHeader
        title="Settings"
        description="Manage your organization, monitoring, and account preferences."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {GROUPS.map((g) => (
          <Link key={g.href} href={g.href} className="group">
            <Card className="h-full transition-shadow group-hover:shadow-md">
              <div className="flex items-start gap-4 px-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-feature-tint text-primary">
                  <g.icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-semibold">{g.title}</h3>
                    <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {g.description}
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <div className="flex items-center justify-between gap-4 px-5">
          <div>
            <h3 className="font-display font-semibold">Appearance</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Switch between light, dark, and system themes.
            </p>
          </div>
          <ThemeSwitcher />
        </div>
      </Card>
    </div>
  );
}
