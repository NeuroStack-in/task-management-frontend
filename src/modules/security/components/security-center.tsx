"use client"

import { useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react"
import { toast } from "sonner"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { NumberStepper } from "@/components/ui/number-stepper"
import { PageHeader } from "@/components/shared/page-header"
import { SettingsSaveBar } from "@/components/shared/settings-save-bar"
import { usePermissions } from "@/hooks/use-permissions"
import {
  MFA_GRACE_OPTIONS,
  MFA_METHODS,
  PASSWORD_ROTATION_OPTIONS,
  SECURITY_DEFAULTS,
  SECURITY_EVENTS,
  SECURITY_OVERVIEW,
  SSO_CONNECTION,
  type SecurityPolicies,
} from "@/lib/mock-security"
import { cn } from "@/lib/utils"

// Derived from the same source the Audit Logs page reads — no duplicated table.
const FLAGGED_EVENTS = SECURITY_EVENTS.filter(
  (e) => e.status === "flagged" || e.status === "blocked",
).length

// ── Draft / saved model ───────────────────────────────────────────────────────

interface SecurityDraft {
  policies: SecurityPolicies
  methods: Record<string, boolean>
}

const INITIAL: SecurityDraft = {
  policies: {
    ...SECURITY_DEFAULTS,
    ipAllowlist: [...SECURITY_DEFAULTS.ipAllowlist],
  },
  methods: Object.fromEntries(MFA_METHODS.map((m) => [m.key, m.enabled])),
}

function cloneDraft(d: SecurityDraft): SecurityDraft {
  return {
    policies: { ...d.policies, ipAllowlist: [...d.policies.ipAllowlist] },
    methods: { ...d.methods },
  }
}

// ── Small shared bits ─────────────────────────────────────────────────────────

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
        "flex items-center justify-between gap-6 py-3 [&+&]:border-t",
        disabled && "opacity-60",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function ReadOnlyField({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <p
          className={cn(
            "min-w-0 flex-1 truncate text-sm",
            mono && "font-mono text-xs",
          )}
        >
          {value}
        </p>
        <button
          onClick={() => {
            navigator.clipboard?.writeText(value)
            toast.success("Copied to clipboard")
          }}
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={`Copy ${label}`}
        >
          <Copy className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

// ── IP allowlist ──────────────────────────────────────────────────────────────

function IpAllowlist({
  items,
  onChange,
  canManage,
}: {
  items: string[]
  onChange: (next: string[]) => void
  canManage: boolean
}) {
  const [input, setInput] = useState("")

  function add() {
    const val = input.trim()
    if (!val) return
    if (!items.includes(val)) onChange([...items, val])
    setInput("")
  }

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex gap-2">
          <Input
            placeholder="IP or CIDR, e.g. 203.0.113.0/24"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            className="font-mono text-sm"
          />
          <Button size="sm" variant="outline" onClick={add}>
            <Plus className="size-4" />
          </Button>
        </div>
      )}
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No restrictions — members can sign in from any IP address.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {items.map((ip) => (
            <span
              key={ip}
              className="flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 font-mono text-xs"
            >
              {ip}
              {canManage && (
                <button
                  onClick={() => onChange(items.filter((i) => i !== ip))}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={`Remove ${ip}`}
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SecurityCenter() {
  const { can } = usePermissions()
  const canManage = can("security:manage")

  const [saved, setSaved] = useState<SecurityDraft>(() => cloneDraft(INITIAL))
  const [draft, setDraft] = useState<SecurityDraft>(() => cloneDraft(INITIAL))
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)

  const updatePolicy = (patch: Partial<SecurityPolicies>) =>
    setDraft((d) => ({ ...d, policies: { ...d.policies, ...patch } }))
  const toggleMethod = (key: string) =>
    setDraft((d) => ({ ...d, methods: { ...d.methods, [key]: !d.methods[key] } }))

  function handleSave() {
    if (!dirty || saving) return
    const next = draft
    setSaving(true)
    setTimeout(() => {
      setSaved(cloneDraft(next))
      setSaving(false)
      toast.success("Security settings saved")
    }, 500)
  }

  function handleReset() {
    setDraft(cloneDraft(saved))
  }

  const { policies, methods } = draft
  const adoptionPct = Math.round(
    (SECURITY_OVERVIEW.mfaEnrolled / SECURITY_OVERVIEW.mfaTotal) * 100,
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security Center"
        description="Authentication, single sign-on, session policies, and security activity."
        actions={
          <Button
            variant="outline"
            onClick={() => toast.success("Security report downloaded")}
          >
            <Download className="size-4" /> Download report
          </Button>
        }
      />

      {!canManage && (
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted px-5 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          You can view these settings, but changing them requires the{" "}
          <span className="font-medium text-foreground">Manage Security</span>{" "}
          permission.
        </div>
      )}

      {/* ── Overview strip (quiet, at-a-glance only) ── */}
      <div className="grid grid-cols-2 divide-x divide-y divide-border overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-4 sm:divide-y-0">
        {[
          { label: "Security score", value: `${SECURITY_OVERVIEW.securityScore}/100` },
          { label: "MFA adoption", value: `${adoptionPct}%` },
          { label: "Active sessions", value: SECURITY_OVERVIEW.activeSessions },
          { label: "Open alerts", value: SECURITY_OVERVIEW.openAlerts },
        ].map((s) => (
          <div key={s.label} className="px-4 py-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="mt-0.5 font-display text-lg font-semibold tabular-nums">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* ── Multi-factor authentication ── */}
      <Card>
        <CardHeader>
          <CardTitle>Multi-Factor Authentication</CardTitle>
          <CardDescription>
            Add an extra verification step at sign-in for every member.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Personal status */}
          <div className="flex items-center gap-3 rounded-md bg-success/10 px-4 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
              <ShieldCheck className="size-4" />
            </span>
            <p className="text-sm">
              <span className="font-medium">Your account is protected</span> with an
              authenticator app.
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto shrink-0"
              onClick={() => toast.success("Recovery codes downloaded")}
            >
              Recovery codes
            </Button>
          </div>

          <div>
            <SettingRow
              label="Require multi-factor authentication"
              description="All members must set up MFA before they can access WorkPulse."
              disabled={!canManage}
            >
              <Switch
                checked={policies.mfaRequired}
                disabled={!canManage}
                onCheckedChange={(v) => updatePolicy({ mfaRequired: v })}
              />
            </SettingRow>
            <SettingRow
              label="Enrollment grace period"
              description="How long new members may wait before MFA becomes mandatory."
              disabled={!canManage || !policies.mfaRequired}
            >
              <Select
                value={String(policies.mfaGraceDays)}
                onValueChange={(v) =>
                  updatePolicy({ mfaGraceDays: Number(v) })
                }
                disabled={!canManage || !policies.mfaRequired}
              >
                <SelectTrigger size="sm" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MFA_GRACE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>
          </div>

          {/* Allowed methods */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Allowed methods
            </p>
            <div className="divide-y divide-border rounded-md border border-border">
              {MFA_METHODS.map((m) => (
                <div
                  key={m.key}
                  className="flex items-center justify-between gap-4 px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.description}</p>
                  </div>
                  <Switch
                    size="sm"
                    checked={methods[m.key]}
                    disabled={!canManage}
                    onCheckedChange={() => toggleMethod(m.key)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Adoption */}
          <div className="space-y-2 rounded-md bg-muted/50 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Organization enrollment</span>
              <span className="tabular-nums text-muted-foreground">
                {SECURITY_OVERVIEW.mfaEnrolled}/{SECURITY_OVERVIEW.mfaTotal} ·{" "}
                {adoptionPct}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${adoptionPct}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Single sign-on ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Single Sign-On (SSO)
            <Badge className="bg-success/12 font-normal text-success">
              <Check className="size-3" /> Connected
            </Badge>
          </CardTitle>
          <CardDescription>
            {SSO_CONNECTION.provider} · {SSO_CONNECTION.protocol} · last sign-in{" "}
            {SSO_CONNECTION.lastLogin}
          </CardDescription>
          <CardAction>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => toast.info("Opening identity-provider configuration…")}
            >
              <RefreshCw className="size-3.5" /> Reconfigure
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <ReadOnlyField label="Verified domain" value={SSO_CONNECTION.domain} />
            <ReadOnlyField
              label="Certificate expires"
              value={SSO_CONNECTION.certificateExpires}
            />
            <ReadOnlyField label="Sign-on URL" value={SSO_CONNECTION.ssoUrl} mono />
            <ReadOnlyField label="Entity ID" value={SSO_CONNECTION.entityId} mono />
            <div className="sm:col-span-2">
              <ReadOnlyField
                label="Certificate fingerprint (SHA-256)"
                value={SSO_CONNECTION.certificateFingerprint}
                mono
              />
            </div>
          </div>

          <div>
            <SettingRow
              label="Enforce SSO for all members"
              description="Require members to sign in through your identity provider; disables password sign-in."
              disabled={!canManage}
            >
              <Switch
                checked={policies.ssoEnforced}
                disabled={!canManage}
                onCheckedChange={(v) => updatePolicy({ ssoEnforced: v })}
              />
            </SettingRow>
            <SettingRow
              label="SCIM user provisioning"
              description="Automatically create, update, and deactivate accounts from your IdP."
              disabled={!canManage}
            >
              <Switch
                checked={policies.scimEnabled}
                disabled={!canManage}
                onCheckedChange={(v) => updatePolicy({ scimEnabled: v })}
              />
            </SettingRow>
          </div>
        </CardContent>
      </Card>

      {/* ── Session & access ── */}
      <Card>
        <CardHeader>
          <CardTitle>Session & Access</CardTitle>
          <CardDescription>
            Control how long sessions last and where members can sign in from.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0 pb-2">
          <SettingRow
            label="Session timeout"
            description="Sign members out automatically after this much inactivity."
            disabled={!canManage}
          >
            <NumberStepper
              value={policies.sessionTimeoutMins}
              min={5}
              max={480}
              step={5}
              suffix="min"
              disabled={!canManage}
              onChange={(v) => updatePolicy({ sessionTimeoutMins: v })}
            />
          </SettingRow>
          <SettingRow
            label="Maximum concurrent sessions"
            description="How many active sessions a single member can have at once."
            disabled={!canManage}
          >
            <NumberStepper
              value={policies.maxConcurrentSessions}
              min={1}
              max={20}
              valueWidthClassName="w-12"
              disabled={!canManage}
              onChange={(v) => updatePolicy({ maxConcurrentSessions: v })}
            />
          </SettingRow>
          <SettingRow
            label="Remember this device"
            description="Skip MFA on trusted devices for this many days."
            disabled={!canManage}
          >
            <NumberStepper
              value={policies.rememberDeviceDays}
              min={0}
              max={90}
              suffix="days"
              disabled={!canManage}
              onChange={(v) => updatePolicy({ rememberDeviceDays: v })}
            />
          </SettingRow>
          <div className="py-4 [&+&]:border-t">
            <Label className="text-sm font-medium">IP allowlist</Label>
            <p className="mt-0.5 mb-3 text-xs text-muted-foreground">
              Restrict sign-in to these IP addresses or CIDR ranges.
            </p>
            <IpAllowlist
              items={policies.ipAllowlist}
              onChange={(v) => updatePolicy({ ipAllowlist: v })}
              canManage={canManage}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Password policy ── */}
      <Card>
        <CardHeader>
          <CardTitle>Password Policy</CardTitle>
          <CardDescription>
            Minimum requirements for member passwords.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0 pb-2">
          <SettingRow
            label="Minimum length"
            description="Passwords shorter than this are rejected."
            disabled={!canManage}
          >
            <NumberStepper
              value={policies.passwordMinLength}
              min={8}
              max={64}
              suffix="chars"
              disabled={!canManage}
              onChange={(v) => updatePolicy({ passwordMinLength: v })}
            />
          </SettingRow>
          <SettingRow
            label="Require mixed characters"
            description="Require upper- and lower-case letters, a number, and a symbol."
            disabled={!canManage}
          >
            <Switch
              checked={policies.passwordComplexity}
              disabled={!canManage}
              onCheckedChange={(v) => updatePolicy({ passwordComplexity: v })}
            />
          </SettingRow>
          <SettingRow
            label="Password rotation"
            description="Prompt members to choose a new password on a schedule."
            disabled={!canManage}
          >
            <Select
              value={String(policies.passwordRotationDays)}
              onValueChange={(v) => updatePolicy({ passwordRotationDays: Number(v) })}
              disabled={!canManage}
            >
              <SelectTrigger size="sm" className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PASSWORD_ROTATION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingRow>
        </CardContent>
      </Card>

      {/* ── Security activity summary (full log lives in Audit Logs) ── */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Security activity</CardTitle>
          <CardDescription>
            Sign-ins, MFA changes, and policy updates are recorded in the audit
            log.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-md",
                  FLAGGED_EVENTS > 0
                    ? "bg-warning/15 text-warning"
                    : "bg-success/12 text-success",
                )}
              >
                {FLAGGED_EVENTS > 0 ? (
                  <AlertTriangle className="size-4" />
                ) : (
                  <ShieldCheck className="size-4" />
                )}
              </span>
              <div>
                <p className="text-sm font-medium">
                  {FLAGGED_EVENTS > 0
                    ? `${FLAGGED_EVENTS} flagged ${FLAGGED_EVENTS === 1 ? "event" : "events"} in the last 7 days`
                    : "No flagged events in the last 7 days"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Blocked sign-ins and unusual activity needing review.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              nativeButton={false}
              render={<Link href="/settings/audit-logs" />}
            >
              View audit logs <ArrowUpRight className="size-4" />
            </Button>
          </div>
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
  )
}
