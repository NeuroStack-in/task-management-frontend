"use client";

import { useCallback } from "react";

import { featureForPath } from "@/constants/features";
import { useIsSurfaceOn, useTrackingMode } from "@/hooks/use-features";
import { usePermissions } from "@/hooks/use-permissions";
import { canAccessPath } from "@/lib/rbac";
import { useIsPersonalDashboard } from "@/modules/dashboard/scope";

import type { TourStep } from "./tours";

/**
 * Whether a tour step can actually be shown to this caller — one predicate for the tour runner and
 * the Help Center's "Start tour" cards, so the two cannot disagree.
 *
 * A step's own `permission` is not enough. It names the permission that renders its *target*, but
 * the page around it has its own gates — the route permission `AuthGuard` checks and the org feature
 * (or plan) the page needs — and those decide whether the page opens at all. The Analytics tour gated
 * on `reports:view`, which every Employee holds, and walked them onto "Access denied"; on Free it
 * walked an Owner onto upgrade walls (QA audit 2026-10-08, WP-070). So a step also needs its route to
 * open, and a `nav:<path>` target (a sidebar item) needs that path to open too, since the sidebar only
 * lists what does.
 */
export function useTourStepFilter(): (step: TourStep) => boolean {
  const { can, role } = usePermissions();
  const personalDashboard = useIsPersonalDashboard();
  const isSurfaceOn = useIsSurfaceOn();
  const mode = useTrackingMode();

  return useCallback(
    (s: TourStep) => {
      const opens = (path: string) => {
        const feature = featureForPath(path);
        return canAccessPath(role, path) && (!feature || isSurfaceOn(feature));
      };
      return (
        (!s.permission || can(s.permission)) &&
        // `/dashboard` renders one of two components; a step anchored to the other one has no
        // target on screen and would burn the full target-wait before skipping.
        (!s.dashboard || s.dashboard === (personalDashboard ? "personal" : "org")) &&
        // A feature the org switched off, or a surface its tracking mode hides, isn't on screen.
        (!s.feature || isSurfaceOn(s.feature)) &&
        (!s.modes || s.modes.includes(mode)) &&
        opens(s.route) &&
        (!s.target.startsWith("nav:") || opens(s.target.slice("nav:".length)))
      );
    },
    [can, role, personalDashboard, isSurfaceOn, mode],
  );
}
