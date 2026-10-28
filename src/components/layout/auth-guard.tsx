"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { useEntitlementsSync } from "@/hooks/use-features";
import { getDeviceId, deviceLabel } from "@/lib/device";
import { heartbeatSession } from "@/modules/security/services/security.service";
import { useIsOpsOnly } from "@/modules/ops/use-platform-admin";
import { Loader } from "@/components/shared/loader";

/**
 * Client-side session protection (TDD §9). Waits for the persisted auth store to
 * hydrate, redirects unauthenticated users to /login, org-less accounts to onboarding
 * and platform operators to the support desk — all before the app shell mounts.
 *
 * Per-route access (permission, plan, toggles, tracking mode) is `RouteGate`'s job, inside
 * the shell, so a closed page keeps the sidebar and top bar (UX audit XC-02 / SHELL-01).
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // A signed-in user with no organization yet (the "Continue with Google" self-signup) has nothing to
  // see in the app shell — send them to the standalone onboarding flow to create their org first.
  const hasOrg = useAuthStore((s) => Boolean(s.user?.organizationId));

  // Load the org's entitlements once there's a session — the sidebar and RouteGate read the
  // result. This is the first point inside the authenticated tree, so everything downstream has it.
  // Only with an organisation: an org-less account has no entitlements, and the server now refuses
  // it every org route but onboarding (403 org_required — WP-135). The read starts the moment the
  // org is approved and the claims refresh.
  useEntitlementsSync(hydrated && isAuthenticated && hasOrg);

  // A dedicated platform-support operator has no customer console at all — it is not a member of the
  // tenant its login happens to be minted in. Hiding the nav and redirecting the dashboard isn't
  // enough: /settings and other member-readable pages still answer to a typed URL, which would leak
  // the host org's details. Bounce the operator off every non-/ops route, the same way features and
  // hidden pages are closed here rather than only in the sidebar. The lookup runs only once there is
  // a session — it used to fire for signed-out visitors on their way to sign-in.
  //
  // It runs for org-less accounts too: a support operator created outside every organization has no
  // org, and was sent to "create your organization" before this was asked (2026-10-28).
  const { opsOnly, undecided: opsUndecided } = useIsOpsOnly(hydrated && isAuthenticated);
  const isOpsRoute = pathname === "/ops" || pathname.startsWith("/ops/");

  useEffect(() => {
    if (hydrated && !isAuthenticated) {
      // The query string too (`?tab=`, filters), so signing back in lands where they were rather than
      // on the bare page (QA audit 2026-10-08, WP-465). `safeLandingPath` keeps a same-origin query.
      const from = `${pathname}${window.location.search}`;
      router.replace(`/login?from=${encodeURIComponent(from)}`);
    }
  }, [hydrated, isAuthenticated, pathname, router]);

  useEffect(() => {
    // Not until the allowlist has answered: an org-less operator belongs on the support desk.
    if (hydrated && isAuthenticated && !hasOrg && !opsOnly && !opsUndecided) {
      router.replace("/onboarding");
    }
  }, [hydrated, isAuthenticated, hasOrg, opsOnly, opsUndecided, router]);

  useEffect(() => {
    if (hydrated && isAuthenticated && opsOnly && !isOpsRoute) {
      router.replace("/ops/support");
    }
  }, [hydrated, isAuthenticated, opsOnly, isOpsRoute, router]);

  // Record THIS browser as a session — one row per device, keyed by a stable localStorage id
  // (lib/device.ts) — so Security → Sessions lists real devices instead of a fresh "Web session" on
  // every hourly token refresh. Fires once the session is real (signed in, has an org); best-effort,
  // so a failure never touches rendering.
  useEffect(() => {
    if (!(hydrated && isAuthenticated && hasOrg)) return;
    const id = getDeviceId();
    if (!id) return; // SSR, or storage blocked in a private window — skip silently
    void heartbeatSession(id, deviceLabel()).catch(() => {});
  }, [hydrated, isAuthenticated, hasOrg]);

  if (!hydrated || !isAuthenticated) {
    return <Loader label="Loading your organization…" />;
  }

  // No org: an operator on a support page gets it (DashboardShell renders the lean operator frame);
  // everyone else waits for the onboarding or support-desk redirect without a flash of the shell.
  if (!hasOrg && !(opsOnly && isOpsRoute)) {
    return <Loader label={opsUndecided ? "Checking access…" : "Setting up your account…"} />;
  }

  // Don't paint a customer page for an operator account even for the tick before the redirect lands
  // — nor while the allowlist lookup that would say so is still out. The guard ignored that loading
  // state, so an operator typing /settings/company saw the host org's details until it answered
  // (WP-465). Only an account with no customer permission of its own ever waits here.
  if (opsOnly && !isOpsRoute) {
    return <Loader label="Opening the support desk…" />;
  }
  if (opsUndecided && !isOpsRoute) {
    return <Loader label="Checking access…" />;
  }

  return <>{children}</>;
}
