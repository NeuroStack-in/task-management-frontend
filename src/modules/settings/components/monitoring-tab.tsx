"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Controller, useForm } from "react-hook-form"
import { Lock } from "lucide-react"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { NumberStepper as NumericStepper } from "@/components/ui/number-stepper"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PageHeader } from "@/components/shared/page-header"
import { Loader } from "@/components/shared/loader"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { usePermissions } from "@/hooks/use-permissions"
import { useTrackingMode } from "@/hooks/use-features"
import { effectiveFromState, useEntitlementsStore } from "@/stores/entitlements.store"
import { ApiError } from "@/lib/api"
import {
  getTrackingPolicy,
  updateTrackingPolicy,
  type TrackingCadence,
} from "@/modules/agents/services/fleet.service"
import { useCardGuard } from "../lib/card-guard"
import { cn } from "@/lib/utils"
import {
  captureLock,
  capturing,
  retentionLabel,
  retentionOptions,
  type CaptureLock,
} from "../lib/monitoring-capture"
import { ScreenshotExclusionsCard } from "./screenshot-exclusions-card"
import { CardSaveFooter } from "./save-footer"

/**
 * The cadence *choice* the dropdown offers. The four presets map straight to the wire strings;
 * `"custom"` pairs with `customMinutes` and is serialized to `{ custom: n }` on save.
 */
type CadenceChoice = "off" | "min3" | "min5" | "min10" | "custom"

const CUSTOM_MIN = 1
const CUSTOM_MAX = 60
const CUSTOM_DEFAULT = 7

/**
 * The form fields (agent `TrackingConfig`, sans `version`), with cadence split into choice + minutes.
 *
 * `blur_level` and `silent` have no control any more but stay in the shape, because the PUT sends
 * the whole config. Every save **pins** them to `0` / `false` (see `onSave`): they used to be
 * round-tripped from whatever was stored, so an org that had silent mode or blur on before the
 * controls were removed kept it for good, with nothing on screen to say so (QA audit 2026-10-08,
 * WP-331).
 */
type PolicyForm = {
  cadence: CadenceChoice
  /** Minutes for the `"custom"` choice; ignored otherwise. */
  customMinutes: number
  /** No UI. Screenshots are meant to be legible; saved as `0`. */
  blur_level: number
  retention_days: number
  /**
   * No UI, and saved as `false`. The agent's capture indicator is the only notice an employee gets
   * that monitoring is running, so switching it off is not an admin-facing setting.
   */
  silent: boolean
  auto_update: boolean
  /** Managed agent: minutes of no input before the logon session auto-ends. */
  idleMinutes: number
  /** Desktop app: each employee's daily privacy-pause allowance, in minutes (0 = no pausing). */
  pauseMinutes: number
}

/** The agent's shipped default, in minutes — what an org that never set one keeps. */
const IDLE_DEFAULT_MINUTES = 45
/** Server range is 60 … 28800 seconds; expressed here in whole minutes. */
const IDLE_MIN_MINUTES = 1
const IDLE_MAX_MINUTES = 480
/** The privacy-pause allowance an org gets until an admin changes it (owner request 2026-10-15). */
const PAUSE_DEFAULT_MINUTES = 15
/** Server range is 0 … 14400 seconds; 0 turns the privacy pause off. */
const PAUSE_MAX_MINUTES = 240

const EMPTY: PolicyForm = {
  cadence: "off",
  customMinutes: CUSTOM_DEFAULT,
  blur_level: 0,
  retention_days: 30,
  silent: false,
  auto_update: true,
  idleMinutes: IDLE_DEFAULT_MINUTES,
  pauseMinutes: PAUSE_DEFAULT_MINUTES,
}

const CADENCE_OPTIONS: { value: CadenceChoice; label: string }[] = [
  { value: "off", label: "Off — no screenshots" },
  { value: "min3", label: "Every 3 minutes" },
  { value: "min5", label: "Every 5 minutes" },
  { value: "min10", label: "Every 10 minutes" },
  { value: "custom", label: "Custom…" },
]

