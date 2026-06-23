"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ADMIN_SECTIONS } from "@/constants/navigation";
import { usePermissions } from "@/hooks/use-permissions";
import { Card } from "@/components/ui/card";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";

export function AdminHub() {
  const { can } = usePermissions();

  const groups = ADMIN_SECTIONS.map((g) => ({
    ...g,
    items: g.items.filter((item) => can(item.permission)),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.label} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {group.label}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {group.items.map((item) => (
              <Link key={item.href} href={item.href} className="group">
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
            ))}
          </div>
        </section>
      ))}

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Preferences
        </h2>
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
      </section>
    </div>
  );
}
