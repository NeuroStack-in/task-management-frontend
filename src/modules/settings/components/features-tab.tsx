"use client"

import { useEffect, useRef, useState } from "react"
import {
  Plug,
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
import { useEntitlementsStore } from "@/stores/entitlements.store"
import { useAuthStore } from "@/stores/auth.store"
import { isOwnerOf } from "@/hooks/use-features"
import { Loader } from "@/components/shared/loader"
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard"
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
 *  - **Communication** — no backend key exists. The Inbox route was REMOVED (never built).
 *  - **Remote support** — CUT entirely.
 */
/**
 * The pages an org may hide. Layer 3 — visibility only, on top of plan and permission.
 *
 * **`/settings/*` is deliberately absent.** An org that could hide Settings → Features would have
 * no way to undo it; the server refuses those keys too, so this is defence in depth rather than
 * the only guard. The assistant is here despite not being a route — it is a surface people want to
 * turn off, so it carries a `page:` pseudo-key.
 */
const PAGE_LIST: { key: string; label: string; description: string }[] = [
  { key: "/dashboard", label: "Dashboard", description: "The at-a-glance home screen." },
  { key: "/time-tracking", label: "Time Tracking", description: "Weekly timesheets by employee and project." },
  { key: "/projects", label: "Projects", description: "Projects, tasks and per-project members." },
  { key: "/employees", label: "Employees", description: "The people directory and employee profiles." },
  { key: "/attendance", label: "Attendance", description: "Daily present/partial/absent roster." },
  { key: "/leave-requests", label: "Leave", description: "Leave balances and requests." },
  { key: "/approvals", label: "Approvals", description: "The approval queue." },
  { key: "/payroll", label: "Payroll", description: "Payroll runs and payslips." },
  { key: "/insights", label: "Analytics", description: "The whole Analytics hub, including its tabs." },
  { key: "/insights/activity", label: "— Activity tab", description: "Activity read-models inside Analytics." },
  { key: "/insights/screenshots", label: "— Screenshots tab", description: "The screenshot review grid." },
  { key: "/insights/locations", label: "— Locations tab", description: "The device-location board." },
  { key: "/insights/ai-reports", label: "— AI reports tab", description: "AI executive reads and exports." },
  { key: "/notifications", label: "Notifications", description: "The notification centre." },
  { key: "/help", label: "Help Center", description: "Help articles and support tickets." },
  { key: "page:assistant", label: "AI assistant launcher", description: "The floating chat button. Not a page — the launcher itself." },
]

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
    key: "integrations",
    icon: Plug,
    label: "Integrations",
    description:
      "Connect Slack so leave, joiner and payroll updates land in your channels.",
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
  // The API requires `entitlements:manage` (identity::toggle_feature). Gating the UI on
  // `settings:manage` meant a role holding one but not the other either saw toggles that 403, or
  // was denied a control it was entitled to.
  const canManage = can("entitlements:manage")

  // Layer 2 (owner activation) is the real source of truth — `GET /v1/org/entitlements`.
  const { enabled, allowed, loading, error, reload } = useEntitlements()
  // Provenance for the disabled features, straight from the shared store the API hydrates.
  const disabledBy = useEntitlementsStore((st) => st.disabledBy)
  const storePages = useEntitlementsStore((st) => st.pages)
  const pagesDisabledBy = useEntitlementsStore((st) => st.pagesDisabledBy)
  // Absent key means visible, so the draft seeds `true` for anything never toggled.
  const [pageDraft, setPageDraft] = useState<Record<string, boolean>>({})
  useEffect(() => {
    setPageDraft(
      Object.fromEntries(PAGE_LIST.map((p) => [p.key, storePages[p.key] !== false])),
    )
  }, [storePages])
  const isOwner = useAuthStore(isOwnerOf)
  // The shared copy the sidebar + route guard read. Re-hydrating it here is what makes a
  // saved toggle take effect immediately instead of only after a full page reload.
  const hydrateShared = useEntitlementsStore((s) => s.hydrate)

  // Edit a local draft; commit to the server only on Save.
  const [draft, setDraft] = useState<Record<FeatureKey, boolean>>(() => draftFromServer({}))
  const [saving, setSaving] = useState(false)
  const server = draftFromServer(enabled)
  const dirty = JSON.stringify(draft) !== JSON.stringify(server)
  // Leaving via the settings rail now asks before discarding this draft.
  useUnsavedGuard(dirty)

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
      // Page toggles ride the same endpoint with `scope: "page"` — one route, one lock, one audit.
      const pagesChanged = PAGE_LIST.filter(
        (p) => pageDraft[p.key] !== (storePages[p.key] !== false),
      )
      for (const p of pagesChanged) {
        await toggleFeature(p.key, pageDraft[p.key], "page")
      }
      toast.success("Feature settings saved")
      // Push the saved state into the shared store so the nav re-filters right away — `reload()`
      // only refreshes this page's copy, and without this the owner keeps seeing the section they
      // just switched off until a full reload.
      //
      // **In the success path, not `finally`.** It used to run either way, so a failed save showed
      // "Couldn't save every change" *and* removed the section from the sidebar anyway: the error
      // said one thing and the nav said the opposite, with only a hard refresh to resolve it. The
      // nav must follow what the server accepted, never what the user intended.
      hydrateShared({
        allowed: [...allowed],
        enabled: { ...enabled, ...draft },
        pages: { ...storePages, ...pageDraft },
      })
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
        description="Enable or disable features organization-wide. Changes take effect once saved for everyone except organization owners."
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
            Disabled features are hidden from everyone <strong>except organization owners</strong>,
            who keep access so a feature can always be switched back on. Re-enabling restores access
            based on each role&apos;s existing permissions &mdash; and you can only re-enable
            something switched off by a role you could grant.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid lg:grid-cols-2 lg:divide-x">
            {FEATURE_LIST.map((f) => {
              const Icon = f.icon
              const isOn = draft[f.key]
              // Layer 1: a key the plan doesn't include can't be switched on (the server rejects it).
              const planAllows = allowed.has(f.key)
              // Layer 2: who turned it off, and whether THIS caller may undo it. Computed server-side
              // per request — an owner and an admin get different answers for the same feature.
              const off = disabledBy[f.key]
              const locked = Boolean(off?.locked)
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
                    {/* Three distinct states, deliberately worded apart: outside the plan is a
                        billing conversation, locked is a colleague, and off-but-you're-an-owner
                        explains why you can still open something the page says is off. */}
                    {!planAllows && !isOn ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Not included in your plan.
                      </p>
                    ) : off ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Turned off by {off.by_owner ? "an owner" : "an admin"}
                        {locked
                          ? " — only they can turn it back on."
                          : isOwner
                            ? " — you still have access because you're an owner."
                            : "."}
                      </p>
                    ) : null}
                  </div>
                  <Switch
                    checked={isOn}
                    disabled={!canManage || (!planAllows && !isOn) || locked}
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

      {/* Layer 3 — visibility. Separate card on purpose: these are NOT plan features, they cost
          nothing, and mixing them into the list above would imply they affect billing. */}
      <Card>
        <CardHeader>
          <CardTitle>Pages</CardTitle>
          <CardDescription>
            Hide individual pages and tabs from everyone except organization owners. This is
            visibility only &mdash; it doesn&apos;t change your plan, and hiding a page never
            affects what you&apos;re billed. Settings pages can&apos;t be hidden, so there is always
            a way back.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid lg:grid-cols-2 lg:divide-x">
            {PAGE_LIST.map((p) => {
              const isOn = pageDraft[p.key] !== false
              const off = pagesDisabledBy[p.key]
              const locked = Boolean(off?.locked)
              return (
                <div
                  key={p.key}
                  className={cn(
                    "flex items-center gap-4 border-b border-border px-6 py-3 transition-opacity last:border-b-0 lg:[&:nth-last-child(2):nth-child(odd)]:border-b-0",
                    !isOn && "opacity-60",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{p.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{p.description}</p>
                    {off ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Hidden by {off.by_owner ? "an owner" : "an admin"}
                        {locked
                          ? " — only they can show it again."
                          : isOwner
                            ? " — you still see it because you're an owner."
                            : "."}
                      </p>
                    ) : null}
                  </div>
                  <Switch
                    checked={isOn}
                    disabled={!canManage || locked}
                    aria-label={`${p.label} — ${isOn ? "visible" : "hidden"}`}
                    onCheckedChange={(v) =>
                      setPageDraft((prev) => ({ ...prev, [p.key]: v }))
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
