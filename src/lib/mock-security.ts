/**
 * Static dummy data for the Security Center.
 * Deterministic — no Math.random() / Date.now(). Phase 1 is frontend-only.
 */

/**
 * What an org can actually configure about security (LLD §15) — and it's a short list.
 *
 * MFA, session lifetimes, and the password policy are **Cognito pool-level and
 * platform-fixed**: they can't vary per org, so they were removed from this model rather
 * than merely hidden. Leaving them here would be an invitation to rebuild the editors —
 * a settings model is a promise about what's settable.
 *
 * Gone, and why:
 *  - `mfaRequired` / `mfaGraceDays` — MFA is a hard invariant, no grace, nothing to opt
 *    out of (LLD §2). The grace was modelled on a rule the LLD had already superseded.
 *  - `sessionTimeoutMins` / `maxConcurrentSessions` / `rememberDeviceDays` — pool-level.
 *    `rememberDeviceDays` skipped MFA on trusted devices, which the invariant forbids.
 *  - `passwordMinLength` / `passwordComplexity` / `passwordRotationDays` — pool policy.
 *    Rotation isn't implemented anywhere, and NIST 800-63B advises against it.
 *
 * The Security Center shows all of the above **read-only**, sourced from
 * `infra/stacks/auth_stack.py`. What's left below is genuinely org-owned.
 */
export interface SecurityPolicies {
  /** SSO enforcement — PROPOSED (`backend/WorkPulse-SSO.md`), not yet real. */
  ssoEnforced: boolean
  /** SCIM — PROPOSED, that design's Phase 4. */
  scimEnabled: boolean
  /** Org-configurable, web-only; the agent ingest route is exempt by design (LLD §15). */
  ipAllowlist: string[]
}

export const SECURITY_DEFAULTS: SecurityPolicies = {
  ssoEnforced: false,
  scimEnabled: true,
  ipAllowlist: ["203.0.113.0/24", "198.51.100.42"],
}

export interface SsoConnection {
  provider: string
  protocol: string
  status: "connected" | "disconnected"
  domain: string
  ssoUrl: string
  entityId: string
  certificateFingerprint: string
  certificateExpires: string
  lastLogin: string
}

export const SSO_CONNECTION: SsoConnection = {
  provider: "Okta",
  protocol: "SAML 2.0",
  status: "connected",
  domain: "acme.test",
  ssoUrl: "https://acme.okta.com/app/workpulse/exk1f/sso/saml",
  entityId: "http://www.okta.com/exk1fABCDEF2GHIJ",
  certificateFingerprint: "9B:2A:7C:5D:18:E0:44:A1:F3:6C:90:2B:7E:11:CD:E4",
  certificateExpires: "2027-03-14",
  lastLogin: "2026-06-25 08:14",
}

export type SecurityEventStatus = "success" | "blocked" | "flagged"
export type SecurityEventType = "login" | "mfa" | "password" | "sso" | "policy"

export interface SecurityEvent {
  id: string
  event: string
  type: SecurityEventType
  user: string
  ip: string
  location: string
  time: string
  status: SecurityEventStatus
}

export const SECURITY_EVENTS: SecurityEvent[] = [
  {
    id: "evt-1",
    event: "Signed in with SSO",
    type: "sso",
    user: "Alex Morgan",
    ip: "203.0.113.24",
    location: "New York, US",
    time: "2026-06-25 08:14",
    status: "success",
  },
  {
    id: "evt-2",
    event: "Failed sign-in — wrong password",
    type: "login",
    user: "Priya Nair",
    ip: "198.51.100.77",
    location: "Mumbai, IN",
    time: "2026-06-25 07:52",
    status: "blocked",
  },
  {
    id: "evt-3",
    event: "Enrolled authenticator app",
    type: "mfa",
    user: "Daniel Kim",
    ip: "203.0.113.51",
    location: "Seoul, KR",
    time: "2026-06-24 18:03",
    status: "success",
  },
  {
    id: "evt-4",
    event: "Sign-in from a new device",
    type: "login",
    user: "Sara Lopez",
    ip: "192.0.2.140",
    location: "Madrid, ES",
    time: "2026-06-24 14:21",
    status: "flagged",
  },
  {
    id: "evt-5",
    event: "Password reset completed",
    type: "password",
    user: "Tom Becker",
    ip: "203.0.113.9",
    location: "Berlin, DE",
    time: "2026-06-24 11:46",
    status: "success",
  },
  {
    id: "evt-6",
    event: "Blocked sign-in — impossible travel",
    type: "login",
    user: "Priya Nair",
    ip: "45.83.220.11",
    location: "Lagos, NG",
    time: "2026-06-23 23:09",
    status: "blocked",
  },
  {
    id: "evt-7",
    event: "MFA requirement enabled org-wide",
    type: "policy",
    user: "Alex Morgan",
    ip: "203.0.113.24",
    location: "New York, US",
    time: "2026-06-23 16:30",
    status: "success",
  },
  {
    id: "evt-8",
    event: "Recovery codes regenerated",
    type: "mfa",
    user: "Maya Patel",
    ip: "198.51.100.5",
    location: "London, GB",
    time: "2026-06-23 09:58",
    status: "success",
  },
]

export const SECURITY_OVERVIEW = {
  securityScore: 92,
  scoreTrend: [78, 80, 79, 82, 84, 83, 85, 86, 88, 87, 89, 90, 91, 92],
  mfaEnrolled: 108,
  mfaTotal: 120,
  activeSessions: 86,
  openAlerts: 3,
}
