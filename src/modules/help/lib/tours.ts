/**
 * Guided product tours — the data behind the Help Center's "Start tour" buttons.
 *
 * A tour is a list of steps, and a step is **a route plus a target on it**. The driver
 * (`components/layout/product-tour.tsx`) navigates to `route`, waits for `target`, then dims the
 * page and spotlights it. That contract is what makes these tours point at the real product rather
 * than describe it.
 *
 * ## The hard-won rule: only target what exists for EVERY role that can reach the step
 *
 * This is not a style preference, it is the bug that broke the first two attempts. Almost every
 * page in this app renders a different component per role:
 *
 * | Route | Owner / manager | Employee |
 * |---|---|---|
 * | `/dashboard` | `OrgDashboard` | `PersonalDashboard` |
 * | `/time-tracking` | `TeamTimeView` | `PersonalTimeView` |
 * | `/attendance` | org view | `PersonalAttendanceView` |
 *
 * A marker placed inside one branch is simply absent for everyone on the other, and the step waits
 * for an element that can never appear. So targets come from {@link SAFE_TARGETS} — three things
 * verified present for every role — and `tours.test.ts` fails the build if a step uses anything
 * else.
 *
 * - `page:header` — the navbar title block (`top-navbar.tsx`). Present on every route, every role.
 *   The right spotlight for "you are now on X".
 * - `nav:<href>` — a sidebar item, stamped from the nav tree in `sidebar-nav.tsx`. Present when the
 *   caller's role includes it, which is exactly what the step's `permission` already declares.
 * - `dash:kpis` — the dashboard KPI strip, deliberately marked in **both** dashboard branches.
 *
 * `GreetingHeader` is the cautionary tale: it looks like the dashboard's heading but `return`s
 * `null` — it only publishes into the page-title store. Wrapping it produced a zero-height,
 * full-width spotlight: a white strip across the page pointing at nothing.
 *
 * ## Every step is spotlighted
 *
 * `target` is required. A step without one renders as a bare centred dialog, which reads as a
 * different, lesser thing than the rest of the tour — and made the tour look half-finished.
 */
import type { PermissionId } from "@/types/rbac";

/**
 * Targets verified to exist for every role that can reach them. Enforced by `tours.test.ts`.
 *
 * Adding one means proving it renders in *all* role branches of its page — see the table above
 * before you do.
 */
export const SAFE_TARGET_PREFIXES = [
  "page:header",
  "nav:",
  "dash:kpis",
  // Settings content. Allowed because every step that uses one is gated on `settings:view`, and
  // Settings renders the same components for everyone holding it — there is no role branch to fall
  // through. `page:header` is the wrong target on these routes: the navbar reads a generic
  // "Settings" while the page's own heading (Monitoring, Tracking rules) sits in the content area.
  "settings:",
  // Employees + Roles content. Same reasoning as `settings:` — every step using one is gated on
  // the permission that renders it, and neither page branches by role beyond that gate.
  "emp:",
  "roles:",
  // Analytics tabs. Same reasoning again: each step is gated on the permission that renders its
  // tab, and within a tab there is no further role branch.
  "insights:",
  "shots:",
  // Time tracking + attendance. These pages DO branch by role, so unlike the gated tours above the
  // safety here comes from marking the same name in **both** branches — `time:sessions` in
  // PersonalTimeView and TeamTimeView, `att:summary` in PersonalAttendanceView and the org view.
  "time:",
  "att:",
] as const;

export interface TourStep {
  /** Route this step lives on. The driver navigates here first if we aren't already. */
  route: string;
  /**
   * `data-tour` value to spotlight. **Required** — every step gets a spotlight, and it must be a
   * {@link SAFE_TARGET_PREFIXES} value.
   */
  target: string;
  title: string;
  content: string;
  /** Required to see the target. Steps whose permission the caller lacks are dropped up front. */
  permission?: PermissionId;
}

