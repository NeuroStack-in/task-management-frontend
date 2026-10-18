"use client"

import { useCallback, useEffect, useState } from "react"
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
import { SettingsSaveBar } from "@/components/shared/settings-save-bar"
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
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard"
import { cn } from "@/lib/utils"
import { ScreenshotExclusionsCard } from "./screenshot-exclusions-card"

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
        "flex items-center justify-between gap-6 py-3 [&+&]:border-t border-border",
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
  // The server refuses any save whose cadence isn't Off unless `monitoring.activity` is effective for
  // the org — the plain plan ∩ toggle check, with no owner exemption (`fleet::update_policy`). The
  // page used to send the stored cadence (`min5` for an org that never saved one) with every edit,
  // so on Free, or with Activity monitoring off, no setting here could be saved at all and the error
  // blamed the plan (QA audit 2026-10-08, WP-330). While capture can't run, it is shown — and saved —
  // as Off, so the other settings save.
  const captureAllowed = useEntitlementsStore((s) =>
    effectiveFromState(s, "monitoring.activity"),
  )
  const captureInPlan = useEntitlementsStore(
    (s) => !s.loaded || s.allowed.includes("monitoring.activity"),
  )

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { isDirty, defaultValues },
  } = useForm<PolicyForm>({ defaultValues: EMPTY })
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
  useUnsavedGuard(isDirty)

  // The optimistic-concurrency token from `tracking.version`. Retained across edits and sent back as
  // `expected_version`; bumped from each successful save's response.
  const [version, setVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
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
      seed(
        {
          ...cadenceToForm(cfg.tracking.cadence),
          blur_level: cfg.tracking.blur_level,
          retention_days: cfg.tracking.retention_days,
          silent: cfg.tracking.silent,
          auto_update: cfg.tracking.auto_update,
          idleMinutes: secsToMinutes(cfg.tracking.idle_end_secs),
          pauseMinutes: pauseSecsToMinutes(cfg.tracking.pause_allowance_secs),
        },
        cfg.tracking.version,
      )
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

  const onSave = handleSubmit(async (values) => {
    if (saving) return
    setSaving(true)
    const cadence = captureAllowed ? formToCadence(values.cadence, values.customMinutes) : "off"
    try {
      const next = await updateTrackingPolicy({
        cadence,
        // Pinned, never round-tripped — see `PolicyForm` (WP-331).
        blur_level: 0,
        // Whole days: the server field is a `u16` and rejects a fraction (WP-361).
        retention_days: Math.round(values.retention_days),
        silent: false,
        auto_update: values.auto_update,
        idle_end_secs: Math.round(values.idleMinutes) * 60,
        ...(pauseSupported ? { pause_allowance_secs: Math.round(values.pauseMinutes) * 60 } : {}),
        expected_version: version,
      })
      setLegacyOverride(null)
      setPauseSupported(next.pause_allowance_secs !== undefined)
      seed(
        {
          ...cadenceToForm(next.cadence),
          blur_level: next.blur_level,
          retention_days: next.retention_days,
          silent: next.silent,
          auto_update: next.auto_update,
          idleMinutes: secsToMinutes(next.idle_end_secs),
          pauseMinutes: pauseSecsToMinutes(next.pause_allowance_secs),
        },
        next.version,
      )
      toast.success("Monitoring settings saved")
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
      setSaving(false)
    }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitoring"
        description="Configure how the desktop agent captures screenshots and how long they are retained across your organization."
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
                Control how often the desktop agent captures screenshots and how long they are
                retained.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 pb-2">
              {!captureAllowed ? (
                <p className="mb-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                  Screenshot capture is off because Activity monitoring{" "}
                  {captureInPlan
                    ? "is switched off in Settings → Features"
                    : "isn't included in your plan"}
                  . Your other settings here still save.
                </p>
              ) : null}
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
                label="Capture cadence"
                description="How often a screenshot is taken while a session is active."
                disabled={!canManage || !captureAllowed}
              >
                <Controller
                  control={control}
                  name="cadence"
                  render={({ field }) => (
                    <div className="flex flex-col items-end gap-2">
                      <Select
                        value={captureAllowed ? field.value : "off"}
                        onValueChange={(v) =>
                          field.onChange(v as CadenceChoice)
                        }
                        disabled={!canManage || !captureAllowed}
                      >
                        <SelectTrigger className="w-56" aria-label="Capture cadence">
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
                      {field.value === "custom" && captureAllowed ? (
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
                              disabled={!canManage}
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
              <SettingRow
                label="Retention period"
                description="Days to keep screenshots before they are deleted automatically."
                disabled={!canManage}
              >
                <Controller
                  control={control}
                  name="retention_days"
                  render={({ field }) => (
                    <NumericStepper
                      value={field.value}
                      min={1}
                      max={365}
                      suffix="days"
                      aria-label="Retention period in days"
                      disabled={!canManage}
                      onChange={field.onChange}
                    />
                  )}
                />
              </SettingRow>
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
                  label="Stop after inactivity"
                  description="With no keyboard or mouse input for this long, the session ends — counted back to the last activity, so idle time is never billed. It starts again by itself on the next key press or mouse move."
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
                        aria-label="Stop after this many minutes of inactivity"
                        disabled={!canManage}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </SettingRow>
              </CardContent>
            </Card>
          )}

          {/* ── Agent updates ── */}
          <Card id="updates" data-tour="settings:updates" className="scroll-mt-24 shadow-none">
            <CardHeader>
              <CardTitle>Agent updates</CardTitle>
              <CardDescription>
                Manage how the desktop agent keeps itself up to date on employee devices.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 pb-2">
              <SettingRow
                label="Automatic updates"
                description="Allow agents to self-update to the latest released version without manual intervention."
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

          {canManage && (
            <SettingsSaveBar
              dirty={isDirty}
              saving={saving}
              onSave={() => {
                const from = defaultValues?.retention_days ?? 0
                const to = Math.round(getValues("retention_days"))
                if (from > 0 && to < from) setRetentionCut({ from, to })
                else void onSave()
              }}
              onReset={() => reset()}
            />
          )}
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
              void onSave()
            }}
          />
        </div>
      )}
    </div>
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
