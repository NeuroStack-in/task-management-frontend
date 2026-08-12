"use client";

/**
 * Sub-navigation for the Device agents section (Settings → Device agents). Two surfaces live here —
 * the **device list** (`/settings/agents`) and the managed-agent **enrolment** flow
 * (`/settings/agents/enrollment`) — but the enrolment page had no link, so it was reachable only by
 * typing the URL. This tab bar wires them together.
 *
 * The Enrolment tab shows only when it can actually succeed: the org is in a **managed** mode
 * (machine/both — a project-mode mint 409s) and the viewer holds `agents:manage`. It is hidden on the
 * device-detail page ([agentId]), which is a drill-down, not a peer of the list.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MonitorSmartphone, QrCode } from "lucide-react";
import { useTrackingMode } from "@/hooks/use-features";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";

const DEVICES = "/settings/agents";
const ENROL = "/settings/agents/enrollment";

export default function AgentsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const mode = useTrackingMode();
  const { can } = usePermissions();

  const showEnrol = mode !== "project" && can("agents:manage");
  // Only the two list surfaces get the tab bar — not the device-detail drill-down.
  const onTabsPage = pathname === DEVICES || pathname === ENROL;

  const tabs = [
    { href: DEVICES, label: "Devices", icon: MonitorSmartphone, show: true },
    { href: ENROL, label: "Enrol a device", icon: QrCode, show: showEnrol },
  ].filter((t) => t.show);

  return (
    <div className="flex flex-col gap-4">
      {onTabsPage && tabs.length > 1 ? (
        <nav className="flex items-center gap-1 border-b border-border">
          {tabs.map((t) => {
            const active = pathname === t.href;
            const Icon = t.icon;
            return (
              <Link
                key={t.href}
                href={t.href}
                className={cn(
                  "inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {t.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
      {children}
    </div>
  );
}
