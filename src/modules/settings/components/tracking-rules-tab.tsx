"use client";

/**
 * The org-wide app/URL tracking-rules page. Thin wrapper around the shared {@link RulesEditor}
 * (also used, department-scoped, by `dept-productivity-dialog.tsx`): this file supplies the page
 * chrome (header, permission banner, agent note) and the org-scoped rules state; the editor owns the
 * tabs, panels and save bar.
 */
import { Lock, MonitorSmartphone } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { usePermissions } from "@/hooks/use-permissions";
import { useOrgRules } from "../use-org-rules";
import { RulesEditor } from "./org/rules-editor";

export function TrackingRulesTab() {
  const { can } = usePermissions();
  const canManage = can("settings:manage");
  const rules = useOrgRules();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tracking rules"
        description="Classify apps and websites, manage allow/block lists, and set productivity-score weights. The desktop agent pulls these on its next heartbeat."
      />

      {!canManage && (
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted px-5 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          You can view these settings, but saving requires the{" "}
          <span className="font-medium text-foreground">Manage Settings</span> permission.
        </div>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground">
        <MonitorSmartphone className="size-4 shrink-0" />
        These rules configure the desktop agent. They save to the server now; enforcement begins once
        the agent is reporting.
      </div>

      <RulesEditor rules={rules} canManage={canManage} showUnclassified />
    </div>
  );
}