export interface Tour {
  id: string;
  /**
   * What a person needs to be offered this tour at all — the gate on the Help Center's card.
   *
   * Lives here, beside the steps, rather than in the page: the card's gate and the steps' gates are
   * the same idea, and when they were separate they could drift into a card that opens a tour with
   * no steps — a button that does nothing. `tours.test.ts` asserts they agree.
   */
  permission?: PermissionId;
  steps: TourStep[];
}

/** Keyed by the walkthrough ids the Help Center renders, so the buttons need no mapping table. */
export const TOURS: Record<string, Tour> = {
  // Ungated: every role gets this one, so every step must work for an Employee *and* an Owner.
  "getting-started": {
    id: "getting-started",
    steps: [
      {
        route: "/dashboard",
        target: "page:header",
        title: "This is your dashboard",
        content:
          "Your starting point. The heading names whose view this is — an Owner sees the whole organization, everyone else sees their own work.",
      },
      {
        route: "/dashboard",
        target: "dash:kpis",
        title: "The numbers that matter",
        content:
          "Your headline figures for the period. Every one comes from what the desktop agent actually reported — a dash means no data yet, never a guess.",
      },
      {
        route: "/dashboard",
        target: "nav:/time-tracking",
        title: "Where your hours live",
        content:
          "Every session the agent recorded, day by day. The web view is read-only — the desktop app does the tracking.",
      },
      {
        route: "/dashboard",
        target: "nav:/projects",
        title: "Where the work lives",
        content: "Projects and the tasks assigned to you.",
      },
      {
        route: "/dashboard",
        target: "nav:/help",
        title: "That's the tour",
        content:
          "Every section has its own walkthrough here, plus searchable articles and a way to reach us.",
      },
    ],
  },

  // Ungated, so every step must work for an Employee *and* an Owner. Both pages this visits render
  // a different component per role, so `time:sessions` and `att:summary` are each marked in BOTH
  // branches — the same treatment `dash:kpis` gets. Nothing here falls back to `page:header`.
  "time-tracking": {
    id: "time-tracking",
    steps: [
      {
        route: "/dashboard",
        target: "nav:/time-tracking",
        title: "Time Tracking",
        content: "Your timesheet lives here — every session, every day.",
      },
      {
        route: "/time-tracking",
        target: "time:sessions",
        title: "The desktop agent does the tracking",
        content:
          "There's no start/stop button on the web, by design. The agent records each session and the server folds them into this — so what you see always matches what was actually captured.",
      },
      {
        route: "/dashboard",
        target: "nav:/attendance",
        title: "Attendance is the other half",
        content:
          "Sessions become attendance: present days, hours worked, lateness. Both come from the same agent batches, so the two can't disagree.",
      },
      {
        route: "/attendance",
        target: "att:summary",
        title: "Your attendance record",
        content:
          "Presence for the period you pick, summarised. A non-working day is marked as such, so a blank Saturday never reads as a missed day.",
      },
    ],
  },

  // **Never route a step to `/insights`.** That page has no content of its own — it is a client
  // redirect that `router.replace`s to the first tab the role can open, so a step there would land
  // on a loader and be navigated out from under itself. Steps go straight to the real tabs.
  //
  // Each step is gated on the permission that renders *its* tab (`activity:view`,
  // `screenshots:view`), not on the card's `reports:view` — the tabs are separately permissioned,
  // so a role can hold one and not another.
  insights: {
    id: "insights",
    permission: "reports:view",
    steps: [
      {
        route: "/dashboard",
        target: "nav:/insights",
        title: "Analytics",
        content:
          "Scores, trends, screenshots and the AI reports all live behind here, as separate tabs.",
        permission: "reports:view",
      },
      {
        route: "/insights/activity",
        target: "insights:trend",
        title: "How the score moves",
        content:
          "A deterministic 0–100 per day, from utilization, quality, focus and reliability. Rust computes it from the day's activity — the AI never decides a score, it only narrates one.",
        permission: "activity:view",
      },
      {
        route: "/insights/activity",
        target: "insights:categories",
        title: "Where the time went",
        content:
          "Tracked minutes split by category. This is the Quality input to the score, and the weights behind it are yours to set in Settings → Tracking rules.",
        permission: "activity:view",
      },
      {
        route: "/insights/ai-reports",
        target: "insights:ai",
        title: "The written summary",
        content:
          "A narrative over the numbers already computed — who stood out, what needs attention. Generated once per day and cached, so re-reading it costs nothing.",
        permission: "reports:view",
      },
      {
        route: "/insights/screenshots",
        target: "shots:review",
        title: "Screenshot review",
        content:
          "Captures from the agent, each with an AI read of what was on screen. Distracting content is flagged with a reason — the reason is what makes a flag defensible.",
        permission: "screenshots:view",
      },
    ],
  },

  // Like monitoring-setup, this one can spotlight real page content: `/employees` and
  // `/settings/roles` render the same components for everyone holding the gate. Note step 2 is
  // gated on employees:**manage**, not view — the button it points at is itself behind that
  // permission, so a view-only member simply doesn't get a step about an action they can't take.
  "team-management": {
    id: "team-management",
    permission: "employees:view",
    steps: [
      {
        route: "/dashboard",
        target: "nav:/employees",
        title: "Employees",
        content: "Your roster — invite people, set roles, organise departments and teams.",
        permission: "employees:view",
      },
      {
        route: "/employees",
        target: "emp:invite",
        title: "Inviting someone",
        content:
          "Add employee emails a one-time link and code. The account only exists once they accept it, so a pending invite is never a half-created user.",
        permission: "employees:manage",
      },
      {
        route: "/employees",
        target: "emp:roster",
        title: "Roles decide what people see",
        content:
          "Everyone's role sits in this table. A role is a set of permissions and the sidebar is generated from it — someone without Payroll access doesn't get a locked Payroll page, they don't see Payroll at all.",
        permission: "employees:view",
      },
      {
        route: "/settings/roles",
        target: "roles:list",
        title: "Custom roles",
        content:
          "Build your own when the system roles don't fit. You can only grant permissions you hold yourself, so a role can never escalate beyond its author.",
        permission: "settings:view",
      },
    ],
  },

  // Every step is gated on `settings:view`, and Settings renders the same components for everyone
  // who holds it — so unlike /dashboard this tour can safely spotlight real page content. The
  // navbar header is deliberately NOT used here: on a Settings route it reads a generic "Settings",
  // so highlighting it while talking about screenshot cadence pointed at the wrong words.
  "monitoring-setup": {
    id: "monitoring-setup",
    permission: "settings:view",
    steps: [
      {
        route: "/dashboard",
        target: "nav:/settings",
        title: "Settings",
        content: "Monitoring is configured here, org-wide.",
        permission: "settings:view",
      },
      {
        route: "/settings/monitoring",
        target: "settings:capture",
        title: "What gets captured",
        content:
          "Screenshot cadence, blur level and retention, all in one card. Blur is the lever for reducing what's legible — per-frame and auditable, unlike quietly lowering quality.",
        permission: "settings:view",
      },
      {
        route: "/settings/tracking-rules",
        target: "settings:weights",
        title: "What counts as productive",
        content:
          "Each category carries a score weight — productive 1, neutral 0.5, distracting 0. These multiply the tracked minutes, so changing them changes how days are graded from that point on.",
        permission: "settings:view",
      },
      {
        route: "/settings/monitoring",
        target: "settings:updates",
        title: "Keeping agents current",
        content:
          "Agents can self-update to the latest release, so a fix reaches every device without anyone reinstalling. Turn it off and updates become deliberate.",
        permission: "settings:view",
      },
    ],
  },
};

export function getTour(id: string): Tour | undefined {
  return TOURS[id];
}
