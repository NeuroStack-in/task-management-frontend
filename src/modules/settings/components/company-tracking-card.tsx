"use client";

/**
 * **How tracking works here** — the org's monitoring policy in plain words, on the one org page every
 * member can read (UX audit 2026-10-16, EMP-11).
 *
 * Settings → Company told an employee the holidays and the policies but nothing about what WorkPulse
 * records about them. This card says it, read-only, built from the org's **real** settings and only
 * from reads any member is allowed: the tracking mode and the features (the entitlements every
 * session already holds) and the capture policy (`GET /v1/agent/config` — no permission bit, it is
 * the config their own agent applies).
 *
 * It describes the **policy, never the reader's data**: employees see no monitoring data about
 * themselves (owner decision 2026-10-17), and nothing here reads any.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Camera,
  Eye,
  MapPin,
  MousePointerClick,
  PauseCircle,
  ShieldCheck,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader } from "@/components/shared/loader";
import { effectiveFromState, useEntitlementsStore } from "@/stores/entitlements.store";
import { trackingModeOf, type TrackingMode } from "@/lib/tracking-mode";
import { legalHref } from "@/modules/legal/documents";
import {
  getTrackingPolicy,
  type TrackingCadence,
  type TrackingPolicy,
} from "@/modules/agents/services/fleet.service";

/** Minutes between screenshots, or `null` when the cadence is off. */
function cadenceMinutes(c: TrackingCadence): number | null {
  if (c === "off") return null;
  if (typeof c === "object") return c.custom;
  return ({ min3: 3, min5: 5, min10: 10 } as Record<string, number>)[c] ?? null;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** How a day is recorded under each mode — the part an employee most needs to know first. */
const MODE_TEXT: Record<TrackingMode, { title: string; body: string }> = {
  project: {
    title: "You track time with the desktop app's timer",
    body: "Start the timer in the WorkPulse desktop app against a project or task. Activity and screenshots are recorded only while your timer runs — nothing when it's off.",
  },
  machine: {
    title: "Your company computer records your working day",
    body: "IT runs a background service on company computers. Your day is recorded from Windows sign-in to sign-out — sleep doesn't count — and there's no timer to start.",
  },
  both: {
    title: "The desktop app's timer, or your company computer",
    body: "Some people start a timer in the WorkPulse desktop app; some company computers run a background service from Windows sign-in to sign-out. Either way, each person's day counts once.",
  },
};

interface Item {
  icon: LucideIcon;
  title: string;
  body: string;
}

export function CompanyTrackingCard({ trackingMode }: { trackingMode?: string | null }) {
  // The org's own record when it loaded; otherwise the mode every session already carries.
  const sessionMode = useEntitlementsStore((s) => s.trackingMode);
  const mode = trackingMode ? trackingModeOf(trackingMode) : sessionMode;
  // The org's switches as they apply to everyone — not the owner exemption `useIsFeatureOn` adds.
  const activity = useEntitlementsStore((s) => effectiveFromState(s, "monitoring.activity"));
  const screenshotsOn = useEntitlementsStore((s) => effectiveFromState(s, "monitoring.screenshots"));
  const featuresLoaded = useEntitlementsStore((s) => s.loaded);

  const [policy, setPolicy] = useState<TrackingPolicy | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(() => {
    let live = true;
    setFailed(false);
    getTrackingPolicy().then(
      (c) => live && setPolicy(c.tracking),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => load(), [load, attempt]);

  const items: Item[] = [];
  if (policy) {
    const minutes = cadenceMinutes(policy.cadence);
    items.push(
      screenshotsOn && minutes !== null
        ? {
            icon: Camera,
            title: `A screenshot every ${plural(minutes, "minute")}`,
            body: `Taken while time is being recorded, kept ${plural(policy.retention_days, "day")}, then deleted automatically.${
              policy.blur_level > 0 ? " They are blurred." : ""
            }`,
          }
        : {
            icon: Camera,
            title: "No screenshots",
            body: "Your organization has screenshots turned off.",
          },
    );
  }
  if (featuresLoaded) {
    items.push(
      activity
        ? {
            icon: MousePointerClick,
            title: "Apps, window titles and activity",
            body: "Which apps you use and their window titles, active and idle time, and how much keyboard and mouse activity there was each minute — never what you type. It feeds a daily productivity score.",
          }
        : {
            icon: MousePointerClick,
            title: "No activity monitoring",
            body: "Your organization has activity monitoring turned off: only your time is recorded.",
          },
    );
    if (activity) {
      items.push({
        icon: MapPin,
        title: "Approximate location",
        body: "Your device's approximate location while time is being recorded, if the device allows it. Kept 90 days.",
      });
    }
  }
  if (policy && mode !== "machine" && (policy.pause_allowance_secs ?? 0) > 0) {
    const mins = Math.round((policy.pause_allowance_secs ?? 0) / 60);
    items.push({
      icon: PauseCircle,
      title: `Up to ${plural(mins, "minute")} of privacy pause a day`,
      body: "In the desktop app you can pause screenshots, activity and location — for a private call, say — while your timer keeps running.",
    });
  }
  if (policy?.silent) {
    items.push({
      icon: Eye,
      title: "No on-screen indicator",
      body: "Your organization has turned off the indicator that shows recording is running.",
    });
  }

  const modeText = MODE_TEXT[mode];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" /> How tracking works here
        </CardTitle>
        <CardDescription>
          What WorkPulse records, from your organization&apos;s current settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-3 rounded-xl border bg-muted/30 p-3">
          <Timer className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium">{modeText.title}</p>
            <p className="text-xs text-muted-foreground">{modeText.body}</p>
          </div>
        </div>

        {failed ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" role="status">
            <span className="text-muted-foreground">
              Couldn&apos;t load your organization&apos;s capture settings.
            </span>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Retry
            </button>
          </div>
        ) : !policy ? (
          <Loader label="Loading tracking settings…" />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {items.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3 rounded-xl border p-3">
                <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="block text-xs text-muted-foreground">{body}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Who sees it — the policy, not a list of names (an employee can't read roles). Screenshots
            are visible to every holder of the screenshots permission (owner decision 2026-10-13). */}
        <div className="space-y-1 border-t pt-4 text-xs text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Who can see it:</span> owners, admins,
            and anyone whose role your organization has given permission to view screenshots or
            activity.
          </p>
          <p>
            Employees don&apos;t see monitoring data in WorkPulse — not even their own. More in the{" "}
            <Link
              href={legalHref("privacy")}
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              privacy policy
            </Link>
            .
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
