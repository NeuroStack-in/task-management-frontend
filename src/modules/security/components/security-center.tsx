"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ArrowUpRight,
  Lock,
  Monitor,
  RefreshCw,
  ShieldCheck,
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
import { MfaCard } from "@/modules/settings/components/mfa-card"
import { PasswordCard } from "@/modules/settings/components/password-card"
import { usePermissions } from "@/hooks/use-permissions"
import { useDeviceId } from "@/hooks/use-device-id"
import { resetMfaDevice } from "../services/security.service"
import { useSessions } from "../use-sessions"
import { SecurityEventsFeed } from "./security-events-feed"
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
 * says the truer thing: nobody can, at any tier. Values mirror `infra/stacks/auth_stack.py`.
 */
function PlatformFixed({ value }: { value: string }) {
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap text-sm tabular-nums text-muted-foreground">
      <Lock className="size-3.5 shrink-0" aria-hidden />
      {value}
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function SecurityCenter() {
  const { can } = usePermissions()
  const canManage = can("security:manage")

  // The lost-phone flow — the single MFA action an admin has (LLD §2):
  // `POST /v1/users/{id}/mfa/reset`, perm `security:manage`.
  const [resetMfaOpen, setResetMfaOpen] = useState(false)
  const [resetMfaUserId, setResetMfaUserId] = useState("")
  const [resetting, setResetting] = useState(false)

  // Real sessions (GET /v1/me/sessions) + the real employee roster for the MFA-reset picker.
  const { sessions, loading: sessionsLoading, error: sessionsError, reload: reloadSessions } =
    useSessions()
  // "This device" is the row matching THIS browser's stable id; fall back to the newest when it
  // isn't among them yet (heartbeat not landed / storage blocked) so the badge always marks a row.
  const deviceId = useDeviceId()
  const currentIdx = deviceId ? sessions.findIndex((s) => s.session_id === deviceId) : -1
  const thisDeviceIdx = currentIdx >= 0 ? currentIdx : 0
  const [roster, setRoster] = useState<{ id: string; name: string }[]>([])

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security"
        description="Authentication, sessions, and the platform policies that protect every account."
      />

      {!canManage && (
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted px-5 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          You can view these settings, but resetting a member&apos;s authenticator requires the{" "}
          <span className="font-medium text-foreground">Manage Security</span>{" "}
          permission.
        </div>
      )}

      {/* ── Multi-factor authentication ── */}
      {/*
        MFA is **optional and user-managed** — the Cognito pool enforces nothing (it is
        `Mfa.OPTIONAL`), so nobody is required to hold TOTP. This card is therefore your own
        enrolment control plus one admin action (the lost-phone reset). There is deliberately no
        "Require MFA" / "grace period" / "adoption %" widget: the first two are enforcement that
        doesn't exist, and the third is a number the backend doesn't return.

        Owner/Admin have no personal /settings/login-security entry in the rail, so without the
        enrolment control here they had no way to turn their own MFA on at all.
      */}
      <Card id="mfa" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Multi-Factor Authentication</CardTitle>
          <CardDescription>
            {/* MFA is OPTIONAL and user-managed (product decision 2026-07-23): members enrol,
                disable, and re-enrol their own authenticator under Settings → Login & security.
                The pool enforces nothing; don't reintroduce "required" copy here without also
                building the enforcement. */}
            Optional and strongly recommended for every member who signs in with a
            password. Each member manages their own authenticator under Settings →
            Login &amp; security.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Your own authenticator — status + enrol/turn off. Shared with the personal Security
              page so the two can't drift (modules/settings/components/mfa-card). */}
          <MfaCard embedded />

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

      {/* ── Session & access ── */}
      {/*
        Session lifetimes are Cognito pool-level and platform-fixed (LLD §15). The IP
        allowlist the mock let you edit has no backing route (deferred §15), so it's shown
        as a planned capability rather than a control that silently saves nowhere.
      */}
      <Card id="sessions" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Session &amp; Access</CardTitle>
          <CardDescription>
            Session lifetimes are fixed by the platform. Your active sessions are listed
            below.
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
            description="A member can be signed in on as many devices as they need."
          >
            <PlatformFixed value="Unlimited" />
          </SettingRow>
          <SettingRow
            label="IP allowlist"
            description="Restricting web sign-in to specific IP ranges is planned (§15) and isn't enforced yet."
          >
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Planned
            </span>
          </SettingRow>
        </CardContent>
      </Card>

      {/* Your own password — change it, or reset by an emailed code. Owner/Admin have no separate
          personal security page, so their own credentials live here, next to the org policy that
          governs them. Employees get the same card on /settings/login-security. */}
      <PasswordCard />

      {/* ── Password policy (platform-fixed, read-only) ── */}
      {/*
        The Cognito pool password policy, shown read-only (LLD §15). Values mirror
        `infra/stacks/auth_stack.py` — if that changes, change these. Rotation is absent
        rather than shown: the pool doesn't implement it and NIST 800-63B advises against
        it, so there is nothing to display.
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

      {/* ── Active sessions (your devices) — real, lean, read-only ── */}
      <Card>
        <CardHeader>
          <CardTitle>Active Sessions</CardTitle>
          <CardDescription>
            Devices signed in to your account. Location isn&apos;t recorded, and per-session
            sign-out isn&apos;t available yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {sessionsLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading sessions…</p>
          ) : sessionsError ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <p className="text-sm text-muted-foreground">{sessionsError}</p>
              <Button variant="outline" size="sm" onClick={reloadSessions}>
                Retry
              </Button>
            </div>
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
                      {s.user_agent || "Web session"}
                      {i === thisDeviceIdx ? (
                        <span className="rounded-full bg-success/12 px-1.5 py-0.5 text-[10px] font-medium text-success">
                          This device
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

      {/* ── Security events ── */}
      {/*
        Real, from GET /v1/security-events (identity, LLD §15) — the audit trail pre-filtered
        to the `security` category. The route requires `security:manage` (same bit as the MFA
        reset above), so the live feed renders only for managers; viewers keep the link-out
        card so the page stays honest instead of showing a guaranteed 403.
      */}
      {canManage ? (
        <SecurityEventsFeed />
      ) : (
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Security activity</CardTitle>
          <CardDescription>
            Sign-ins, MFA changes, and policy updates are recorded in the audit log.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                <ShieldCheck className="size-4" />
              </span>
              <div>
                <p className="text-sm font-medium">
                  Every security event is written to the audit trail
                </p>
                <p className="text-xs text-muted-foreground">
                  Sign-ins, authenticator resets, and permission changes, with the actor
                  and time.
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
      )}

      {/*
        The lost-phone flow — the only MFA action in the product (LLD §2). Enrollment is
        Cognito's MFA_SETUP challenge at sign-in, and MFA is a platform invariant, so an
        org can neither require it nor waive it. Resetting the device IS the recovery path,
        and it is the one an admin can actually audit.
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
            <Select
              value={resetMfaUserId || null}
              onValueChange={(v) => setResetMfaUserId(v as string)}
              items={Object.fromEntries(roster.map((u) => [u.id, u.name]))}
            >
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
