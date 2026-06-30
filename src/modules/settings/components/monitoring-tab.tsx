"use client"

import { useState } from "react"
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
import { PageHeader } from "@/components/shared/page-header"
import { SettingsSaveBar } from "@/components/shared/settings-save-bar"
import { usePermissions } from "@/hooks/use-permissions"
import { MONITORING_DEFAULTS, type MonitoringSettings } from "@/lib/mock-monitoring"
import { cn } from "@/lib/utils"

// Deep copy so draft/saved baselines never share nested references.
function cloneSettings(s: MonitoringSettings): MonitoringSettings {
  return {
    idle: { ...s.idle },
    screenshots: { ...s.screenshots },
    productivity: { ...s.productivity },
    workHours: { ...s.workHours },
    alertThresholds: { ...s.alertThresholds },
    silentMonitoring: s.silentMonitoring,
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

  const [saved, setSaved] = useState<MonitoringSettings>(() =>
    cloneSettings(MONITORING_DEFAULTS),
  )
  const [draft, setDraft] = useState<MonitoringSettings>(() =>
    cloneSettings(MONITORING_DEFAULTS),
  )
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)

  const updateIdle = (patch: Partial<MonitoringSettings["idle"]>) =>
    setDraft((d) => ({ ...d, idle: { ...d.idle, ...patch } }))
  const updateScreenshots = (patch: Partial<MonitoringSettings["screenshots"]>) =>
    setDraft((d) => ({ ...d, screenshots: { ...d.screenshots, ...patch } }))
  const updateProductivity = (patch: Partial<MonitoringSettings["productivity"]>) =>
    setDraft((d) => ({ ...d, productivity: { ...d.productivity, ...patch } }))
  const updateWorkHours = (patch: Partial<MonitoringSettings["workHours"]>) =>
    setDraft((d) => ({ ...d, workHours: { ...d.workHours, ...patch } }))
  const updateAlerts = (patch: Partial<MonitoringSettings["alertThresholds"]>) =>
    setDraft((d) => ({ ...d, alertThresholds: { ...d.alertThresholds, ...patch } }))

  function handleSave() {
    if (!dirty || saving) return
    const next = draft
    setSaving(true)
    // Simulated persistence latency (Phase 1 is frontend-only).
    setTimeout(() => {
      setSaved(cloneSettings(next))
      setSaving(false)
      toast.success("Monitoring settings saved")
    }, 500)
  }

  function handleReset() {
    setDraft(cloneSettings(saved))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitoring"
        description="Configure idle detection, screenshot capture, and productivity thresholds for your organization."
      />

      {!canManage && (
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted px-5 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          You can view these settings, but saving requires the{" "}
          <span className="font-medium text-foreground">Manage Settings</span>{" "}
          permission.
        </div>
      )}

      <div className="space-y-6">
          {/* ── Idle Detection ── */}
          <Card id="idle" className="scroll-mt-24 shadow-none">
            <CardHeader>
              <CardTitle>Idle detection</CardTitle>
              <CardDescription>
                Determine when a user is considered idle and how the timer responds.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 pb-2">
              <SettingRow
                label="Idle threshold"
                description="Minutes of inactivity before a session is marked as idle."
                disabled={!canManage}
              >
                <NumericStepper
                  value={draft.idle.thresholdMins}
                  min={1}
                  max={120}
                  suffix="min"
                  disabled={!canManage}
                  onChange={(v) => updateIdle({ thresholdMins: v })}
                />
              </SettingRow>
              <SettingRow
                label="Pause timer on idle"
                description="Automatically pause the running timer when idle is detected."
                disabled={!canManage}
              >
                <Switch
                  checked={draft.idle.pauseTimerOnIdle}
                  disabled={!canManage}
                  onCheckedChange={(v) => updateIdle({ pauseTimerOnIdle: v })}
                />
              </SettingRow>
            </CardContent>
          </Card>

          {/* ── Screenshots ── */}
          <Card id="screenshots" className="scroll-mt-24 shadow-none">
            <CardHeader>
              <CardTitle>Screenshots</CardTitle>
              <CardDescription>
                Control how often screenshots are captured and how long they are retained.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 pb-2">
              <SettingRow
                label="Capture frequency"
                description="How often the desktop agent captures a screenshot during active sessions."
                disabled={!canManage}
              >
                <NumericStepper
                  value={draft.screenshots.frequencyMins}
                  min={1}
                  max={60}
                  suffix="min"
                  disabled={!canManage}
                  onChange={(v) => updateScreenshots({ frequencyMins: v })}
                />
              </SettingRow>
              <SettingRow
                label="Blur by default"
                description="Automatically blur screenshots before upload to protect sensitive content."
                disabled={!canManage}
              >
                <Switch
                  checked={draft.screenshots.blurByDefault}
                  disabled={!canManage}
                  onCheckedChange={(v) => updateScreenshots({ blurByDefault: v })}
                />
              </SettingRow>
              <SettingRow
                label="Capture on idle"
                description="Continue capturing screenshots even while the user is idle."
                disabled={!canManage}
              >
                <Switch
                  checked={draft.screenshots.captureOnIdle}
                  disabled={!canManage}
                  onCheckedChange={(v) => updateScreenshots({ captureOnIdle: v })}
                />
              </SettingRow>
              <SettingRow
                label="Retention period"
                description="Days to keep screenshots before automatic deletion."
                disabled={!canManage}
              >
                <NumericStepper
                  value={draft.screenshots.retentionDays}
                  min={7}
                  max={365}
                  step={1}
                  suffix="days"
                  disabled={!canManage}
                  onChange={(v) => updateScreenshots({ retentionDays: v })}
                />
              </SettingRow>
            </CardContent>
          </Card>

          {/* ── Productivity Thresholds ── */}
          <Card id="productivity" className="scroll-mt-24 shadow-none">
            <CardHeader>
              <CardTitle>Productivity thresholds</CardTitle>
              <CardDescription>
                Define the activity bands that colour-code productivity scores across Insights.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 pb-2">
              <SettingRow
                label="Productive threshold"
                description="Activity at or above this percentage is rated productive (green band)."
                disabled={!canManage}
              >
                <NumericStepper
                  value={draft.productivity.productiveThreshold}
                  min={1}
                  max={100}
                  step={5}
                  suffix="%"
                  disabled={!canManage}
                  onChange={(v) => updateProductivity({ productiveThreshold: v })}
                />
              </SettingRow>
              <SettingRow
                label="Low activity threshold"
                description="Activity below this percentage is rated low (red band)."
                disabled={!canManage}
              >
                <NumericStepper
                  value={draft.productivity.lowActivityThreshold}
                  min={1}
                  max={100}
                  step={5}
                  suffix="%"
                  disabled={!canManage}
                  onChange={(v) => updateProductivity({ lowActivityThreshold: v })}
                />
              </SettingRow>
            </CardContent>
          </Card>

          {/* ── Daily Work-Hour Rules ── */}
          <Card id="work-hours" className="scroll-mt-24 shadow-none">
            <CardHeader>
              <CardTitle>Daily work-hour rules</CardTitle>
              <CardDescription>
                Set the expected workday length and the overtime alert threshold.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 pb-2">
              <SettingRow
                label="Expected hours per day"
                description="The standard workday used to calculate utilization and overtime."
                disabled={!canManage}
              >
                <NumericStepper
                  value={draft.workHours.expectedHoursPerDay}
                  min={1}
                  max={24}
                  suffix="hrs"
                  disabled={!canManage}
                  onChange={(v) => updateWorkHours({ expectedHoursPerDay: v })}
                />
              </SettingRow>
              <SettingRow
                label="Overtime alert threshold"
                description="Trigger an alert when tracked hours exceed this value in a single day."
                disabled={!canManage}
              >
                <NumericStepper
                  value={draft.workHours.overtimeAlertThreshold}
                  min={1}
                  max={24}
                  suffix="hrs"
                  disabled={!canManage}
                  onChange={(v) => updateWorkHours({ overtimeAlertThreshold: v })}
                />
              </SettingRow>
            </CardContent>
          </Card>

          {/* ── Alert Thresholds ── */}
          <Card id="alerts" className="scroll-mt-24 shadow-none">
            <CardHeader>
              <CardTitle>Alert thresholds</CardTitle>
              <CardDescription>
                Configure triggers for the anomaly alerts shown in Insights → Anomalies.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-0 pb-2">
              <SettingRow
                label="Long inactivity alert"
                description="Alert when a user with an active timer is continuously idle beyond this threshold."
                disabled={!canManage}
              >
                <NumericStepper
                  value={draft.alertThresholds.longInactivityMins}
                  min={5}
                  max={480}
                  step={5}
                  suffix="min"
                  disabled={!canManage}
                  onChange={(v) => updateAlerts({ longInactivityMins: v })}
                />
              </SettingRow>
              <SettingRow
                label="Productivity drop alert"
                description="Alert when a user's score drops by more than this vs their 7-day average."
                disabled={!canManage}
              >
                <NumericStepper
                  value={draft.alertThresholds.productivityDropPercent}
                  min={5}
                  max={100}
                  step={5}
                  suffix="%"
                  disabled={!canManage}
                  onChange={(v) => updateAlerts({ productivityDropPercent: v })}
                />
              </SettingRow>
              <SettingRow
                label="Burnout alert threshold"
                description="Alert when a user tracks more hours than this in a single day."
                disabled={!canManage}
              >
                <NumericStepper
                  value={draft.alertThresholds.burnoutHoursPerDay}
                  min={6}
                  max={24}
                  suffix="hrs"
                  disabled={!canManage}
                  onChange={(v) => updateAlerts({ burnoutHoursPerDay: v })}
                />
              </SettingRow>
            </CardContent>
          </Card>

          {/* ── Silent Monitoring ── */}
          <Card id="silent" className="scroll-mt-24 shadow-none">
            <CardHeader>
              <CardTitle>Silent monitoring</CardTitle>
              <CardDescription>
                When enabled, employees are not notified when screenshots are taken or when they
                are actively monitored.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pb-2">
              <SettingRow
                label="Enable silent monitoring"
                description="Removes system-tray indicators and capture notifications from employee devices."
                disabled={!canManage}
              >
                <Switch
                  checked={draft.silentMonitoring}
                  disabled={!canManage}
                  onCheckedChange={(v) =>
                    setDraft((d) => ({ ...d, silentMonitoring: v }))
                  }
                />
              </SettingRow>
              <p className="rounded-md border border-border bg-muted/60 px-4 py-3 text-xs text-muted-foreground">
                <strong className="font-medium text-foreground">
                  Note on ethics &amp; legal compliance:
                </strong>{" "}
                Silent monitoring may have legal implications in certain jurisdictions. Ensure
                your employee contracts and local employment laws permit undisclosed monitoring
                before enabling this option. WorkPulse recommends transparent monitoring as a
                default.
              </p>
            </CardContent>
          </Card>

        {canManage && (
          <SettingsSaveBar
            dirty={dirty}
            saving={saving}
            onSave={handleSave}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  )
}
