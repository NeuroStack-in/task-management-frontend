"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
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
import { Switch } from "@/components/ui/switch"
import { PageHeader } from "@/components/shared/page-header"
import { usePermissions } from "@/hooks/use-permissions"
import { type FeatureKey } from "@/stores/features.store"
import { toggleFeature } from "@/lib/api"
import { useEntitlementsStore } from "@/stores/entitlements.store"
import { useAuthStore } from "@/stores/auth.store"
import { isOwnerOf, useTrackingMode } from "@/hooks/use-features"
import { featureForHref, isPathModeHidden } from "@/constants/features"
import { TRACKING_MODE_META } from "@/lib/tracking-mode"
import { Loader } from "@/components/shared/loader"
import { useCardGuard } from "../lib/card-guard"
import { CardSaveFooter } from "./save-footer"
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
}

const CONTROLS: ControlDef[] = [
  { icon: Timer, label: "Time tracking", description: "The desktop app's timer, hours logged against projects, and the timesheet pages.", features: ["time.tracking"], page: "/time-tracking" },
  { icon: CalendarCheck, label: "Attendance", description: "Daily present/partial/absent status, computed nightly from recorded sessions.", features: ["attendance"], page: "/attendance" },
  { icon: Plane, label: "Leave", description: "Leave types, balances, requests and the approval queue.", features: ["leave"], page: "/leave-requests" },
  { icon: FolderKanban, label: "Projects & tasks", description: "Projects, tasks, assignments and per-project roles.", features: ["projects"], page: "/projects" },
  { icon: Users, label: "Employees", description: "The people directory and employee profiles.", page: "/employees" },
  { icon: CheckCheck, label: "Approvals", description: "The approval queue.", page: "/approvals" },
  { icon: Wallet, label: "Payroll", description: "Payroll runs and payslips.", page: "/payroll" },
  { icon: LineChart, label: "Analytics", description: "The Analytics hub. Turning it off turns off every tab below it.", page: "/insights" },
  { icon: Activity, label: "Activity monitoring", description: "Active vs idle time, application usage and input intensity — and the Activity tab.", features: ["monitoring.activity"], page: "/insights/activity" },
  { icon: Camera, label: "Screenshots", description: "Periodic screenshot capture and the review grid. Off stops the agents capturing, not just the page. Sending screenshots for AI review follows AI insights.", features: ["monitoring.screenshots"], page: "/insights/screenshots" },
  { icon: MapPin, label: "Locations", description: "The device-location board.", page: "/insights/locations" },
  { icon: FileText, label: "Reports", description: "Workforce, time and project reports, CSV export, and the narrated AI PDF — which is billed per generation.", features: ["reports.basic", "insights.reports.ai_pdf"], page: "/insights/ai-reports" },
  // Truthful about the server's gates. `ai.insights` gates the person recaps, the attention list and
  // the department summary outright, and the Locations and Screenshots summaries fall back to the
  // figures without it (WP-281). It also gates the screenshot AI review: off, no screenshot is sent
  // to the vision model and nothing is billed, while capture carries on (AI audit 2026-10-22, AI-19;
  // owner decision 2026-10-28). The old line said the tab summaries "follow those switches instead",
  // which stopped being true with WP-281 and never said a word about the per-screenshot review.
  { icon: Sparkles, label: "AI insights", description: "AI review of every screenshot, and AI-written summaries: person recaps, the attention list and the summaries on the Analytics tabs. Off stops screenshots being sent for AI review and stops summaries being written and billed. Screenshots are still taken.", features: ["ai.insights"] },
  // It had no row, so nobody could turn it on after an upgrade, or off on an org created with it
  // (QA audit 2026-10-08, WP-332). It gates the scorer's anomaly flags and their reasons in the
  // attention list (`insights::scorer`, `attention_list`).
  { icon: TriangleAlert, label: "Anomaly detection", description: "Flags unusual activity patterns for a person to review in the attention list. Statistical, not AI — and it never acts on its own.", features: ["anomalies"] },
  { icon: Bot, label: "AI assistant", description: "Ask questions about your organization. Conversations aren't saved.", features: ["ai.assistant"], page: "page:assistant" },
  { icon: Plug, label: "Integrations", description: "Connect Slack so leave, joiner and payroll updates land in your channels.", features: ["integrations"] },
  { icon: Bell, label: "Notifications", description: "The notification center.", page: "/notifications" },
  { icon: HelpCircle, label: "Help center", description: "Help articles and support tickets.", page: "/help" },
]

