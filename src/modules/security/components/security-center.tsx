"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  KeyRound,
  Lock,
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
import { usePermissions } from "@/hooks/use-permissions"
import { resetMfaDevice } from "../services/security.service"
import { SecurityEventsFeed } from "./security-events-feed"
import { listAllEmployees } from "@/modules/employees/services/employees.service"
import { cn } from "@/lib/utils"
import { ApiError } from "@/lib/api"
import { PASSWORD_MIN } from "@/lib/password"

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

/**
 * Settings → Security — **organisation security only** (UX audit 2026-10-16, SET-08).
 *
 * It used to mix the reader's own sign-in (their authenticator, password and sessions — the same
 * components Login & security renders) with the platform policies, because Owner/Admin had no
 * Login & security entry in their rail. Every role has that page now, so this one holds what applies
 * to everyone: the MFA policy and the lost-phone reset, session lifetimes, the password policy, and
 * security events.
 */
export function SecurityCenter() {
  const { can } = usePermissions()
  const canManage = can("security:manage")

  // The lost-phone flow — the single MFA action an admin has (LLD §2):
  // `POST /v1/users/{id}/mfa/reset`, perm `security:manage`.
  const [resetMfaOpen, setResetMfaOpen] = useState(false)
  const [resetMfaUserId, setResetMfaUserId] = useState("")
  const [resetting, setResetting] = useState(false)

  // The real employee roster for the MFA-reset picker.
  const [roster, setRoster] = useState<{ id: string; name: string }[]>([])
  const [rosterError, setRosterError] = useState(false)

  // Roster for the MFA-reset picker loads only when an admin opens the dialog.
  useEffect(() => {
    if (!resetMfaOpen || roster.length) return
    let live = true
    setRosterError(false)
    listAllEmployees()
      .then((r) => {
        // Only people who can sign in: a monitored (login-less) employee or a deactivated one has
        // no authenticator, and the server still answers "reset" for them (WP-329).
        if (live)
          setRoster(
            r
              .filter((e) => e.login !== "none" && e.status === "active")
              .map((e) => ({ id: e.user_id, name: e.name })),
          )
      })
      // A failed roster read said "Loading members…" forever (WP-339).
      .catch(() => {
        if (live) setRosterError(true)
      })
    return () => {
      live = false
    }
  }, [resetMfaOpen, roster.length])

  async function confirmResetMfa() {
    const target = roster.find((u) => u.id === resetMfaUserId)
    setResetting(true)
    try {
      await resetMfaDevice(resetMfaUserId)
      // What the reset really does: it turns the member's TOTP off. The pool doesn't enforce MFA,
      // so nothing makes them re-enrol — it said they "will set up a new device" (WP-329).
      toast.success("Authenticator reset", {
        description: `${target?.name ?? "The member"} can now sign in with their password alone, until they set up a new authenticator themselves.`,
      })
      setResetMfaOpen(false)
      setResetMfaUserId("")
    } catch (e) {
      // Say which failure it was — "try again" is wrong advice for a permission or a missing member.
      const status = e instanceof ApiError ? e.status : 0
      toast.error(
        status === 403
          ? "You don't have permission to reset this member's authenticator."
          : status === 404
            ? "That member couldn't be found — they may have been removed."
            : "Couldn't reset the authenticator. Check your connection and try again.",
      )
    } finally {
      setResetting(false)
    }
  }

  /** Closing the dialog forgets the choice: reopening it later to reset someone else must not find
   *  the last member pre-selected, one click from losing their MFA (WP-339). */
  function onResetMfaOpenChange(open: boolean) {
    setResetMfaOpen(open)
    if (!open) setResetMfaUserId("")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security"
        description="Security for the whole organization: the policies that apply to every member, resetting a member's authenticator, and security events."
      />

      {/* Where the reader's own sign-in went (SET-08). */}
      <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground">
        <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          Your own authenticator, password and signed-in browsers are in{" "}
          <Link
            href="/settings/login-security"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Login &amp; security
          </Link>
          .
        </span>
      </p>

      {!canManage && (
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted px-5 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          You can view these settings, but resetting a member&apos;s authenticator requires the{" "}
          <span className="font-medium text-foreground">Manage security &amp; audit</span>{" "}
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

        Your own enrolment control is on Login & security, which every role's rail now lists
        (UX audit SET-08) — it used to be embedded here because Owner/Admin had no such entry.
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
            password. Each member manages their own authenticator under{" "}
            <Link
              href="/settings/login-security#mfa"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Login &amp; security
            </Link>
            . It can&apos;t yet be made mandatory for the whole organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* The one action (LLD §2): the lost-phone flow. */}
          {canManage ? (
            <SettingRow
              label="Reset a member's authenticator"
              description="Turns off their authenticator, so they can sign in with their password and set up a new one. Use this when someone loses their phone."
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
            Session lifetimes are fixed by the platform and apply to every member.
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

      {/* Your own password is on Login & security for every role now (SET-08). */}

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
            <PlatformFixed value={`${PASSWORD_MIN} characters`} />
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

      {/* ── Security events ── */}
      {/*
        Real, from GET /v1/security-events (identity, LLD §15) — the audit trail pre-filtered
        to the `security` category. The route requires `security:manage` (same bit as the MFA
        reset above), and so does the audit log (`audit-logs:view` rides the same bit), so the
        feed renders only for managers. Viewers used to get a "View audit logs" button that could
        only ever land on Access denied, under copy claiming sign-ins and permission changes are
        recorded — they are not (QA audit 2026-10-08, WP-516, WP-336).
      */}
      {canManage ? (
        <SecurityEventsFeed />
      ) : (
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Security activity</CardTitle>
          <CardDescription>
            Authenticator resets, ownership changes and device events are recorded in the audit
            log.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <ShieldCheck className="size-4" />
            </span>
            <p className="text-xs text-muted-foreground">
              The security event feed and the audit log are open to members with the{" "}
              <span className="font-medium text-foreground">Manage security &amp; audit</span>{" "}
              permission.
            </p>
          </div>
        </CardContent>
      </Card>
      )}

      {/*
        The lost-phone flow — the only admin MFA action in the product (LLD §2). The pool is
        `Mfa.OPTIONAL` and sign-in refuses an MFA_SETUP challenge, so a reset can't force anyone to
        re-enrol: it turns the member's TOTP off, and setting up a new one is up to them.
      */}
      <Dialog open={resetMfaOpen} onOpenChange={onResetMfaOpenChange}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset authenticator</DialogTitle>
            <DialogDescription>
              Turns off multi-factor authentication for this member. They&apos;ll sign in with
              their password alone until they set up a new authenticator themselves — nothing
              prompts them to. This is recorded in the audit log.
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
                <SelectValue
                  placeholder={
                    roster.length
                      ? "Select a member…"
                      : rosterError
                        ? "Couldn't load members — close and reopen to retry"
                        : "Loading members…"
                  }
                />
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
