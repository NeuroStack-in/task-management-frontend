"use client"

import { useEffect, useRef, useState } from "react"
import {
  Activity,
  Bot,
  Camera,
  CheckCheck,
  CreditCard,
  FileBarChart,
  Headset,
  Lock,
  Mail,
  MonitorSmartphone,
  Plug,
  Timer,
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

const FEATURE_LIST: FeatureDef[] = [
  {
    key: "time-tracking",
    icon: Timer,
    label: "Time Tracking",
    description:
      "Let employees log hours, start/stop timers, and track time against projects.",
  },
  {
    key: "activity-monitoring",
    icon: Activity,
    label: "Activity Monitoring",
    description:
      "Track active vs idle time, application usage, and keyboard/mouse intensity.",
  },
  {
    key: "screenshots",
    icon: Camera,
    label: "Screenshots",
    description:
      "Capture periodic screenshots to verify work and generate an activity timeline.",
  },
  {
    key: "ai",
    icon: Bot,
    label: "AI Insights",
    description:
      "AI-generated productivity summaries, anomaly detection, and smart recommendations.",
    beta: true,
  },
  {
    key: "billing",
    icon: CreditCard,
    label: "Billing & Subscriptions",
    description:
      "Manage your WorkPulse plan, payment methods, and billing history.",
  },
  {
    key: "reports",
    icon: FileBarChart,
    label: "Reports & Analytics",
    description:
      "Generate workforce, time, and project reports with CSV/PDF export.",
  },
  {
    key: "integrations",
    icon: Plug,
    label: "Integrations",
    description: "Connect Slack, Jira, GitHub, Teams, and other third-party tools.",
  },
  {
    key: "communication",
    icon: Mail,
    label: "Communication",
    description: "Internal inbox and team messaging within WorkPulse.",
  },
  {
    key: "approvals",
    icon: CheckCheck,
    label: "Approvals",
    description:
      "Time-off requests, timesheet approvals, and custom approval workflows.",
  },
  {
    key: "remote-support",
    icon: Headset,
    label: "Remote Support",
    description:
      "Approval-gated remote sessions for IT to assist employees securely.",
    beta: true,
  },
  {
    key: "desktop-agents",
    icon: MonitorSmartphone,
    label: "Desktop Agents",
    description:
      "Install lightweight agents on employee machines for real-time monitoring.",
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
        title="Feature Management"
        description="Enable or disable modules organization-wide. Changes take effect for all users once saved."
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
          <CardTitle>Modules</CardTitle>
          <CardDescription>
            Disabled modules are hidden from all users. Re-enabling a module restores access
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