/**
 * Wire seconds → whole minutes for the stepper. An absent value means the server predates the
 * field, so the agent is still running its built-in 45 minutes — show that, not 0.
 */
function secsToMinutes(secs: number | undefined): number {
  if (secs == null) return IDLE_DEFAULT_MINUTES
  return Math.min(IDLE_MAX_MINUTES, Math.max(IDLE_MIN_MINUTES, Math.round(secs / 60)))
}

/** Wire seconds → whole minutes; absent (an older server) means the 15-minute default. */
function pauseSecsToMinutes(secs: number | undefined): number {
  if (secs == null) return PAUSE_DEFAULT_MINUTES
  return Math.min(PAUSE_MAX_MINUTES, Math.max(0, Math.round(secs / 60)))
}

/** Wire cadence → form fields. A `{ custom: n }` object becomes the `"custom"` choice + its minutes. */
function cadenceToForm(c: TrackingCadence): { cadence: CadenceChoice; customMinutes: number } {
  return typeof c === "object"
    ? { cadence: "custom", customMinutes: c.custom }
    : { cadence: c, customMinutes: CUSTOM_DEFAULT }
}

/** Form fields → wire cadence. `"custom"` becomes `{ custom: <clamped minutes> }`. */
function formToCadence(cadence: CadenceChoice, customMinutes: number): TrackingCadence {
  if (cadence !== "custom") return cadence
  const m = Math.round(customMinutes)
  return { custom: Math.min(CUSTOM_MAX, Math.max(CUSTOM_MIN, Number.isFinite(m) ? m : CUSTOM_DEFAULT)) }
}

/**
 * Which form fields each card owns (UX audit 2026-10-16, XC-11 / SET-14).
 *
 * The four cards used to share one floating "Save changes", so changing retention and the update
 * switch went out as one save nobody had asked for, and "Reset" threw away edits in cards off screen.
 * Each card now saves its own fields; the PUT still carries the whole policy, so the others go back
 * exactly as stored. `blur_level`/`silent` ride the capture card, whose notice explains them.
 */
type CardKey = "capture" | "pause" | "machine" | "updates"
const CARD_FIELDS: Record<CardKey, (keyof PolicyForm)[]> = {
  capture: ["cadence", "customMinutes", "retention_days", "blur_level", "silent"],
  pause: ["pauseMinutes"],
  machine: ["idleMinutes"],
  updates: ["auto_update"],
}
const CARD_KEYS = Object.keys(CARD_FIELDS) as CardKey[]
const CARD_SAVED: Record<CardKey, string> = {
  capture: "Screenshot capture saved",
  pause: "Privacy pause saved",
  machine: "Machine tracking saved",
  updates: "Agent updates saved",
}

/** A policy response → the form's fields. */
function formFromPolicy(t: {
  cadence: TrackingCadence
  blur_level: number
  retention_days: number
  silent: boolean
  auto_update: boolean
  idle_end_secs?: number
  pause_allowance_secs?: number
}): PolicyForm {
  return {
    ...cadenceToForm(t.cadence),
    blur_level: t.blur_level,
    retention_days: t.retention_days,
    silent: t.silent,
    auto_update: t.auto_update,
    idleMinutes: secsToMinutes(t.idle_end_secs),
    pauseMinutes: pauseSecsToMinutes(t.pause_allowance_secs),
  }
}

function SettingRow({
  label,
  description,
  disabled,
  children,
}: {
  label: string
  description?: string
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        // Stacked below `sm`: side by side, a 224px control left the label a ~75px column on a
        // phone, one word per line.
        "flex flex-col gap-3 py-3 [&+&]:border-t border-border sm:flex-row sm:items-center sm:justify-between sm:gap-6",
        disabled && "opacity-60",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {children}
    </div>
  )
}

