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
  Bell,
  CheckCheck,
  HelpCircle,
  LayoutDashboard,
  LineChart,
  MapPin,
  Users,
  Wallet,
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
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

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
/**
 * **One row, one switch, one subject.**
 *
 * A row turns its whole subject on or off: the capability AND the page it lives on. Underneath they
 * are still two different things — `features` reaches the desktop agents and the API (switching
 * Screenshots off stops agents capturing; switching AI off stops summaries being generated and
 * billed), while `page` is only what people see — but nobody wants to reason about that pair, so
 * one switch drives both.
 *
 * That is also why sub-features are folded in rather than listed: an export lives inside a tab, so
 * hiding the tab is the honest control. AI reports carries both `reports.basic` and the per-
 * generation `insights.reports.ai_pdf` for exactly that reason.
 *
 * A row may have only one half — Payroll is a page with no capability behind it, AI insights is a
 * capability that surfaces on cards rather than a page of its own.
 *
 * `/settings/*` is deliberately absent: an org that could hide Settings could not undo it, and the
 * server refuses those keys too.
 */
interface ControlDef {
  icon: LucideIcon
  label: string
  description: string
  /** Plan-gated capability keys. More than one when a subject owns a sub-feature (e.g. exports). */
  features?: FeatureKey[]
  /** Page/tab href, or a `page:` pseudo-key for a surface that is not a route. */
  page?: string
  beta?: true
}

