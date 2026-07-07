"use client"

import { useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  KeyRound,
  Laptop,
  Lock,
  Monitor,
  Plus,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Tablet,
  X,
  type LucideIcon,
} from "lucide-react"
import { toast } from "sonner"
import { QRCodeSVG } from "qrcode.react"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { useAuthStore } from "@/stores/auth.store"
import { isIpOrCidr } from "@/lib/validation"
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

// ── Active sessions (your signed-in devices) ──────────────────────────────────

interface SessionRow {
  id: string
  device: string
  location: string
  lastActive: string
  current?: boolean
  icon: LucideIcon
}

const SESSIONS: SessionRow[] = [
  {
    id: "s1",
    device: "Chrome on Windows",
    location: "Bengaluru, IN",
    lastActive: "Active now",
    current: true,
    icon: Laptop,
  },
  {
    id: "s2",
    device: "Safari on iPhone",
    location: "Bengaluru, IN",
    lastActive: "2 days ago",
    icon: Smartphone,
  },
  {
    id: "s3",
    device: "Firefox on macOS",
    location: "Mumbai, IN",
    lastActive: "5 days ago",
    icon: Monitor,
  },
  {
    id: "s4",
    device: "Chrome on iPad",
    location: "Hyderabad, IN",
    lastActive: "1 week ago",
    icon: Tablet,
  },
]

