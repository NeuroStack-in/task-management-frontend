"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowUpRight,
  KeyRound,
  Lock,
  Monitor,
  Plus,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react"
import { toast } from "sonner"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { PageHeader } from "@/components/shared/page-header"
import { SettingsSaveBar } from "@/components/shared/settings-save-bar"
import { usePermissions } from "@/hooks/use-permissions"
import { useAuthStore } from "@/stores/auth.store"
import { isIpOrCidr } from "@/lib/validation"
import { Loader } from "@/components/shared/loader"
import { useSecurityEvents } from "@/modules/security/use-security-events"
// `SECURITY_EVENTS`, `SECURITY_OVERVIEW` and `SSO_CONNECTION` were dropped — see the comments at
// their former render sites. `SECURITY_DEFAULTS` stays: the session/password policy editors are
// still local-only (LLD §15 IP allowlist + per-session revoke are the blocked backend work).
import { SECURITY_DEFAULTS, type SecurityPolicies } from "@/lib/mock-security"
import {
  listMySessions,
  resetMfaDevice,
  type ApiSession,
} from "../services/security.service"
import { listEmployees } from "@/modules/employees/services/employees.service"
import { cn } from "@/lib/utils"

// ── Active sessions (your signed-in devices) ──────────────────────────────────
// Real, from GET /v1/me/sessions — {session_id, last_seen} only. Cognito gives no device / IP /
// location without its paid tier, and there is no per-session revoke endpoint (§15), so the list is
// intentionally lean and read-only.

/** Epoch ms → a short relative label. */
function timeAgo(ms: number | null): string {
  if (!ms) return "Unknown"
  const diff = Date.now() - ms
  if (diff < 0) return "Just now"
  const min = Math.floor(diff / 60_000)
  if (min < 1) return "Active now"
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const d = Math.floor(hr / 24)
  return d === 1 ? "Yesterday" : `${d}d ago`
}

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

/**
 * A platform-fixed value: shown, never edited.
 *
 * Session lifetimes and the password policy are Cognito **pool-level** (LLD §15) — they
 * cannot vary per org, so an editor for them is a promise the product can't keep. A
 * disabled input would imply "you could change this with the right permission"; this
 * says the truer thing: nobody can, at any tier.
 */
