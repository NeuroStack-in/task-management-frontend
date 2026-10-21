"use client";

import Link from "next/link";
import { Building2, Laptop } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { usePermissions } from "@/hooks/use-permissions";
import { SessionsList } from "@/modules/security/components/sessions-list";
import { MfaCard } from "./mfa-card";
import { PasswordCard } from "./password-card";

/**
 * **Login & security** — your own sign-in, for every role (/settings/login-security).
 *
 * Personal and organisation security used to be tangled (UX audit 2026-10-16, SET-08): Owner/Admin
 * had no entry here, so their own authenticator, password and sessions sat inside the org Security
 * page beside the platform policies, while employees got the same three controls on this page — two
 * pages rendering the same components, and global search sending owners to a page their rail didn't
 * list. Now this page is the one place for *your* sign-in, in every rail, and Settings → Security
 * holds only what applies to the whole organisation.
 */
export function AccountSecuritySettings() {
  const { can } = usePermissions();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Login & security"
        description="Your own sign-in: multi-factor authentication, your password, and where you're signed in."
      />

      {/* `id`s so global search and notifications can land on the exact card. */}
      <div id="mfa" className="scroll-mt-24">
        <MfaCard />
      </div>

      {/* Password + your sessions, side by side on large screens. */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div id="password" className="scroll-mt-24">
          <PasswordCard />
        </div>

        {/* The list itself is the shared `SessionsList` (security module, UX audit SET-18). */}
        <Card id="sessions" className="scroll-mt-24">
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center gap-2">
              <Laptop className="size-4 text-muted-foreground" aria-hidden />
              <h2 className="font-medium">Your sessions</h2>
            </div>
            <p className="-mt-1 text-sm text-muted-foreground">
              Browsers signed in to your account. Signing one out from here isn&apos;t available
              yet.
            </p>
            <SessionsList />
          </CardContent>
        </Card>
      </div>

      {/* Where the organization's side lives, for the roles that have it. */}
      {can("security:view") ? (
        <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground">
          <Building2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Security for the whole organization — the password policy, session lifetimes,
            resetting a member&apos;s authenticator and security events — is in{" "}
            <Link
              href="/settings/security"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Settings → Security
            </Link>
            .
          </span>
        </p>
      ) : null}
    </div>
  );
}