// ── Personal MFA enrollment (frontend-only stand-ins) ─────────────────────────
const TOTP_SECRET = "JBSW Y3DP EHPK 3PXP"
const RECOVERY_CODES = [
  "4F2K-9QX7",
  "B8M3-7TLP",
  "Z1C6-2WD9",
  "9HRA-5NK2",
  "Q3VE-8YB4",
  "L7XP-1MD6",
  "T2KF-6RZ8",
  "C9WN-3JQ5",
]

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
    if (!isIpOrCidr(val)) {
      toast.error("Enter a valid IPv4 address or CIDR, e.g. 203.0.113.0/24")
      return
    }
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

  // Personal account actions (available to every member, not gated by canManage).
  const userEmail = useAuthStore((s) => s.user?.email)
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" })

  // Personal MFA enrollment (your own authenticator), separate from the org policy.
  // Starts not-enrolled so first-time setup is discoverable; once enrolled, the
  // banner exposes "Reconfigure" to re-run setup without turning MFA off first.
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [setupOpen, setSetupOpen] = useState(false)
  const [otp, setOtp] = useState("")
  const [codesOpen, setCodesOpen] = useState(false)
  // The QR encodes the secret, so keep it hidden until the user reveals it
  // (avoids exposure in screen-shares / screenshots), mirroring AWS MFA setup.
  const [qrShown, setQrShown] = useState(false)

  // otpauth URI for authenticator apps (Google Authenticator, Authy, …). Built
  // from the static demo secret + the signed-in email; deterministic (no
  // Date.now/random). The secret is stored with spaces for readability — strip
  // them for the URI.
  const account = userEmail ?? "member@workpulse.app"
  const otpauthUri =
    `otpauth://totp/WorkPulse:${encodeURIComponent(account)}` +
    `?secret=${TOTP_SECRET.replace(/\s/g, "")}` +
    `&issuer=WorkPulse&algorithm=SHA1&digits=6&period=30`

  function verifyMfa() {
    if (otp.length !== 6) return
    setMfaEnabled(true)
    setSetupOpen(false)
    setOtp("")
    setCodesOpen(true)
    toast.success("Multi-factor authentication enabled")
  }

  function disableMfa() {
    setMfaEnabled(false)
    toast.success("Multi-factor authentication turned off")
  }

  function sendResetLink() {
    toast.success(
      `Password reset link sent to ${userEmail ?? "your email"}`,
    )
  }

  function savePassword() {
    if (!pw.current || !pw.next) {
      toast.error("Enter your current and new password")
      return
    }
    if (pw.next.length < 8) {
      toast.error("New password must be at least 8 characters")
      return
    }
    if (pw.next !== pw.confirm) {
      toast.error("New passwords don't match")
      return
    }
    setPw({ current: "", next: "", confirm: "" })
    toast.success("Password updated")
  }

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Security Center"
          description="Authentication, single sign-on, session policies, and security activity."
        />
        <Button
          variant="outline"
          className="shrink-0 gap-1.5"
          onClick={() => toast.success("Security report downloaded")}
        >
          <Download className="size-4" /> Download report
        </Button>
      </div>

      {!canManage && (
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted px-5 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          You can view these settings, but changing them requires the{" "}
          <span className="font-medium text-foreground">Manage Security</span>{" "}
          permission.
        </div>
      )}

      {/* ── At-a-glance overview strip ── */}
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
      <Card id="mfa" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Multi-Factor Authentication</CardTitle>
          <CardDescription>
            Add an extra verification step at sign-in for every member.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Personal enrollment status + setup */}
          {mfaEnabled ? (
            <div className="flex flex-col gap-3 rounded-md bg-success/10 px-4 py-3 sm:flex-row sm:items-center">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                <ShieldCheck className="size-4" />
              </span>
              <p className="text-sm">
                <span className="font-medium">Your account is protected</span> with
                an authenticator app.
              </p>
              <div className="flex shrink-0 flex-wrap gap-2 sm:ml-auto">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setCodesOpen(true)}
                >
                  Recovery codes
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSetupOpen(true)}
                >
                  <RefreshCw className="size-3.5" /> Reconfigure
                </Button>
                <Button size="sm" variant="outline" onClick={disableMfa}>
                  Turn off
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-md bg-warning/10 px-4 py-3 sm:flex-row sm:items-center">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
                <AlertTriangle className="size-4" />
              </span>
              <p className="text-sm">
                <span className="font-medium">Two-step protection is off.</span> Set
                up an authenticator app to secure your account.
              </p>
              <Button
                size="sm"
                className="shrink-0 sm:ml-auto"
                onClick={() => setSetupOpen(true)}
              >
                Set up authenticator
              </Button>
            </div>
          )}

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
      <Card id="sso" className="scroll-mt-24">
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
      <Card id="sessions" className="scroll-mt-24">
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

      {/* ── Change password + active sessions (split view) ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Change your password (personal) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-muted-foreground" />
              Change Password
            </CardTitle>
            <CardDescription>
              Update the password for your own account. Use at least 8 characters.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="cur-pw">Current password</Label>
                  <button
                    type="button"
                    onClick={sendResetLink}
                    className="text-xs font-medium text-primary transition-colors hover:underline"
                  >
                    Forgot?
                  </button>
                </div>
                <Input
                  id="cur-pw"
                  type="password"
                  value={pw.current}
                  onChange={(e) =>
                    setPw((p) => ({ ...p, current: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-pw">New password</Label>
                <Input
                  id="new-pw"
                  type="password"
                  value={pw.next}
                  onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cf-pw">Confirm new password</Label>
                <Input
                  id="cf-pw"
                  type="password"
                  value={pw.confirm}
                  onChange={(e) =>
                    setPw((p) => ({ ...p, confirm: e.target.value }))
                  }
                />
              </div>
              <Button size="sm" onClick={savePassword}>
                Update password
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Active sessions (your devices) */}
        <Card>
          <CardHeader>
            <CardTitle>Active Sessions</CardTitle>
            <CardDescription>
              Devices currently signed in to your account.
            </CardDescription>
          </CardHeader>
          {/* ~3 sessions visible; the rest scroll so the card stays compact. */}
          <CardContent className="max-h-56 space-y-2.5 overflow-y-auto">
            {SESSIONS.map((s) => {
              const Icon = s.icon
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                    <div>
                      <p className="flex items-center gap-2 text-sm font-medium">
                        {s.device}
                        {s.current ? (
                          <span className="rounded-full bg-success/12 px-1.5 py-0.5 text-[10px] font-medium text-success">
                            This device
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.location} · {s.lastActive}
                      </p>
                    </div>
                  </div>
                  {!s.current ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toast.success(`Signed out ${s.device}`)}
                    >
                      Sign out
                    </Button>
                  ) : null}
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

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

      {/* MFA setup dialog */}
      <Dialog
        open={setupOpen}
        onOpenChange={(v) => {
          if (!v) {
            setSetupOpen(false)
            setOtp("")
            setQrShown(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Set up multi-factor authentication</DialogTitle>
            <DialogDescription>
              Scan the QR code with your authenticator app, then enter the
              6-digit code it shows.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Scannable QR, hidden until revealed (it encodes the secret). When
                shown it uses high-contrast literal colours (not theme tokens) so
                it stays white-on-black and scannable in dark mode too. */}
            <div className="flex flex-col items-center gap-2">
              {qrShown ? (
                <button
                  type="button"
                  onClick={() => setQrShown(false)}
                  aria-label="Hide QR code"
                  title="Click to hide"
                  className="rounded-lg border border-border bg-white p-3 transition hover:ring-2 hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
                >
                  <QRCodeSVG
                    value={otpauthUri}
                    size={192}
                    level="M"
                    bgColor="#ffffff"
                    fgColor="#0a0a0a"
                  />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setQrShown(true)}
                  className="flex size-[218px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted hover:text-foreground"
                >
                  <QrCode className="size-8" />
                  <span className="text-sm font-medium">Show QR code</span>
                </button>
              )}
              <p className="text-xs text-muted-foreground">
                {qrShown
                  ? "Scan with Google Authenticator, Authy, or 1Password · click to hide"
                  : "Reveal the code to scan it with your authenticator app."}
              </p>
            </div>

            {/* Manual fallback for anyone who can't scan */}
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-center">
              <p className="text-xs text-muted-foreground">
                Can&apos;t scan? Enter this code manually
              </p>
              <p className="mt-1 font-mono text-sm font-semibold tracking-widest">
                {TOTP_SECRET}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mfa-otp">6-digit code</Label>
              <Input
                id="mfa-otp"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="123456"
                className="tracking-[0.4em]"
              />
            </div>
          </div>
          <DialogFooter showCloseButton>
            <Button onClick={verifyMfa} disabled={otp.length !== 6}>
              Verify &amp; enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recovery codes dialog */}
      <Dialog open={codesOpen} onOpenChange={setCodesOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Recovery codes</DialogTitle>
            <DialogDescription>
              Save these somewhere safe. Each can be used once if you lose your
              device.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {RECOVERY_CODES.map((c) => (
              <code
                key={c}
                className="rounded-md border border-border bg-muted/40 px-2 py-1.5 text-center font-mono text-sm"
              >
                {c}
              </code>
            ))}
          </div>
          <DialogFooter showCloseButton>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard?.writeText(RECOVERY_CODES.join("\n"))
                toast.success("Recovery codes copied")
              }}
            >
              <Copy className="size-4" /> Copy codes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
