"use client";

/**
 * "What your organization records" — the monitoring disclosure on `/download`, built from the org's
 * **actual** policy rather than marketing copy.
 *
 * A monitored employee was never told what is captured: this page said "Automatic capture · Activity
 * insights · Privacy-first: consent-gated", and screenshots, window titles and location were never
 * mentioned (UX audit 2026-10-16, EMP-01; owner decision 2026-10-17: disclose on the web page and in
 * the invite email). The wording follows `modules/legal/facts.tsx`, which states what the agents
 * really collect and cites the code for each claim.
 *
 * Inputs any member can read: the tracking policy (`GET /v1/agent/config`, no permission bit) and the
 * org's features (`useIsFeatureOn`, already loaded for everyone).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { Camera, Eye, MapPin, MousePointerClick, ShieldAlert } from "lucide-react";
import { useIsFeatureOn } from "@/hooks/use-features";
import { legalHref } from "@/modules/legal/documents";
import {
  getTrackingPolicy,
  type TrackingCadence,
  type TrackingPolicy,
} from "../services/fleet.service";

/** Minutes between screenshots, or `null` when they are off. */
function cadenceMinutes(c: TrackingCadence): number | null {
  if (c === "off") return null;
  if (typeof c === "object") return c.custom;
  return { min3: 3, min5: 5, min10: 10 }[c] ?? null;
}

export function MonitoringDisclosure() {
  const isOn = useIsFeatureOn();
  const [policy, setPolicy] = useState<TrackingPolicy | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    getTrackingPolicy().then(
      (c) => live && setPolicy(c.tracking),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, []);

  const activity = isOn("monitoring.activity");
  const minutes = policy ? cadenceMinutes(policy.cadence) : null;
  const screenshots = isOn("monitoring.screenshots") && minutes !== null;

  const items: { icon: typeof Camera; title: string; body: string }[] = [];
  if (policy) {
    items.push(
      screenshots
        ? {
            icon: Camera,
            title: `Screenshots every ${minutes} minute${minutes === 1 ? "" : "s"}`,
            body: `Images of your screen while your timer runs, kept ${policy.retention_days} days, then deleted. ${
              policy.blur_level > 0 ? "They are blurred." : "They are not blurred."
            } Administrators can also request one on demand while your timer is running.`,
          }
        : {
            icon: Camera,
            title: "No screenshots",
            body: "Your organization has screenshots turned off.",
          },
    );
  }
  if (activity) {
    items.push(
      {
        icon: MousePointerClick,
        title: "Apps, window titles and activity",
        body: "The apps you use and their window titles (a browser's title usually includes the page title), active and idle time, and per-minute counts of keyboard and mouse activity. Never what you type — no keystroke content, clipboard or audio.",
      },
      {
        icon: MapPin,
        title: "Approximate location",
        body: "Your device's approximate location from its operating system (GPS, Wi-Fi or IP address), while your timer runs and if the device allows it. Kept 90 days.",
      },
    );
  }
  if (policy?.silent) {
    items.push({
      icon: Eye,
      title: "No on-screen indicator",
      body: "Your organization has turned off the tray indicator and capture notice on devices.",
    });
  }

  return (
    <section
      aria-labelledby="disclosure-title"
      className="border-warning/30 bg-warning/[0.05] rounded-2xl border p-5"
    >
      <div className="flex items-start gap-3">
        <ShieldAlert className="text-warning mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h2 id="disclosure-title" className="font-display text-base font-semibold">
            What your organization records
          </h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            The agent records your time against projects while your timer runs — and
            nothing when it isn&apos;t running. Your organization&apos;s settings add:
          </p>
        </div>
      </div>

      {failed ? (
        <p className="text-muted-foreground mt-3 text-sm">
          Your organization&apos;s capture settings couldn&apos;t be loaded. Ask your
          administrator what is recorded, or read the{" "}
          <Link
            href={legalHref("privacy")}
            className="text-primary font-medium hover:underline"
          >
            privacy policy
          </Link>
          .
        </p>
      ) : !policy ? (
        <p className="text-muted-foreground mt-3 text-sm">
          Loading your organization&apos;s settings…
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {items.map(({ icon: Icon, title, body }) => (
            <li key={title} className="bg-background/70 flex gap-3 rounded-xl border p-3">
              <Icon className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block text-sm font-medium">{title}</span>
                <span className="text-muted-foreground block text-xs">{body}</span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-muted-foreground mt-3 text-xs">
        Administrators with permission can see this information. More in the{" "}
        <Link
          href={legalHref("privacy")}
          className="text-primary font-medium hover:underline"
        >
          privacy policy
        </Link>
        .
      </p>
    </section>
  );
}