export function MonitoringTab() {
  const { can } = usePermissions()
  // Both writes on this page (`PUT /v1/fleet/update-policy`, `PUT /v1/fleet/capture-gate`) require
  // `MonitoringManage` server-side, not org-settings. Gating on `settings:manage` happened to work
  // because Owner and Admin hold both, but it read the wrong bit: a role with one and not the other
  // saw controls that 403, or read-only controls it was entitled to use.
  const canManage = can("monitoring:manage")
  // The idle window only applies to the managed Windows service, so the card is hidden for
  // `project` orgs rather than shown as a setting that changes nothing.
  const trackingMode = useTrackingMode()
  // Features → Screenshots decides the interval control (UX audit 2026-10-16, SET-03 — see
  // `captureLock`): the agents obey it, and `fleet::update_policy` checks it before accepting a
  // changed interval. The page used to read only Activity monitoring, so with Screenshots off it
  // offered an editable "Every 5 minutes" while nothing was captured.
  //
  // While it locks the interval, a save sends the stored interval back unchanged, which the server
  // accepts (`req.cadence == stored_cadence`), so retention and the rest still save. It used to send
  // Off (WP-330), which quietly threw away the interval an org would get back with the switch.
  const screenshotsOn = useEntitlementsStore((s) =>
    effectiveFromState(s, "monitoring.screenshots"),
  )
  const screenshotsInPlan = useEntitlementsStore(
    (s) => !s.loaded || s.allowed.includes("monitoring.screenshots"),
  )
  const lock = captureLock({ screenshotsOn, screenshotsInPlan })

  const {
    control,
    reset,
    setValue,
    getValues,
    getFieldState,
    formState: { isDirty, dirtyFields, defaultValues },
  } = useForm<PolicyForm>({ defaultValues: EMPTY })
  /** Whether one card's fields differ from what is saved. */
  const cardDirty = (k: CardKey) => CARD_FIELDS[k].some((f) => Boolean(dirtyFields[f]))
  /**
   * A shorter retention is confirmed before it is saved: the next hourly sweep permanently deletes
   * every screenshot older than the new period — 90 → 1 day saved silently (UX audit 2026-10-16,
   * SET-04 / XC-07). A longer one needs no question.
   */
  const [retentionCut, setRetentionCut] = useState<{ from: number; to: number } | null>(null)

  // Stored values the page no longer offers (silent capture, blur). Every save pins them back, and
  // the form starts dirty so a manager can do that without changing anything else.
  const [legacyOverride, setLegacyOverride] = useState<{ silent: boolean; blur: boolean } | null>(
    null,
  )
  useEffect(() => {
    if (!legacyOverride || !canManage) return
    setValue("silent", false, { shouldDirty: true })
    setValue("blur_level", 0, { shouldDirty: true })
  }, [legacyOverride, canManage, setValue])

  // Leaving via the settings rail now asks before discarding these edits.
  useCardGuard(isDirty)

  // The optimistic-concurrency token from `tracking.version`. Retained across edits and sent back as
  // `expected_version`; bumped from each successful save's response.
  const [version, setVersion] = useState(0)
  // The interval as stored — what a save sends while the control is locked (see `lock` above).
  const [storedCadence, setStoredCadence] = useState<TrackingCadence>("off")
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  /** The card whose Save is in flight — one at a time, since each carries the version lock. */
  const [savingCard, setSavingCard] = useState<CardKey | null>(null)
  const saving = savingCard !== null
  // Whether the server knows the privacy-pause allowance. A server older than the setting leaves
  // `pause_allowance_secs` out of the policy and would silently drop it on save, so the card stays
  // hidden until the field comes back — it appears by itself once the backend carrying it is live.
  const [pauseSupported, setPauseSupported] = useState(false)

  // Reset both the form values AND the RHF baseline, so `isDirty` reads false right after a load/save.
  const seed = useCallback(
    (p: PolicyForm, v: number) => {
      setVersion(v)
      reset(p)
    },
    [reset],
  )

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const cfg = await getTrackingPolicy()
      seed(formFromPolicy(cfg.tracking), cfg.tracking.version)
      setStoredCadence(cfg.tracking.cadence)
      setPauseSupported(cfg.tracking.pause_allowance_secs !== undefined)
      const silent = cfg.tracking.silent === true
      const blur = cfg.tracking.blur_level > 0
      setLegacyOverride(silent || blur ? { silent, blur } : null)
    } catch (e) {
      setLoadError(loadMessage(e))
    } finally {
      setLoading(false)
    }
  }, [seed])

  useEffect(() => {
    void load()
  }, [load])

  /**
   * Save one card: its own fields from the form, every other field exactly as stored (the PUT takes
   * the whole policy). Edits waiting in the other cards survive the save — they are put back on top
   * of the fresh values — so saving one card never discards another.
   */
  const saveCard = async (k: CardKey) => {
    if (saving) return
    const stored = (defaultValues ?? EMPTY) as PolicyForm
    const values = getValues()
    const pick = <F extends keyof PolicyForm>(f: F): PolicyForm[F] =>
      CARD_FIELDS[k].includes(f) ? values[f] : stored[f]
    // Only the capture card sends a changed interval — and not while it is locked (see `lock`).
    const cadence =
      k === "capture" && !lock ? formToCadence(values.cadence, values.customMinutes) : storedCadence
    setSavingCard(k)
    try {
      const next = await updateTrackingPolicy({
        cadence,
        // Pinned, never round-tripped — see `PolicyForm` (WP-331).
        blur_level: 0,
        // Whole days: the server field is a `u16` and rejects a fraction (WP-361).
        retention_days: Math.round(pick("retention_days")),
        silent: false,
        auto_update: pick("auto_update"),
        idle_end_secs: Math.round(pick("idleMinutes")) * 60,
        ...(pauseSupported
          ? { pause_allowance_secs: Math.round(pick("pauseMinutes")) * 60 }
          : {}),
        expected_version: version,
      })
      // The other cards' drafts, read now so an edit made while this was saving is kept too.
      const kept: [keyof PolicyForm, PolicyForm[keyof PolicyForm]][] = []
      for (const c of CARD_KEYS) {
        if (c === k) continue
        for (const f of CARD_FIELDS[c]) {
          if (getFieldState(f).isDirty) kept.push([f, getValues(f)])
        }
      }
      setLegacyOverride(null)
      setStoredCadence(next.cadence)
      setPauseSupported(next.pause_allowance_secs !== undefined)
      seed(formFromPolicy(next), next.version)
      for (const [f, v] of kept) setValue(f, v as never, { shouldDirty: true })
      toast.success(CARD_SAVED[k])
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.error("Settings changed elsewhere — reload to get the latest.", {
          action: { label: "Reload", onClick: () => void load() },
        })
      } else if (e instanceof ApiError && e.status === 403) {
        // The server refuses capture for the entitlement only when the cadence isn't Off; with Off
        // a 403 is the permission. Say which, instead of blaming the plan for both.
        toast.error(
          cadence !== "off"
            ? "Screenshot capture needs Activity monitoring, which isn't available to this organization right now. Set capture to Off to save your other changes."
            : "You don't have permission to change monitoring settings.",
        )
      } else {
        toast.error(
          e instanceof ApiError
            ? e.message
            : "Couldn't save monitoring settings. Check your connection and retry.",
        )
      }
    } finally {
      setSavingCard(null)
    }
  }

  /** Put one card back to what is saved. Nothing was applied, so nothing needs confirming. */
  const cancelCard = (k: CardKey) => {
    const stored = (defaultValues ?? EMPTY) as PolicyForm
    for (const f of CARD_FIELDS[k]) {
      // The pinned legacy values stay pinned: they are what the notice above says a save fixes.
      if (legacyOverride && (f === "silent" || f === "blur_level")) continue
      setValue(f, stored[f] as never, { shouldDirty: true })
    }
  }

  /** The capture card's Save: a shorter retention asks first (SET-04). */
  const saveCapture = () => {
    const from = defaultValues?.retention_days ?? 0
    const to = Math.round(getValues("retention_days"))
    if (from > 0 && to < from) setRetentionCut({ from, to })
    else void saveCard("capture")
  }

  const footer = (k: CardKey, saveLabel: string, onSave: () => void = () => void saveCard(k)) => (
    <CardSaveFooter
      dirty={canManage && cardDirty(k)}
      saving={savingCard === k}
      disabled={saving && savingCard !== k}
      onSave={onSave}
      onCancel={() => cancelCard(k)}
      saveLabel={saveLabel}
      className="mt-2"
    />
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitoring"
        description="How often device agents take screenshots, how long they're kept, and how agents stay up to date — for the whole organization."
      />

      {/* The permission's own name, as Roles & permissions lists it — it said "Manage Settings",
          which a role can hold without being able to save here (WP-521). */}
      {!canManage && (
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted px-5 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          You can view these settings, but saving requires the{" "}
          <span className="font-medium text-foreground">Manage monitoring settings</span>{" "}
          permission.
        </div>
      )}

      {loading ? (
        <Loader label="Loading monitoring settings…" />
      ) : loadError ? (
        <div className="rounded-md border border-border bg-muted px-5 py-4 text-sm text-muted-foreground">
          {loadError}
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── Screenshot capture ── */}
          {/* `data-tour`: the Monitoring Setup walkthrough spotlights this card. Safe to mark
              here because the whole tour is gated on `settings:view`, so anyone who reaches it
              renders this component — unlike /dashboard, which swaps component per role. */}
          <Card
            id="screenshots"
            data-tour="settings:capture"
            className="scroll-mt-24 shadow-none"
          >
            <CardHeader>
              <CardTitle>Screenshot capture</CardTitle>
              <CardDescription>
                How often screenshots are taken and how long they&apos;re kept before they&apos;re
                deleted automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 pb-2">
              {lock ? <CaptureLockNotice lock={lock} /> : null}
              {legacyOverride ? (
                <p className="mb-2 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
                  {legacyOverride.silent
                    ? "These settings hide the agent's capture indicator, which is the only notice employees get that monitoring is running. "
                    : ""}
                  {legacyOverride.blur ? "Screenshots are blurred. " : ""}
                  Neither can be set here any more — saving turns the indicator back on and stops
                  blurring.
                </p>
              ) : null}
              <SettingRow
                label="Screenshot frequency"
                description={
                  !lock
                    ? "How often a screenshot is taken while time is being recorded."
                    : capturing(lock)
                      ? "Screenshots are still taken at this interval; it just can't be changed right now."
                      : "Kept for when Screenshots is switched back on — nothing is captured meanwhile."
                }
                disabled={!canManage || lock !== null}
              >
                <Controller
                  control={control}
                  name="cadence"
                  render={({ field }) => (
                    <div className="flex flex-col items-start gap-2 sm:items-end">
                      <Select
                        value={field.value}
                        onValueChange={(v) =>
                          field.onChange(v as CadenceChoice)
                        }
                        disabled={!canManage || lock !== null}
                      >
                        <SelectTrigger className="w-56" aria-label="Screenshot frequency">
                          <SelectValue>
                            {(v) =>
                              CADENCE_OPTIONS.find((o) => o.value === v)
                                ?.label ?? "Select"
                            }
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {CADENCE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {/* Shown even while locked, so a stored custom interval reads as its minutes
                          rather than a bare "Custom…". */}
                      {field.value === "custom" ? (
                        <Controller
                          control={control}
                          name="customMinutes"
                          render={({ field: mf }) => (
                            <NumericStepper
                              value={mf.value}
                              min={CUSTOM_MIN}
                              max={CUSTOM_MAX}
                              suffix="min"
                              aria-label="Minutes between screenshots"
                              disabled={!canManage || lock !== null}
                              onChange={mf.onChange}
                            />
                          )}
                        />
                      ) : null}
                    </div>
                  )}
                />
              </SettingRow>
              {/* No Blur control. Screenshots are meant to be legible — a blurred one costs the
                  same to capture, store and retain while answering nothing. `blur_level` stays in
                  the wire type (the agent reads it) and every save sends 0. */}
              {/* Presets, not a one-day stepper (UX audit SET-04): 90 → 1 was a few clicks, and a
                  shorter period permanently deletes older screenshots — the save asks first (see
                  `retentionCut`). A stored value that isn't a preset stays offered as itself. */}
              <SettingRow
                label="Retention period"
                description="How long screenshots are kept before they are deleted automatically."
                disabled={!canManage}
              >
                <Controller
                  control={control}
                  name="retention_days"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => field.onChange(Number(v))}
                      disabled={!canManage}
                    >
                      <SelectTrigger className="w-56" aria-label="Retention period">
                        <SelectValue>{(v) => retentionLabel(Number(v))}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {retentionOptions(defaultValues?.retention_days ?? field.value).map(
                          (d) => (
                            <SelectItem key={d} value={d}>
                              {retentionLabel(d)}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  )}
                />
              </SettingRow>
              {footer("capture", "Save capture settings", saveCapture)}
            </CardContent>
          </Card>

          {/* ── Privacy pause (desktop app) ──
              The employee's own pause button: capture stops, the timer keeps running. Taken in as
              many pieces as they like until the day's total is used (owner request 2026-10-15).
              Hidden in machine-only orgs — the managed service has no pause — and until the server
              returns the setting (`pauseSupported`). */}
          {trackingMode !== "machine" && pauseSupported && (
            <Card id="privacy-pause" className="scroll-mt-24 shadow-none">
              <CardHeader>
                <CardTitle>Privacy pause</CardTitle>
                <CardDescription>
                  Lets employees pause screenshots, activity and location in the desktop app — for
                  a private message or a personal call — while their timer keeps running.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-0 pb-2">
                <SettingRow
                  label="Pause time per day"
                  description="Each employee's daily total. They can pause and resume as often as they like; only the time actually paused counts, and it resets every day. Set 0 to turn the pause off."
                  disabled={!canManage}
                >
                  <Controller
                    control={control}
                    name="pauseMinutes"
                    render={({ field }) => (
                      <NumericStepper
                        value={field.value}
                        min={0}
                        max={PAUSE_MAX_MINUTES}
                        suffix="min"
                        aria-label="Privacy pause minutes per day"
                        disabled={!canManage}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </SettingRow>
                {footer("pause", "Save privacy pause")}
              </CardContent>
            </Card>
          )}

          {/* ── Machine tracking (managed Windows service) ──
              Only shown to orgs that actually run it: the interactive app's timer is started and
              stopped by the employee, so an idle window would mean nothing there. */}
          {trackingMode !== "project" && (
            <Card id="machine" className="scroll-mt-24 shadow-none">
              <CardHeader>
                <CardTitle>Machine tracking</CardTitle>
                <CardDescription>
                  How the background Windows service counts a day. It starts at Windows sign-in and
                  stops at sign-out, shutdown or sleep; this is how long it waits before stopping
                  when nobody is using the machine.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-0 pb-2">
                <SettingRow
                  label="Stop when idle for"
                  description="With no keyboard or mouse input for this long, the session ends — counted back to the last activity, so idle time is never counted as work. It starts again by itself on the next key press or mouse move."
                  disabled={!canManage}
                >
                  <Controller
                    control={control}
                    name="idleMinutes"
                    render={({ field }) => (
                      <NumericStepper
                        value={field.value}
                        min={IDLE_MIN_MINUTES}
                        max={IDLE_MAX_MINUTES}
                        suffix="min"
                        aria-label="Minutes idle before the session stops"
                        disabled={!canManage}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </SettingRow>
                {footer("machine", "Save machine tracking")}
              </CardContent>
            </Card>
          )}

          {/* ── Agent updates ── */}
          <Card id="updates" data-tour="settings:updates" className="scroll-mt-24 shadow-none">
            <CardHeader>
              <CardTitle>Agent updates</CardTitle>
              <CardDescription>
                How device agents keep themselves up to date on employee computers.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 pb-2">
              <SettingRow
                label="Automatic updates"
                description="Device agents install each new WorkPulse release by themselves, with nothing for anyone to do."
                disabled={!canManage}
              >
                <Controller
                  control={control}
                  name="auto_update"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      disabled={!canManage}
                      onCheckedChange={field.onChange}
                      aria-label="Automatic updates"
                    />
                  )}
                />
              </SettingRow>
              {footer("updates", "Save agent updates")}
            </CardContent>
          </Card>

          {/* Who is excluded from screenshots: its own document, saved on its own (WP-146). */}
          {canManage && <ScreenshotExclusionsCard />}

          {/* No Employee-disclosure card, and no capture-authorisation card.
              Every save sends `silent: false` (see `onSave`), so the agent keeps showing its capture
              indicator — that indicator is what tells an employee monitoring is running, and it is
              the only notice the product gives. It is deliberately not something an admin can switch
              off from a settings page.
              Capture authorisation is gone with it: these are company-managed machines and the org
              has already decided. `fleet::serve_config` now treats an absent gate as capture-allowed
              (it used to fail closed, which is why managed devices had been capturing nothing at
              all). "Don't capture" is still expressible — set the cadence to Off. */}

          <ConfirmDialog
            open={retentionCut !== null}
            onOpenChange={(o) => !o && setRetentionCut(null)}
            title={`Keep screenshots for ${retentionCut?.to ?? ""} day${retentionCut?.to === 1 ? "" : "s"}?`}
            description={
              retentionCut
                ? `Screenshots are kept ${retentionCut.from} days today. Saving this permanently deletes every screenshot older than ${retentionCut.to} day${retentionCut.to === 1 ? "" : "s"} within the hour, for everyone in the organization. Deleted screenshots can't be recovered.`
                : ""
            }
            confirmLabel="Delete older screenshots and save"
            destructive
            busy={saving}
            onConfirm={() => {
              setRetentionCut(null)
              void saveCard("capture")
            }}
          />
        </div>
      )}
    </div>
  )
}

/**
 * Why the interval is locked, naming the switch that actually causes it and linking to where it is
 * changed (UX audit SET-03). Screenshots off means nothing is captured, and it says so plainly.
 */
function CaptureLockNotice({ lock }: { lock: CaptureLock }) {
  // Inherits the notice's own (contrast-safe) ink rather than adding a third colour to the box.
  const linkClass = "font-medium underline underline-offset-2 hover:no-underline"
  const copy: Record<CaptureLock["kind"], { text: string; href: string; link: string }> = {
    "screenshots-off": {
      text: "Screenshots are off in Features — nothing is being captured.",
      href: "/settings/features",
      link: "Open Features",
    },
    "screenshots-not-in-plan": {
      text: "Screenshots aren't included in your plan — nothing is being captured.",
      href: "/settings/billing",
      link: "See plans",
    },
  }
  const c = copy[lock.kind]
  return (
    <p
      role="status"
      className={cn(
        "mb-2 rounded-md px-3 py-2 text-xs",
        capturing(lock) ? "bg-muted text-muted-foreground" : "bg-warning/10 text-warning",
      )}
    >
      {c.text} Your other settings here still save.{" "}
      <Link href={c.href} className={linkClass}>
        {c.link}
      </Link>
    </p>
  )
}

function loadMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Your session expired. Sign in again."
    if (e.status === 403)
      return "You don't have access to the monitoring settings."
    return e.message
  }
  return "Couldn't load monitoring settings. Check your connection and retry."
}
