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
import { type FeatureKey } from "@/stores/features.store"
import { toggleFeature } from "@/lib/api"
import { Loader } from "@/components/shared/loader"
import { cn } from "@/lib/utils"
import { useEntitlements } from "../use-entitlements"

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

/** Server `enabled` map → the full per-card draft (a key the server omits reads as off). */
function draftFromServer(enabled: Record<string, boolean>): Record<FeatureKey, boolean> {
  return Object.fromEntries(
    FEATURE_LIST.map((f) => [f.key, enabled[f.key] === true]),
  ) as Record<FeatureKey, boolean>
}

export function FeaturesTab() {
  const { can } = usePermissions()
  const canManage = can("settings:manage")

  // Layer 2 (owner activation) is the real source of truth — `GET /v1/org/entitlements`.
  const { enabled, allowed, loading, error, reload } = useEntitlements()

  // Edit a local draft; commit to the server only on Save.
  const [draft, setDraft] = useState<Record<FeatureKey, boolean>>(() => draftFromServer({}))
  const [saving, setSaving] = useState(false)
  const server = draftFromServer(enabled)
  const dirty = JSON.stringify(draft) !== JSON.stringify(server)

  // Adopt server state when it (re)loads — but only when the draft is clean, so a save/reload
  // never clobbers edits in flight. `serverKey` changes only when the server value actually does.
  const serverKey = JSON.stringify(server)
  const lastSyncedRef = useRef<string>("")
  useEffect(() => {
    if (serverKey !== lastSyncedRef.current) {
      setDraft(draftFromServer(enabled))
      lastSyncedRef.current = serverKey
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey])

  async function handleSave() {
    if (!dirty || saving) return
    // PATCH only the keys that actually changed (one call each; the server enforces enabled ⊆ allowed).
    const changed = FEATURE_LIST.filter((f) => draft[f.key] !== server[f.key])
    setSaving(true)
    try {
      for (const f of changed) {
        await toggleFeature(f.key, draft[f.key])
      }
      toast.success("Feature settings saved")
    } catch {
      toast.error("Couldn't save every change. Reloading the current settings.")
    } finally {
      setSaving(false)
      reload() // re-sync to server truth regardless (partial success is possible)
    }
  }

  function handleReset() {
    setDraft(server)
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader label="Loading features…" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Features"
        description="Enable or disable features organization-wide. Changes take effect for all users once saved."
      />

      {error && (
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted px-5 py-3 text-sm text-muted-foreground">
          <TriangleAlert className="size-4 shrink-0" />
          {error}
        </div>
      )}

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
              const isOn = draft[f.key]
              // Layer 1: a key the plan doesn't include can't be switched on (the server rejects it).
              const planAllows = allowed.has(f.key)
              return (
                <div
                  key={f.key}
                  className={cn(
                    "flex items-center gap-4 border-b border-border px-6 py-3 transition-opacity last:border-b-0 lg:[&:nth-last-child(2):nth-child(odd)]:border-b-0",
                    !isOn && "opacity-60",
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
                    checked={isOn}
                    disabled={!canManage || (!planAllows && !isOn)}
                    aria-label={`${f.label} — ${isOn ? "enabled" : "disabled"}`}
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
