import type { MetadataRoute } from "next";

/**
 * The public site is `/`, `/pricing`, `/product/*` and `/legal/*` (the legal pages carry their own
 * `noindex` while they are drafts — `modules/legal/documents.ts`). Everything else is the signed-in app or a
 * sign-in step, which serves a loader to anyone without a session — and with no robots file at all,
 * crawlers indexed every one of them (QA audit 2026-10-08, WP-379).
 *
 * Listed as prefixes to keep out, rather than "allow three paths, disallow /": plain prefix rules are
 * the part of robots.txt every crawler reads the same way (`Allow` precedence and `$` anchors are
 * extensions). A new top-level app route belongs in this list. No sitemap yet: it needs the
 * production origin, which this repo doesn't configure.
 */
const PRIVATE = [
  // (app)
  "/agents",
  "/approvals",
  "/attendance",
  "/audit-logs",
  "/billing",
  "/dashboard",
  "/download",
  "/employees",
  "/help",
  "/insights",
  "/integrations",
  "/leave-requests",
  "/notifications",
  "/ops",
  "/payroll",
  "/profile",
  "/projects",
  "/roles",
  "/security",
  "/settings",
  "/time-tracking",
  // (auth) and the standalone flows
  "/callback",
  "/forgot-password",
  "/invite",
  "/login",
  "/mfa",
  "/register",
  "/reset-password",
  "/onboarding",
  "/dev",
];

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: PRIVATE } };
}