function PlatformFixed({ value }: { value: string }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap text-sm tabular-nums text-muted-foreground">
      <Lock className="size-3.5 shrink-0" aria-hidden />
      {value}
    </span>
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
  const securityEvents = useSecurityEvents()

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
  const [resetting, setResetting] = useState(false)

  // Real sessions (GET /v1/me/sessions) + the real employee roster for the MFA-reset picker.
  const [sessions, setSessions] = useState<ApiSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [roster, setRoster] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    let live = true
    listMySessions()
      .then((s) => {
        if (live) setSessions([...s].sort((a, b) => (b.last_seen ?? 0) - (a.last_seen ?? 0)))
      })
      .catch(() => {
        /* an empty session list is the honest failure — never invent devices */
      })
      .finally(() => {
        if (live) setSessionsLoading(false)
      })
    return () => {
      live = false
    }
  }, [])

  // Roster for the MFA-reset picker loads only when an admin opens the dialog.
  useEffect(() => {
    if (!resetMfaOpen || roster.length) return
    let live = true
    listEmployees()
      .then((r) => {
        if (live) setRoster(r.map((e) => ({ id: e.user_id, name: e.name })))
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [resetMfaOpen, roster.length])

  async function confirmResetMfa() {
    const target = roster.find((u) => u.id === resetMfaUserId)
    setResetting(true)
    try {
      await resetMfaDevice(resetMfaUserId)
      toast.success("Authenticator reset", {
        description: `${target?.name ?? "The member"} will set up a new device at their next sign-in.`,
      })
      setResetMfaOpen(false)
      setResetMfaUserId("")
    } catch {
      toast.error("Couldn't reset the authenticator. Try again.")
    } finally {
      setResetting(false)
    }
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security"
        description="Authentication, session policies, and security activity."
      />
      {/*
        The at-a-glance strip that used to sit here ("Security score 82/100", "MFA adoption",
        "Active sessions", "Open alerts") was entirely invented by `mock-security`. None of the four
        has a server source:
          · security score  — no such concept exists anywhere in the backend
          · MFA adoption    — Cognito exposes no per-user enrolment status without its paid
                              advanced-security tier, so enrolled/total is unknowable
          · active sessions — `/v1/me/sessions` returns **your own** sessions, never the org's
          · open alerts     — security events carry no severity, so nothing can be "open"
        A fabricated security posture next to a real session list is worse than no posture at all:
        the user cannot tell which half to trust. It is removed rather than zeroed.
      */}

      {!canManage && (
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted px-5 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          You can view these settings, but changing them requires the{" "}
          <span className="font-medium text-foreground">Manage Security</span>{" "}
          permission.
        </div>
      )}

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

          {/*
            An "organization enrollment X/Y" bar sat here on invented numbers. Cognito does not
            expose per-user MFA enrolment without its paid advanced-security tier, so the org's
            adoption rate is genuinely unknowable from here — stating it honestly beats a progress
            bar that always looks reassuring.
          */}
          <p className="rounded-md bg-muted/50 p-4 text-xs text-muted-foreground">
            Organization-wide enrollment figures aren&apos;t available — the identity provider
            doesn&apos;t expose per-member MFA status. Your own posture is shown above.
          </p>

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

      {/*
        ── Single sign-on: REMOVED, and it should stay removed until the feature exists ──

        This card previously rendered a "Connected" badge over a fabricated SAML connection —
        provider, verified domain, sign-on URL, entity id, certificate expiry, and a SHA-256
        certificate fingerprint, all invented by `mock-security`. It also offered "Enforce SSO for
        all members" and "SCIM provisioning" switches.

        Enterprise SSO is **proposed and not approved** (backend `WorkPulse-SSO.md`): it was cut by
        the LLD, revived as a proposal, and still gates on backend review because JIT provisioning
        would amend the invite-only identity invariant. The backend's `plans.rs` carries a test
        asserting `security.sso` must NOT exist as a feature key precisely so nobody can toggle a
        feature that isn't built. There are no `/v1/security/sso/*` routes.

        Showing an admin a fingerprint for a connection that does not exist is the most dangerous
        kind of mock: it invites them to believe SSO is enforcing sign-in when password auth is the
        only path. Do not restore this card from the mock — restore it from a real connection.

        (Google/Microsoft as a *login credential* is a separate, approved thing — see `SsoButtons`
        on the auth screens. That is not this.)
      */}

      {/*
        Session lifetimes are Cognito pool-level and platform-fixed (LLD §15) — per-org
        lifetimes aren't cleanly possible, so the editors that used to live here were
        controls for a decision the org doesn't get to make. Shown read-only instead of
        deleted: an admin asking "how long is a session?" deserves an answer, and silence
        reads as an oversight.

        "Remember this device" is gone rather than shown: it skipped MFA on trusted
        devices, and MFA is a hard invariant with no waiver (LLD §2). It wasn't a stale
        default — it was a switch to bypass something that cannot be bypassed.

        The session FEATURE is the active-sessions list + revoke, which is right below.
      */}
      <Card id="sessions" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Session & Access</CardTitle>
          <CardDescription>
            Session lifetimes are fixed by the platform. Restrict where members can sign
            in from, and revoke any session below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0 pb-2">
          <SettingRow
            label="Session lifetime"
            description="Access and ID tokens expire after 15 minutes; a session refreshes silently until the refresh token expires."
          >
            <PlatformFixed value="15 min · 30 days" />
          </SettingRow>
          <SettingRow
            label="Concurrent sessions"
            description="A member can be signed in on as many devices as they need. Revoke any of them from the list below."
          >
            <PlatformFixed value="Unlimited" />
          </SettingRow>
          <div className="py-4 [&+&]:border-t">
            <Label className="text-sm font-medium">IP allowlist</Label>
            <p className="mt-0.5 mb-3 text-xs text-muted-foreground">
              Restrict sign-in to these IP addresses or CIDR ranges. Web only — the
              desktop agent is exempt by design, so remote and offline workers keep
              recording.
            </p>
            <IpAllowlist
              items={policies.ipAllowlist}
              onChange={(v) => updatePolicy({ ipAllowlist: v })}
              canManage={canManage}
            />
          </div>
        </CardContent>
      </Card>

      {/*
        The Cognito pool password policy, platform-fixed and shown read-only (LLD §15).
        The values here mirror `infra/stacks/auth_stack.py` — if that changes, change
        these. Read-only rather than deleted: "what are the password rules?" is a fair
        question, and an admin who can't answer it can't answer their members either.

        Rotation is gone rather than shown as a value: it was a scheduled prompt to
        change passwords, which NIST 800-63B advises against (it drives predictable
        increments), and the pool doesn't implement it. There is nothing to display.
      */}
      <Card>
        <CardHeader>
          <CardTitle>Password Policy</CardTitle>
          <CardDescription>
            Set by the platform and applied to every member. Not org-configurable.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0 pb-2">
          <SettingRow
            label="Minimum length"
            description="Passwords shorter than this are rejected at sign-up and at change."
          >
            <PlatformFixed value="12 characters" />
          </SettingRow>
          <SettingRow
            label="Required characters"
            description="Upper-case, lower-case, and a number. Symbols are allowed but not required — length does more for strength than forced punctuation."
          >
            <PlatformFixed value="A · a · 0" />
          </SettingRow>
          <SettingRow
            label="Account recovery"
            description="Members reset their own password by email. There is no admin-set password."
          >
            <PlatformFixed value="Email" />
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

        {/* Active sessions (your devices) — real, lean, read-only */}
        <Card>
          <CardHeader>
            <CardTitle>Active Sessions</CardTitle>
            <CardDescription>
              Sessions signed in to your account. Device and location aren&apos;t recorded, and
              per-session sign-out isn&apos;t available yet.
            </CardDescription>
          </CardHeader>
          {/* ~3 sessions visible; the rest scroll so the card stays compact. */}
          <CardContent className="max-h-56 space-y-2.5 overflow-y-auto">
            {sessionsLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading sessions…</p>
            ) : sessions.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No active sessions recorded.
              </p>
            ) : (
              sessions.map((s, i) => (
                <div
                  key={s.session_id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Monitor className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        Web session
                        {i === 0 ? (
                          <span className="rounded-full bg-success/12 px-1.5 py-0.5 text-[10px] font-medium text-success">
                            Most recent
                          </span>
                        ) : null}
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {s.session_id}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {timeAgo(s.last_seen)}
                  </span>
                </div>
              ))
            )}
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
        <CardContent className="space-y-4">
          {/*
            Live from `GET /v1/security-events`. The "N flagged events in the last 7 days" banner
            that used to sit here counted mock rows by a `severity` field the server does not have —
            there is no risk classification on an audit row, so nothing can be flagged.
          */}
          {securityEvents.forbidden ? (
            <p className="text-sm text-muted-foreground">
              Viewing the security event trail requires the Manage Security permission.
            </p>
          ) : securityEvents.error ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{securityEvents.error}</p>
              <Button variant="outline" size="sm" onClick={securityEvents.reload}>
                Retry
              </Button>
            </div>
          ) : securityEvents.loading ? (
            <Loader label="Loading security activity…" />
          ) : securityEvents.events.length === 0 ? (
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-success/12 text-success">
                <ShieldCheck className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">No security activity recorded</p>
                <p className="text-xs text-muted-foreground">
                  Sign-ins, MFA resets, and role changes appear here as they happen.
                </p>
              </div>
            </div>
          ) : (
            <ul className="divide-y rounded-lg border">
              {securityEvents.events.slice(0, 8).map((e) => (
                <li key={e.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{e.action}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {e.actorName}
                      {e.target ? ` · ${e.target}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {e.timestamp}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex justify-end">
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
                <SelectValue placeholder={roster.length ? "Select a member…" : "Loading members…"} />
              </SelectTrigger>
              <SelectContent>
                {roster.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter showCloseButton>
            <Button disabled={!resetMfaUserId || resetting} onClick={confirmResetMfa}>
              <RefreshCw className="size-4" /> {resetting ? "Resetting…" : "Reset device"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