const CONTROLS: ControlDef[] = [
  { icon: LayoutDashboard, label: "Dashboard", description: "The at-a-glance home screen.", page: "/dashboard" },
  { icon: Timer, label: "Time tracking", description: "The desktop agent's timer, hours logged against projects, and the timesheet pages.", features: ["time.tracking"], page: "/time-tracking" },
  { icon: CalendarCheck, label: "Attendance", description: "Daily present/partial/absent status, computed nightly from recorded sessions.", features: ["attendance"], page: "/attendance" },
  { icon: Plane, label: "Leave", description: "Leave types, balances, requests and the approval queue.", features: ["leave"], page: "/leave-requests" },
  { icon: FolderKanban, label: "Projects & tasks", description: "Projects, tasks, assignments and per-project roles.", features: ["projects"], page: "/projects" },
  { icon: Users, label: "Employees", description: "The people directory and employee profiles.", page: "/employees" },
  { icon: CheckCheck, label: "Approvals", description: "The approval queue.", page: "/approvals" },
  { icon: Wallet, label: "Payroll", description: "Payroll runs and payslips.", page: "/payroll" },
  { icon: LineChart, label: "Analytics", description: "The Analytics hub. Turning it off turns off every tab below it.", page: "/insights" },
  { icon: Activity, label: "Activity monitoring", description: "Active vs idle time, application usage and input intensity — and the Activity tab.", features: ["monitoring.activity"], page: "/insights/activity" },
  { icon: Camera, label: "Screenshots", description: "Periodic screenshot capture and the review grid. Off stops the agents capturing, not just the page.", features: ["monitoring.screenshots"], page: "/insights/screenshots" },
  { icon: MapPin, label: "Locations", description: "The device-location board.", page: "/insights/locations" },
  { icon: FileText, label: "Reports", description: "Workforce, time and project reports, CSV export, and the narrated AI PDF — which is billed per generation.", features: ["reports.basic", "insights.reports.ai_pdf"], page: "/insights/ai-reports" },
  { icon: Sparkles, label: "AI insights", description: "AI-narrated productivity summaries over the day's activity. Off stops them being generated and billed.", features: ["ai.insights"], beta: true },
  { icon: Bot, label: "AI assistant", description: "Ask questions about your workspace. Session-only — nothing is stored.", features: ["ai.assistant"], page: "page:assistant", beta: true },
  { icon: Plug, label: "Integrations", description: "Connect Slack so leave, joiner and payroll updates land in your channels.", features: ["integrations"] },
  { icon: Bell, label: "Notifications", description: "The notification centre.", page: "/notifications" },
  { icon: HelpCircle, label: "Help Center", description: "Help articles and support tickets.", page: "/help" },
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
      Object.fromEntries(
        CONTROLS.filter((c) => c.page).map((c) => [
          c.page as string,
          storePages[c.page as string] !== false,
        ]),
      ),
    )
  }, [storePages])
  const isOwner = useAuthStore(isOwnerOf)
  // The shared copy the sidebar + route guard read. Re-hydrating it here is what makes a
  // saved toggle take effect immediately instead of only after a full page reload.
  const hydrateShared = useEntitlementsStore((s) => s.hydrate)

  // Edit a local draft; commit to the server only on Save.
  const [draft, setDraft] = useState<Record<FeatureKey, boolean>>(() => draftFromServer({}))
  const [saving, setSaving] = useState(false)
  /** Which confirmation is open, if any. Toggles reach the agents, so neither action is silent. */
  const [confirm, setConfirm] = useState<"save" | "reset" | null>(null)
  const server = draftFromServer(enabled)
  // Both halves. A row's single switch can change either or both, so comparing only the feature
  // draft meant a page-only edit left the save bar hidden and the change silently discarded.
  const pagesDirty = CONTROLS.some(
    (c) => c.page && pageDraft[c.page] !== (storePages[c.page] !== false),
  )
  const dirty = JSON.stringify(draft) !== JSON.stringify(server) || pagesDirty
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
      const pagesChanged = CONTROLS.filter(
        (c) =>
          c.page && pageDraft[c.page] !== (storePages[c.page] !== false),
      )
      for (const c of pagesChanged) {
        await toggleFeature(c.page as string, pageDraft[c.page as string], "page")
      }
      setConfirm(null)
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
    setPageDraft(
      Object.fromEntries(
        CONTROLS.filter((c) => c.page).map((c) => [
          c.page as string,
          storePages[c.page as string] !== false,
        ]),
      ),
    )
    setConfirm(null)
  }

  /**
   * What this save would actually change, in words, for the confirmation.
   *
   * Worth spelling out rather than asking "are you sure?": these switches reach further than the
   * page you are on — turning Screenshots off stops the desktop agents capturing, and turning AI
   * off stops summaries being generated. A list of names is the difference between confirming and
   * guessing.
   */
  function pendingChanges(): { on: string[]; off: string[] } {
    const on: string[] = []
    const off: string[] = []
    for (const c of CONTROLS) {
      const featChanged = (c.features ?? []).some((k) => draft[k] !== server[k])
      const pageChanged =
        c.page && pageDraft[c.page] !== (storePages[c.page] !== false)
      if (!featChanged && !pageChanged) continue
      const nowOn = (c.features ?? []).every((k) => draft[k]) && (c.page ? pageDraft[c.page] !== false : true)
      ;(nowOn ? on : off).push(c.label)
    }
    return { on, off }
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
            Two switches per row, because they answer different questions.{" "}
            <strong>On</strong> is what WorkPulse <em>does</em> &mdash; it reaches the desktop agents
            and the API, so switching Screenshots off stops agents capturing and switching AI off
            stops summaries being generated and billed. <strong>Visible</strong> is only what people{" "}
            <em>see</em>; it never changes capture or your bill. Both are hidden from everyone except
            organization owners, who keep access so anything can be switched back on &mdash; and you
            can only re-enable something switched off by a role you could grant.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {CONTROLS.map((c) => {
              const Icon = c.icon
              const feats = c.features ?? []
              // ON means the whole subject is on: every capability it owns, and its page.
              const featOn = feats.every((k) => draft[k])
              const pageOn = c.page ? pageDraft[c.page] !== false : true
              const isOn = featOn && pageOn

              // A capability outside the plan can never be switched on (the server rejects it).
              const planAllows = feats.every((k) => allowed.has(k))
              // Locked if ANY half was switched off by a role this caller could not grant.
              const notes = [
                ...feats.map((k) => disabledBy[k]),
                c.page ? pagesDisabledBy[c.page] : undefined,
              ].filter(Boolean) as { by_owner: boolean; locked: boolean }[]
              const locked = notes.some((n) => n.locked)
              const note = notes[0]

              return (
                <div
                  key={c.label}
                  className={cn(
                    "flex items-center gap-4 px-6 py-3 transition-opacity",
                    !isOn && "opacity-60",
                  )}
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Icon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{c.label}</p>
                      {c.beta && (
                        <Badge variant="secondary" className="text-xs">
                          Beta
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{c.description}</p>
                    {/* Three states, worded apart because they need different reactions: outside the
                        plan is a billing conversation, locked is a colleague, and off-but-you're-an-
                        owner explains why you still see something the row says is off. */}
                    {!planAllows && !isOn ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Not included in your plan.
                      </p>
                    ) : note ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Turned off by {note.by_owner ? "an owner" : "an admin"}
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
                    aria-label={`${c.label} — ${isOn ? "on" : "off"}`}
                    onCheckedChange={(v) => {
                      // One switch, both halves — the two layers stay separate underneath, but a
                      // reader should never have to hold that distinction to use this page.
                      if (feats.length) {
                        setDraft((prev) => ({
                          ...prev,
                          ...Object.fromEntries(feats.map((k) => [k, v])),
                        }))
                      }
                      if (c.page) {
                        setPageDraft((prev) => ({ ...prev, [c.page as string]: v }))
                      }
                    }}
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
          onSave={() => setConfirm("save")}
          onReset={() => setConfirm("reset")}
          saveLabel="Save changes"
        />
      )}

      {/* Confirmation, not a courtesy. These switches reach the desktop agents and the model bill,
          so the dialog NAMES what is about to change rather than asking "are you sure?" — the
          difference between confirming and guessing. */}
      <Dialog open={confirm === "save"} onOpenChange={(v) => !v && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Apply these changes?</DialogTitle>
            <DialogDescription>
              Everyone except organization owners is affected as soon as you save.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const { on, off } = pendingChanges()
            return (
              <div className="space-y-3 text-sm">
                {off.length > 0 && (
                  <div>
                    <p className="font-medium text-destructive">Turning off</p>
                    <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                      {off.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {on.length > 0 && (
                  <div>
                    <p className="font-medium">Turning on</p>
                    <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                      {on.map((l) => (
                        <li key={l}>{l}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {/* Named explicitly: these two do more than hide a page, and someone switching them
                    off to tidy the sidebar should find that out here, not from an employee. */}
                {off.some((l) => l === "Screenshots" || l === "Activity monitoring") && (
                  <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
                    This also stops the desktop agents capturing — not just hiding the page.
                  </p>
                )}
              </div>
            )
          })()}
          <DialogFooter showCloseButton>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Apply changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirm === "reset"} onOpenChange={(v) => !v && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Discard your changes?</DialogTitle>
            <DialogDescription>
              Every switch goes back to what is currently saved. Nothing has been applied yet, so
              nobody has been affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter showCloseButton>
            <Button variant="destructive" onClick={handleReset}>
              Discard changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
