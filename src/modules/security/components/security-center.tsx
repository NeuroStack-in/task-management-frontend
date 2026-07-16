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
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Tablet,
  X,
  type LucideIcon,
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
import { users } from "@/lib/data"
import { isIpOrCidr } from "@/lib/validation"
import {
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

// ── Draft / saved model ───────────────────────────────────────────────────────

interface SecurityDraft {
  policies: SecurityPolicies
}

const INITIAL: SecurityDraft = {
  policies: {
    ...SECURITY_DEFAULTS,
    ipAllowlist: [...SECURITY_DEFAULTS.ipAllowlist],
  },
}

function cloneDraft(d: SecurityDraft): SecurityDraft {
  return {
    policies: { ...d.policies, ipAllowlist: [...d.policies.ipAllowlist] },
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

// ── MFA posture ───────────────────────────────────────────────────────────────

/**
 * A member's MFA state, mirroring LLD §2. Read-only by design: MFA is a platform
 * invariant, so there is nothing here for a user or an org to change.
 *
 * `sso` exists because Cognito **cannot** force MFA on a federated identity — those
 * users delegate the check to their IdP. That's an accepted stance, not a gap, so it
 * reads as covered rather than as a warning.
 */
type MfaPosture = "totp" | "sso" | "none"

const MFA_POSTURE_META: Record<
  MfaPosture,
  { icon: typeof ShieldCheck; tone: string; title: string; detail: string }
> = {
  totp: {
    icon: ShieldCheck,
    tone: "success",
    title: "Protected by an authenticator app",
    detail:
      "Set up when you first signed in. Lost your phone? An admin can reset your device.",
  },
  sso: {
    icon: ShieldCheck,
    tone: "success",
    title: "Delegated to your identity provider",
    detail:
      "You sign in through SSO, so your provider performs the check. WorkPulse can't add a second factor on top of it.",
  },
  none: {
    icon: AlertTriangle,
    tone: "warning",
    title: "Not enrolled",
    detail:
      "You'll be prompted to set up an authenticator the next time you sign in.",
  },
}

function MfaPostureRow({ posture }: { posture: MfaPosture }) {
  const meta = MFA_POSTURE_META[posture]
  const Icon = meta.icon
  return (
    <div
      className={cn(
        "flex gap-3 rounded-md px-4 py-3",
        meta.tone === "success" ? "bg-success/10" : "bg-warning/10",
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          meta.tone === "success"
            ? "bg-success/15 text-success"
            : "bg-warning/15 text-warning",
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium">{meta.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{meta.detail}</p>
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

  // Your MFA posture — read-only. Enrollment happens in Cognito's MFA_SETUP challenge at
  // sign-in (LLD §2), not here, so there is no setup flow on this page and nothing to
  // toggle: MFA is a platform invariant, not an org or personal preference.
  // Server-sourced once `/v1/me` carries it; hardcoded to the common case meanwhile.
  const mfaPosture: MfaPosture = "totp"

  // The lost-phone flow — the single MFA action an admin has (LLD §2):
  // `POST /v1/users/{id}/mfa/reset`, perm `security:manage`.
  const [resetMfaOpen, setResetMfaOpen] = useState(false)
  const [resetMfaUserId, setResetMfaUserId] = useState("")

  function confirmResetMfa() {
    const target = users.find((u) => u.id === resetMfaUserId)
    setResetMfaOpen(false)
    setResetMfaUserId("")
    toast.success("Authenticator reset", {
      description: `${target?.name ?? "The member"} will set up a new device at their next sign-in.`,
    })
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

  const { policies } = draft
  const adoptionPct = Math.round(
    (SECURITY_OVERVIEW.mfaEnrolled / SECURITY_OVERVIEW.mfaTotal) * 100,
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title="Security"
          description="Authentication, single sign-on, session policies, and security activity."
        />
        <Button
          variant="outline"
          className="shrink-0 gap-1.5"
          onClick={() => toast.success("Security report downloaded")}
        >
          <Download className="size-4" /> Download
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
      {/*
        MFA is a platform invariant, not an org setting (LLD §2): the Cognito pool
        requires TOTP for password users, with no grace period and nothing org-editable.
        So this card is a **posture view plus one action** — the switches that used to
        live here ("Require MFA", "Enrollment grace period", "Allowed methods") were
        settings for a decision the org doesn't get to make.

        Enrollment isn't here either: it happens in Cognito's MFA_SETUP challenge at
        invite-accept / first sign-in, not on a settings page you have to know to visit.
      */}
      <Card id="mfa" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Multi-Factor Authentication</CardTitle>
          <CardDescription>
            Required for every member who signs in with a password. Managed by the
            platform — there is nothing to configure.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Your own posture — read-only. */}
          <MfaPostureRow posture={mfaPosture} />

          {/* Org posture — read-only. */}
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
            <p className="text-xs text-muted-foreground">
              Members who sign in through SSO are counted as covered — their identity
              provider performs the check.
            </p>
          </div>

          {/* The one action (LLD §2): the lost-phone flow. */}
          {canManage ? (
            <SettingRow
              label="Reset a member's authenticator"
              description="Clears their current device so they can re-enrol at next sign-in. Use this when someone loses their phone."
            >
              <Button
                size="sm"
                variant="outline"
                onClick={() => setResetMfaOpen(true)}
              >
                <RefreshCw className="size-3.5" /> Reset device
              </Button>
            </SettingRow>
          ) : null}
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

      {/*
        The lost-phone flow — the only MFA action in the product (LLD §2). There is no
        setup dialog here any more: enrollment is Cognito's MFA_SETUP challenge at
        sign-in, and MFA is a platform invariant, so an org can neither require it nor
        waive it. Recovery codes went with it — resetting the device IS the recovery
        path, and it is the one an admin can actually audit.
      */}
      <Dialog open={resetMfaOpen} onOpenChange={setResetMfaOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset authenticator</DialogTitle>
            <DialogDescription>
              Clears the member&apos;s current device. They will set up a new
              authenticator the next time they sign in. This is logged to the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Member</p>
            <Select value={resetMfaUserId || undefined} onValueChange={(v) => setResetMfaUserId(v as string)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a member…" />
              </SelectTrigger>
              <SelectContent>
                {users.slice(0, 40).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} · {u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter showCloseButton>
            <Button disabled={!resetMfaUserId} onClick={confirmResetMfa}>
              <RefreshCw className="size-4" /> Reset device
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