const FEATURE_LIST: FeatureDef[] = [
  {
    key: "time.tracking",
    icon: Timer,
    label: "Time tracking",
    description:
      "Let employees log hours against projects from the desktop app's timer.",
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
      "AI review of every screenshot, and AI-written summaries of each person's work.",
  },
  {
    key: "ai.assistant",
    icon: Bot,
    label: "AI assistant",
    description:
      "Ask questions about your organization. Conversations aren't saved.",
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
      "Flags unusual patterns for a person to review. Statistical, not AI — and it never acts on its own.",
  },
]

/** Server `enabled` map → the full per-card draft (a key the server omits reads as off). */
function draftFromServer(enabled: Record<string, boolean>): Record<FeatureKey, boolean> {
  return Object.fromEntries(
    FEATURE_LIST.map((f) => [f.key, enabled[f.key] === true]),
  ) as Record<FeatureKey, boolean>
}

/** Server `pages` map → the per-row page draft (a page nobody hid has no key, and reads as on). */
function pageDraftFrom(pages: Record<string, boolean>): Record<string, boolean> {
  return Object.fromEntries(
    CONTROLS.filter((c) => c.page).map((c) => [c.page as string, pages[c.page as string] !== false]),
  )
}

export function FeaturesTab() {
  const { can } = usePermissions()
  // The API requires `entitlements:manage` (identity::toggle_feature). Gating the UI on
  // `settings:manage` meant a role holding one but not the other either saw toggles that 403, or
  // was denied a control it was entitled to.
  const canManage = can("entitlements:manage")

  // Layer 2 (owner activation) is the real source of truth — `GET /v1/org/entitlements`. Page
  // visibility and the "turned off by" provenance come from the same fresh read, not the shared
  // store: that is as old as the session, so a colleague's change since sign-in showed stale here,
  // and toggling the stale row sent nothing (QA audit 2026-10-08, WP-338).
  const {
    raw,
    enabled,
    allowed,
    pages: serverPages,
    disabledBy,
    pagesDisabledBy,
    loading,
    error,
    reload,
  } = useEntitlements()
  const isOwner = useAuthStore(isOwnerOf)
  const mode = useTrackingMode()
  // The shared copy the sidebar + route guard read. Every read this page makes — on open, and the
  // re-read after a save — is pushed into it, so the nav follows what the server holds right away.
  //
  // **From a full read, never this page's draft or the PATCH response.** Hydrating with a partial
  // object reset the session's tracking mode, dropped every "turned off by an owner" lock and un-hid
  // the children of a hidden parent (QA audit 2026-10-08, WP-027); the PATCH response is the stored
  // shape (attributed objects, no locks, no mode). And after a partly-failed save the nav must follow
  // what the server accepted, not what the user intended — which a re-read gives in both cases.
  const hydrateShared = useEntitlementsStore((s) => s.hydrate)
  useEffect(() => {
    if (raw) hydrateShared(raw)
  }, [raw, hydrateShared])

  // Edit a local draft; commit to the server only on Save. Absent page key ⇒ visible.
  const [draft, setDraft] = useState<Record<FeatureKey, boolean>>(() => draftFromServer({}))
  const [pageDraft, setPageDraft] = useState<Record<string, boolean>>(() => pageDraftFrom({}))
  const [saving, setSaving] = useState(false)
  /**
   * Whether the save confirmation is open. Toggles reach the agents and the model bill, so Save
   * names what changes first. Cancel doesn't ask: nothing has been applied, so there is nothing to
   * confirm — every organisation card cancels the same way (UX audit XC-11).
   */
  const [confirm, setConfirm] = useState<"save" | null>(null)
  const server = draftFromServer(enabled)
  const serverPageDraft = pageDraftFrom(serverPages)
  // Both halves. A row's single switch can change either or both, so comparing only the feature
  // draft meant a page-only edit left the save bar hidden and the change silently discarded.
  const pagesDirty = CONTROLS.some(
    (c) => c.page && pageDraft[c.page] !== serverPageDraft[c.page],
  )
  const dirty = JSON.stringify(draft) !== JSON.stringify(server) || pagesDirty
  // Leaving via the settings rail now asks before discarding this draft.
  useCardGuard(dirty)

  // Adopt server state when it (re)loads, both halves together. `serverKey` changes only when the
  // server value actually does, so a reload that changed nothing keeps edits in flight — unless a
  // failed save asked for a resync, which must show what is really in effect.
  const serverKey = JSON.stringify([server, serverPageDraft])
  const lastSyncedRef = useRef<string>("")
  const resyncRef = useRef(false)
  useEffect(() => {
    if (serverKey !== lastSyncedRef.current || resyncRef.current) {
      setDraft(draftFromServer(enabled))
      setPageDraft(pageDraftFrom(serverPages))
      lastSyncedRef.current = serverKey
      resyncRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey, raw])

  async function handleSave() {
    if (!dirty || saving) return
    // PATCH only the keys that actually changed (one call each; the server enforces enabled ⊆ allowed).
    const changed = FEATURE_LIST.filter((f) => draft[f.key] !== server[f.key])
    // Page toggles ride the same endpoint with `scope: "page"` — one route, one lock, one audit.
    const pagesChanged = CONTROLS.filter(
      (c) => c.page && pageDraft[c.page] !== serverPageDraft[c.page],
    )
    setSaving(true)
    try {
      for (const f of changed) {
        await toggleFeature(f.key, draft[f.key])
      }
      for (const c of pagesChanged) {
        await toggleFeature(c.page as string, pageDraft[c.page as string], "page")
      }
      toast.success("Feature settings saved")
    } catch {
      // Some PATCHes may have landed. Say so, and put BOTH halves of the draft back to what the
      // server now holds: re-seeding only the half that changed left a half-applied draft (WP-338).
      resyncRef.current = true
      toast.error("Some changes couldn't be saved. The switches now show what's in effect.")
    } finally {
      // Closed either way — on failure the dialog used to stay open and re-list a different set.
      setConfirm(null)
      setSaving(false)
      reload() // re-read; the effects above re-seed the draft and the shared store from it
    }
  }

  function handleReset() {
    setDraft(server)
    setPageDraft(serverPageDraft)
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
      const pageChanged = c.page && pageDraft[c.page] !== serverPageDraft[c.page]
      if (!featChanged && !pageChanged) continue
      const nowOn = (c.features ?? []).every((k) => draft[k]) && (c.page ? pageDraft[c.page] !== false : true)
      ;(nowOn ? on : off).push(c.label)
    }
    return { on, off }
  }

  /**
   * Why a row's page is hidden whatever its own switch says — the tracking mode, a hidden parent, or
   * the feature its route rides on. The gate applies these (`isPathModeHidden`, `useIsPageOn`'s
   * longest prefix, `ROUTE_FEATURES`); the rows used to read On regardless (QA audit 2026-10-08,
   * WP-527).
   */
  function hiddenBecause(c: ControlDef): string | null {
    if (!c.page || !c.page.startsWith("/")) return null
    if (c.page.startsWith("/insights/") && pageDraft["/insights"] === false) {
      return "Hidden while Analytics is off."
    }
    const rides = featureForHref(c.page)
    if (rides && !(c.features ?? []).includes(rides) && !(allowed.has(rides) && draft[rides])) {
      const owner = CONTROLS.find((o) => o.features?.includes(rides))
      return owner ? `Hidden while ${owner.label} is off.` : null
    }
    return null
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader label="Loading features…" />
      </div>
    )
  }

  // Nothing loaded: say so, with a way back. Rendering the rows here told an Enterprise owner that
  // every feature was "Not included in your plan" because of one failed read (WP-338).
  if (!raw) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Features"
          description="Turn features on or off for the whole organization. Once you save, changes apply to everyone except owners."
        />
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {error ?? "Couldn't load your organization's features."} Nothing has changed.
          </p>
          <Button variant="outline" size="sm" onClick={reload}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Features"
        description="Turn features on or off for the whole organization. Once you save, changes apply to everyone except owners."
      />

      {error && (
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted px-5 py-3 text-sm text-muted-foreground">
          <TriangleAlert className="size-4 shrink-0" />
          <span className="flex-1">{error} The switches show the last settings that loaded.</span>
          <Button variant="outline" size="sm" onClick={reload}>
            Retry
          </Button>
        </div>
      )}

      {/* Names the permission the switches actually need — the server label, so it can be found in
          Roles & permissions. It said "Manage Settings", which a role can hold without this (WP-521). */}
      {!canManage && (
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted px-5 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          You can view these settings, but saving requires the{" "}
          <span className="font-medium text-foreground">Manage feature toggles</span>{" "}
          permission.
        </div>
      )}

      {/* `overflow-visible` so the save footer can stay pinned to the bottom of the pane while the
          eighteen rows scroll past it (`overflow-hidden` would pin it to the card instead). */}
      <Card className="overflow-visible">
        <CardHeader>
          <CardTitle>Features</CardTitle>
          <CardDescription>
            Turn a feature on or off for the whole organization. Off hides its pages and stops
            the work behind it &mdash; Screenshots off stops device agents capturing, AI insights
            off stops screenshots being sent for AI review and summaries being written and billed.
            Owners always keep access, so nothing can be switched off for good.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {CONTROLS.map((c) => {
              const Icon = c.icon
              const declared = c.features ?? []
              // The row acts on the capabilities the plan includes. "Reports" owns both basic
              // reports and the AI PDF; requiring *every* key to be in the plan made the row read Off,
              // "Not included in your plan", and disabled on Free and Starter — which include basic
              // reports — and on Enterprise it read Off whenever only one half was on (WP-096).
              const feats = declared.filter((k) => allowed.has(k))
              // ON means the subject is on: every capability it owns within the plan, and its page.
              const featOn = feats.every((k) => draft[k])
              const pageOn = c.page ? pageDraft[c.page] !== false : true
              const isOn = featOn && pageOn

              // A row none of whose capabilities are in the plan can never be switched on (the server
              // rejects it). A row with no capabilities at all (a page-only row) is always allowed.
              const planAllows = declared.length === 0 || feats.length > 0
              // Locked if ANY half was switched off by a role this caller could not grant.
              const notes = [
                ...feats.map((k) => disabledBy[k]),
                c.page ? pagesDisabledBy[c.page] : undefined,
              ].filter(Boolean) as { by_owner: boolean; locked: boolean }[]
              const locked = notes.some((n) => n.locked)
              const note = notes[0]
              // The mode hides the route from everyone, owners included — so the owner note below must
              // not claim they still see it.
              const modeHidden = Boolean(c.page?.startsWith("/") && isPathModeHidden(c.page, mode))
              const hiddenNote = isOn && !modeHidden ? hiddenBecause(c) : null

              return (
                <div
                  key={c.label}
                  className={cn(
                    "flex items-center gap-4 px-6 py-3 transition-opacity",
                    (!isOn || modeHidden || hiddenNote) && "opacity-60",
                  )}
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Icon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{c.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{c.description}</p>
                    {/* Three states, worded apart because they need different reactions: outside the
                        plan is a billing conversation, locked is a colleague, and off-but-you're-an-
                        owner explains why you still see something the row says is off. */}
                    {!planAllows && !isOn ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Not included in your plan.
                      </p>
                    ) : modeHidden ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Hidden for everyone in {TRACKING_MODE_META[mode].label} tracking, whatever
                        this switch says. The tracking mode is set under{" "}
                        {/* A real link (UX audit SET-15) to the tab that holds the tracking-mode
                            card. This page needs `settings:view`, as Organization does. */}
                        <Link
                          href="/settings/organization#profile"
                          className="font-medium text-primary underline-offset-2 hover:underline"
                        >
                          Settings → Organization
                        </Link>
                        .
                      </p>
                    ) : hiddenNote ? (
                      <p className="mt-1 text-xs text-muted-foreground">{hiddenNote}</p>
                    ) : note ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Turned off by {note.by_owner ? "an owner" : "an admin"}
                        {locked
                          ? " — only they can turn it back on."
                          : isOwner
                            ? " — you still have access because you're an owner."
                            : "."}
                      </p>
                    ) : !isOn && isOwner ? (
                      /* The fourth state, and the one that was missing: in the plan, switched off,
                         but NOBODY turned it off — so there is no `disabled_by` note to hang the
                         explanation on. An upgrade lands here every time: the server widens
                         `allowed` and leaves `enabled` untouched, so a newly-bought feature is off
                         with no attribution.

                         Without this an owner sees a row reading "off" while the feature is plainly
                         working on their own screen (the owner exemption skips the toggle, never the
                         plan — `useIsFeatureOn` / `effective_for_owner`), and has no way to tell
                         whether their org can see it. */
                      <p className="mt-1 text-xs text-muted-foreground">
                        Off for your organization — you can still see it because you&apos;re an
                        owner.
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
        <CardSaveFooter
          dirty={canManage && dirty}
          saving={saving}
          onSave={() => setConfirm("save")}
          onCancel={handleReset}
          saveLabel="Review and save"
          hint="You'll see what turns on and off before anything is applied."
          sticky
          className="mx-6 px-0"
        />
      </Card>

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
                    This also stops device agents capturing — not just hiding the page.
                  </p>
                )}
                {/* AI-19: what the AI switch reaches, said where it is about to change. */}
                {off.includes("AI insights") && (
                  <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
                    Screenshots stop being sent for AI review, and no AI summaries are written.
                    Screenshots are still taken.
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
    </div>
  )
}
