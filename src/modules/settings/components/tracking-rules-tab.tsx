"use client";

/**
 * The org-wide app/URL tracking-rules page. Thin wrapper around the shared {@link RulesEditor}
 * (also used, department-scoped, by `dept-productivity-dialog.tsx`): this file supplies the page
 * chrome (header, permission banner, agent note) and the org-scoped rules state; the editor owns the
 * tabs, panels and save bar.
 *
 * **Gated on `monitoring:manage`, read and write.** `GET` and `PUT /v1/org/rules` both require
 * `MonitoringManage`; this page used to gate on `settings:manage`, so a role with monitoring rights
 * but not org-settings rights saw a read-only editor the server would have let them save, and the
 * reverse saw enabled controls over a 403 (QA audit 2026-10-08, WP-346).
 */
import { Lock, MonitorSmartphone } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { usePermissions } from "@/hooks/use-permissions";
import { useOrgRules } from "../use-org-rules";
import { RulesEditor } from "./org/rules-editor";

export function TrackingRulesTab() {
  const { can } = usePermissions();
  const canManage = can("monitoring:manage");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tracking rules"
        description="Classify apps, manage the not-tracked and restricted lists, and set productivity-score weights."
      />

      {canManage ? (
        <>
          {/* What the agents actually match on (WP-343): the process name, and — for the two site
              lists — the window title. Neither agent can read a browser's address. */}
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground">
            <MonitorSmartphone className="size-4 shrink-0" />
            The agents on your team&apos;s devices pick up saved rules within about a minute. They
            match each app by its process name; they can&apos;t read browser addresses yet.
          </div>

          <OrgRulesEditor />
        </>
      ) : (
        // Without the permission the server refuses the read as well, so there is no view-only mode
        // to offer — say what is needed instead of loading into a 403.
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted px-5 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          Viewing and changing tracking rules requires the{" "}
          <span className="font-medium text-foreground">Manage monitoring settings</span> permission.
        </div>
      )}
    </div>
  );
}

/** Mounted only with the permission, so the rules are never requested by someone the server refuses. */
function OrgRulesEditor() {
  const rules = useOrgRules();
  return <RulesEditor rules={rules} canManage showUnclassified />;
}
