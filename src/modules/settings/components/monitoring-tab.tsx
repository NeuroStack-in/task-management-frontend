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
import { usePermissions } from "@/hooks/use-permissions"
import { ApiError } from "@/lib/api"
import {
  getTrackingPolicy,
  updateTrackingPolicy,
  type TrackingCadence,
} from "@/modules/agents/services/fleet.service"
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard"
import { cn } from "@/lib/utils"

/**
 * The cadence *choice* the dropdown offers. The four presets map straight to the wire strings;
 * `"custom"` pairs with `customMinutes` and is serialized to `{ custom: n }` on save.
 */
type CadenceChoice = "off" | "min3" | "min5" | "min10" | "custom"

const CUSTOM_MIN = 1
const CUSTOM_MAX = 60
const CUSTOM_DEFAULT = 7

/** The form fields (agent `TrackingConfig`, sans `version`), with cadence split into choice + minutes. */
type PolicyForm = {
  cadence: CadenceChoice
  /** Minutes for the `"custom"` choice; ignored otherwise. */
  customMinutes: number
  blur_level: number
  retention_days: number
  silent: boolean
  auto_update: boolean
}

const EMPTY: PolicyForm = {
  cadence: "off",
  customMinutes: CUSTOM_DEFAULT,
  blur_level: 0,
  retention_days: 30,
  silent: false,
  auto_update: true,
}

const CADENCE_OPTIONS: { value: CadenceChoice; label: string }[] = [
  { value: "off", label: "Off — no screenshots" },
  { value: "min3", label: "Every 3 minutes" },
  { value: "min5", label: "Every 5 minutes" },
  { value: "min10", label: "Every 10 minutes" },
  { value: "custom", label: "Custom…" },
]

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
  const canManage = can("settings:manage")

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<PolicyForm>({ defaultValues: EMPTY })

  // Leaving via the settings rail now asks before discarding these edits.
  useUnsavedGuard(isDirty)

  // The optimistic-concurrency token from `tracking.version`. Retained across edits and sent back as
  // `expected_version`; bumped from each successful save's response.
  const [version, setVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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
        },
        cfg.tracking.version,
      )
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
    try {
      const next = await updateTrackingPolicy({
        cadence: formToCadence(values.cadence, values.customMinutes),
        blur_level: values.blur_level,
        retention_days: values.retention_days,
        silent: values.silent,
        auto_update: values.auto_update,
        expected_version: version,
      })
      seed(
        {
          ...cadenceToForm(next.cadence),
          blur_level: next.blur_level,
          retention_days: next.retention_days,
          silent: next.silent,
          auto_update: next.auto_update,
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
        toast.error(
          "Monitoring capture isn't included in your plan — you can't enable screenshot capture. Upgrade to turn it on.",
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

      {!canManage && (
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted px-5 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          You can view these settings, but saving requires the{" "}
          <span className="font-medium text-foreground">Manage Settings</span>{" "}
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
                Control how often the desktop agent captures screenshots, how they are blurred, and
                how long they are retained.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 pb-2">
              <SettingRow
                label="Capture cadence"
                description="How often a screenshot is taken while a session is active."
                disabled={!canManage}
              >
                <Controller
                  control={control}
                  name="cadence"
                  render={({ field }) => (
                    <div className="flex flex-col items-end gap-2">
                      <Select
                        value={field.value}
                        onValueChange={(v) =>
                          field.onChange(v as CadenceChoice)
                        }
                        disabled={!canManage}
                      >
                        <SelectTrigger className="w-56">
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
              <SettingRow
                label="Blur level"
                description="Strength of the automatic blur applied before upload (0 = none, 3 = heaviest)."
                disabled={!canManage}
              >
                <Controller
                  control={control}
                  name="blur_level"
                  render={({ field }) => (
                    <NumericStepper
                      value={field.value}
                      min={0}
                      max={3}
                      suffix="level"
                      disabled={!canManage}
                      onChange={field.onChange}
                    />
                  )}
                />
              </SettingRow>
              <SettingRow
                label="Retention period"
                description="Days to keep screenshots before automatic deletion."
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
                      disabled={!canManage}
                      onChange={field.onChange}
                    />
                  )}
                />
              </SettingRow>
            </CardContent>
          </Card>

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
                    />
                  )}
                />
              </SettingRow>
            </CardContent>
          </Card>

          {/* ── Employee disclosure ── */}
          {/* Re-added: the desktop agent DOES honour `silent` (agent v0.1.11+) — it hides the capture
              indicator and suppresses its on-screen notices (screenshot-taken, restricted-app warning).
              The earlier "no effect" note is stale. */}
          <Card id="disclosure" className="scroll-mt-24 shadow-none">
            <CardHeader>
              <CardTitle>Employee disclosure</CardTitle>
              <CardDescription>
                Controls what the desktop agent shows the employee on their own machine. Capture and
                reporting are unaffected either way.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 pb-2">
              <SettingRow
                label="Silent monitoring"
                description="Hide the agent's capture indicator and suppress its on-screen notices (screenshot taken, restricted-app warnings). Covert monitoring is restricted or unlawful in some regions — confirm your local notice and consent obligations before enabling."
                disabled={!canManage}
              >
                <Controller
                  control={control}
                  name="silent"
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      disabled={!canManage}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
              </SettingRow>
            </CardContent>
          </Card>

          {canManage && (
            <SettingsSaveBar
              dirty={isDirty}
              saving={saving}
              onSave={onSave}
              onReset={() => reset()}
            />
          )}
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
