"use client"

import { useEffect, useRef, useState } from "react"
import {
  Activity,
  Bot,
  CalendarCheck,
  Camera,
  FileBarChart,
  FileText,
  FolderKanban,
  Lock,
  Plane,
  Sparkles,
  Timer,
  TriangleAlert,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { PageHeader } from "@/components/shared/page-header"
import { SettingsSaveBar } from "@/components/shared/settings-save-bar"
import { usePermissions } from "@/hooks/use-permissions"
import { useFeaturesStore, type FeatureKey } from "@/stores/features.store"
import { cn } from "@/lib/utils"

interface FeatureDef {
  key: FeatureKey
  icon: LucideIcon
  label: string
  description: string
  beta?: true
}

/**
 * One card per key in `FEATURE_KEYS` (`crates/wp-contracts/src/plans.rs`) — no more, no
 * fewer. A card for a key the server doesn't gate is a switch that does nothing; a key
 * without a card is a feature nobody can turn on.
 *
 * Deliberately absent, and why:
 *  - **Billing** — never plan-gated. Gating it would deadlock an org out of fixing the
 *    very plan that gates it.
 *  - **Approvals**, **Device agents** — core, not plan-gated.
 *  - **Communication** (Inbox) — DEFERRED; no backend key exists.
 *  - **Integrations** — DEFERRED, and removed from the backend catalog.
 *  - **Remote support** — CUT entirely.
 */
const FEATURE_LIST: FeatureDef[] = [
  {
    key: "time.tracking",
    icon: Timer,
    label: "Time tracking",
    description:
      "Let employees log hours against projects from the desktop agent's timer.",
  },
  {
    key: "attendance",
    icon: CalendarCheck,
    label: "Attendance",
    description:
      "Daily present/partial/absent status, computed nightly from recorded sessions.",
  },
  {
    key: "leave",
    icon: Plane,
    label: "Leave",
    description: "Leave types, balances, requests, and the approval queue.",
  },
  {
    key: "projects",
    icon: FolderKanban,
    label: "Projects & tasks",
    description: "Projects, tasks, assignments, and per-project roles.",
  },
  {
    key: "monitoring.activity",
    icon: Activity,
    label: "Activity monitoring",
    description:
      "Track active vs idle time, application usage, and input intensity.",
  },
  {
    key: "monitoring.screenshots",
    icon: Camera,
    label: "Screenshots",
    description:
      "Capture periodic screenshots to verify work and build an activity timeline.",
  },
  {
    key: "reports.basic",
    icon: FileBarChart,
    label: "Reports & analytics",
    description:
      "Workforce, time, and project reports with CSV export.",
  },
  {
    key: "insights.reports.ai_pdf",
    icon: FileText,
    label: "AI report export (PDF)",
    description:
      "Narrated PDF reports. Billed per generation — a sub-feature of Reports, not implied by it.",
  },
  {
    key: "ai.insights",
    icon: Sparkles,
    label: "AI insights",
    description:
      "AI-narrated productivity summaries over the day's activity.",
    beta: true,
  },
  {
    key: "ai.assistant",
    icon: Bot,
    label: "AI assistant",
    description:
      "Ask questions about your workspace. Session-only — nothing is stored.",
    beta: true,
  },
  {
    key: "anomalies",
    icon: TriangleAlert,
    label: "Anomaly detection",
    description:
      "Flags unusual patterns for human review. Statistical, not AI — and never auto-actions.",
  },
]

export function FeaturesTab() {
  const { can } = usePermissions()
  const canManage = can("settings:manage")
  const features = useFeaturesStore((s) => s.features)
  const setFeatures = useFeaturesStore((s) => s.setFeatures)

  // Edit a local draft; commit to the store only on Save.
  const [draft, setDraft] = useState<Record<FeatureKey, boolean>>(features)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(features)

  // Adopt the store value when it changes externally (persist hydration or a
  // save) — by reference, so local edits to `draft` are never clobbered.
  const lastSyncedRef = useRef(features)
  useEffect(() => {
    if (features !== lastSyncedRef.current) {
      setDraft(features)
      lastSyncedRef.current = features
    }
  }, [features])

  function handleSave() {
    if (!dirty || saving) return
    const next = draft
    setSaving(true)
    // Simulated persistence latency (Phase 1 is frontend-only).
    setTimeout(() => {
      setFeatures(next)
      setSaving(false)
      toast.success("Feature settings saved")
    }, 500)
  }

  function handleReset() {
    setDraft(features)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Features"
        description="Enable or disable features organization-wide. Changes take effect for all users once saved."
      />

      {!canManage && (
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted px-5 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          You can view these settings, but saving requires the{" "}
          <span className="font-medium text-foreground">Manage Settings</span>{" "}
          permission.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
          <CardDescription>
            Disabled features are hidden from all users. Re-enabling a feature restores access
            based on each role&apos;s existing permissions.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid lg:grid-cols-2 lg:divide-x">
            {FEATURE_LIST.map((f) => {
              const Icon = f.icon
              const enabled = draft[f.key]
              return (
                <div
                  key={f.key}
                  className={cn(
                    "flex items-center gap-4 border-b border-border px-6 py-3 transition-opacity last:border-b-0 lg:[&:nth-last-child(2):nth-child(odd)]:border-b-0",
                    !enabled && "opacity-60",
                  )}
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Icon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{f.label}</p>
                      {f.beta && (
                        <Badge variant="secondary" className="text-xs">
                          Beta
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{f.description}</p>
                  </div>
                  <Switch
                    checked={enabled}
                    disabled={!canManage}
                    aria-label={`${f.label} — ${enabled ? "enabled" : "disabled"}`}
                    onCheckedChange={(v) =>
                      setDraft((p) => ({ ...p, [f.key]: v }))
                    }
                  />
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {canManage && (
        <SettingsSaveBar
          dirty={dirty}
          saving={saving}
          onSave={handleSave}
          onReset={handleReset}
          saveLabel="Save changes"
        />
      )}
    </div>
  )
}
