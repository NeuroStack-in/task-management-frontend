"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight, User, Bell, Palette } from "lucide-react";
import { ADMIN_SECTIONS } from "@/constants/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import { Card } from "@/components/ui/card";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";

interface LinkItem {
  href: string;
  icon: LucideIcon;
  label: string;
  description?: string;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

function SettingCard({ item }: { item: LinkItem }) {
  return (
    <Link href={item.href} className="group">
      <Card className="h-full transition-shadow group-hover:shadow-md">
        <div className="flex items-start gap-4 px-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-feature-tint text-primary">
            <item.icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold">{item.label}</h3>
              <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </div>
            {item.description ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {item.description}
              </p>
            ) : null}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
      {children}
    </h2>
  );
}

export function AdminHub() {
  const { can } = usePermissions();

  // Personal account settings (everyone).
  const accountItems: LinkItem[] = [
    { href: "/profile", icon: User, label: "Profile", description: "Your name, role, and personal details." },
    ...(can("notifications:view")
      ? [
          {
            href: "/notifications",
            icon: Bell,
            label: "Notifications",
            description: "Alerts, reminders, and delivery preferences.",
          } as LinkItem,
        ]
      : []),
  ];

  // Organization administration (permission-filtered).
  const adminGroups = ADMIN_SECTIONS.map((g) => ({
    ...g,
    items: g.items.filter((item) => can(item.permission)),
  })).filter((g) => g.items.length > 0);

  // Section anchors for the side nav.
  const nav = [
    { id: "account", label: "Account" },
    ...adminGroups.map((g) => ({ id: slug(g.label), label: g.label })),
  ];
  const showAdmin = adminGroups.length > 0;

  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      {/* Section nav */}
      <nav className="lg:sticky lg:top-20 lg:w-44 lg:shrink-0 lg:self-start">
        <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0.5">
          {nav.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="block whitespace-nowrap rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Content */}
      <div className="min-w-0 flex-1 space-y-10">
        <section id="account" className="scroll-mt-24 space-y-3">
          <SectionHeading>Account</SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2">
            {accountItems.map((item) => (
              <SettingCard key={item.href} item={item} />
            ))}
            {/* Appearance — inline theme control */}
            <Card>
              <div className="flex items-start gap-4 px-5">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-feature-tint text-primary">
                  <Palette className="size-5" />
                </span>
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display font-semibold">Appearance</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Light, dark, or system theme.
                    </p>
                  </div>
                  <ThemeSwitcher />
                </div>
              </div>
            </Card>
          </div>
        </section>

        {showAdmin ? (
          <div className="space-y-10">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold">Administration</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            {adminGroups.map((group) => (
              <section
                key={group.label}
                id={slug(group.label)}
                className="scroll-mt-24 space-y-3"
              >
                <SectionHeading>{group.label}</SectionHeading>
                <div className="grid gap-4 sm:grid-cols-2">
                  {group.items.map((item) => (
                    <SettingCard
                      key={item.href}
                      item={{
                        href: item.href,
                        icon: item.icon,
                        label: item.label,
                        description: item.description,
                      }}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
