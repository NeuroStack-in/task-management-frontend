"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ONBOARDING_STEPS } from "@/modules/onboarding/steps";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { canAccess } from "@/lib/rbac";
import { currentRoleSnapshot } from "@/hooks/use-permissions";
import { getOrg, updateOrg } from "@/modules/settings/services/org.service";
import { listRoles, type ApiRole } from "@/modules/roles/services/roles.service";
import {
  createDepartment,
  createInvite,
  listDepartments,
} from "@/modules/employees/services/employees.service";
import {
  getTrackingPolicy,
  updateTrackingPolicy,
  type TrackingCadence,
  type TrackingPolicy,
} from "@/modules/agents/services/fleet.service";
import { captureLock, capturing } from "@/modules/settings/lib/monitoring-capture";
import { effectiveFromState, useEntitlementsStore } from "@/stores/entitlements.store";
import { legalHref } from "@/modules/legal/documents";
import { useTrackingMode } from "@/hooks/use-features";
import type { TrackingMode } from "@/lib/tracking-mode";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Best-effort onboarding-progress marker. Never throws — a failed marker must not trap the user. */
async function markStep(step: string, state: string) {
  try {
    await updateOrg({ onboarding: { step, state } });
  } catch {
    // Progress markers are advisory; swallow failures so onboarding always advances.
  }
}

/** Pick the default non-privileged role: the one named "Employee", else the last (most-restricted). */
function defaultRole(roles: ApiRole[]): ApiRole | undefined {
  return roles.find((r) => r.name === "Employee") ?? roles[roles.length - 1];
}

/** Minutes between screenshots for a stored interval, or `null` when off. */
function cadenceMinutes(c: TrackingCadence): number | null {
  if (c === "off") return null;
  if (typeof c === "object") return c.custom;
  return { min3: 3, min5: 5, min10: 10 }[c] ?? null;
}

export function OnboardingWizard({ initialStep = 0 }: { initialStep?: number }) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [saving, setSaving] = useState(false);
  const last = ONBOARDING_STEPS.length - 1;

  // Step 1 — org
  const [orgName, setOrgName] = useState("");
  const [timezone, setTimezone] = useState("");
  const [website, setWebsite] = useState("");

  // Step 2 — team
  const [emails, setEmails] = useState<string[]>(["", "", ""]);
  /** Indices of entries that aren't email addresses — shown, not silently dropped (WP-127). */
  const [badEmails, setBadEmails] = useState<number[]>([]);
  const [roles, setRoles] = useState<ApiRole[]>([]);

  // Step 3 — tracking. The switches start from the org's CURRENT policy, and only a change is
  // written. They used to start at fixed defaults and be written back unconditionally, so walking
  // through this again turned an org's "off" or 3-minute cadence into every 5 minutes (WP-127). The
  // "Idle detection" switch is gone: nothing ever sent it anywhere. `null` policy = not loaded (or
  // not this person's to change) — the step then writes nothing.
  const canMonitor = canAccess(currentRoleSnapshot(), "monitoring:manage");
  const [policy, setPolicy] = useState<TrackingPolicy | null>(null);
  const [policyFailed, setPolicyFailed] = useState(false);
  const [screenshots, setScreenshots] = useState(false);
  // No "Silent mode" switch (UX audit 2026-10-16, ONB-07). It hid the agent's capture indicator —
  // the only on-screen notice an employee gets — and could be flipped on in passing, described as
  // "Track quietly in the background". Settings → Monitoring already removed it as an admin
  // setting and pins it off on every save (WP-331), so this was the one place left to turn it on,
  // and the next Monitoring save would have quietly turned it off again. This step pins it off too.
  //
  // The two switches that decide whether the interval can change (SET-03, `captureLock`).
  const screenshotsOn = useEntitlementsStore((s) => effectiveFromState(s, "monitoring.screenshots"));
  const screenshotsInPlan = useEntitlementsStore(
    (s) => !s.loaded || s.allowed.includes("monitoring.screenshots"),
  );
  const activityOn = useEntitlementsStore((s) => effectiveFromState(s, "monitoring.activity"));
  const activityInPlan = useEntitlementsStore(
    (s) => !s.loaded || s.allowed.includes("monitoring.activity"),
  );
  const lock = captureLock({ screenshotsOn, screenshotsInPlan, activityOn, activityInPlan });
  // Which agents run decides whether employees see any indicator at all (see `TrackingStep`).
  const trackingMode = useTrackingMode();

  // Prefill the org step from the details already captured at signup, so this is a confirm/refine
  // rather than blank re-entry. Best-effort — a 404 (org not provisioned) leaves the fields empty.
  useEffect(() => {
    let alive = true;
    getOrg()
      .then((org) => {
        if (!alive) return;
        setOrgName((v) => v || org.name || "");
        setTimezone((v) => v || org.timezone || "");
        setWebsite((v) => v || org.website || "");
      })
      .catch(() => {
        // No org yet (404) or read failed → keep the empty fields; the user can fill them in.
      });
    return () => {
      alive = false;
    };
  }, []);

  // The tracking policy as it stands, to seed the step's switches. Only for someone who may change it.
  useEffect(() => {
    if (!canMonitor) return;
    let alive = true;
    getTrackingPolicy()
      .then((cfg) => {
        if (!alive) return;
        setPolicy(cfg.tracking);
        setScreenshots(cfg.tracking.cadence !== "off");
      })
      .catch(() => {
        // Unreadable → `policy` stays null and the step writes nothing rather than guess.
        if (alive) setPolicyFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [canMonitor]);

  // Load roles once so the team step can pick a default role for invites. Best-effort.
  useEffect(() => {
    let alive = true;
    listRoles()
      .then((rs) => {
        if (alive) setRoles(rs);
      })
      .catch(() => {
        // Roles unavailable → invites are skipped gracefully at save time.
      });
    return () => {
      alive = false;
    };
  }, []);

  // ── Per-step saves (all best-effort; each resolves so the wizard always advances) ──────────────

  async function saveOrg() {
    const name = orgName.trim();
    const tz = timezone.trim();
    const site = website.trim();
    const anyFilled = Boolean(name || tz || site);
    try {
      if (anyFilled) {
        await updateOrg({
          ...(name ? { name } : {}),
          ...(tz ? { timezone: tz } : {}),
          ...(site ? { website: site } : {}),
          onboarding: { step: "org_setup", state: "done" },
        });
      } else {
        await updateOrg({ onboarding: { step: "org_setup", state: "skipped" } });
      }
    } catch {
      toast.error("Couldn't save organization details", {
        description: "You can update them later in Settings.",
      });
    }
  }

  /** Resolves whether the wizard may move on — `false` while an entry isn't an email address. */
  async function saveTeam(): Promise<boolean> {
    // An address that isn't one is pointed out, not dropped without a word (WP-127).
    const bad = emails.flatMap((e, i) => (e.trim() && !EMAIL_RE.test(e.trim()) ? [i] : []));
    setBadEmails(bad);
    if (bad.length > 0) return false;
    const valid = emails.map((e) => e.trim()).filter(Boolean);
    if (valid.length === 0) {
      await markStep("invite_team", "skipped");
      return true;
    }
    const role = defaultRole(roles);
    if (!role) {
      toast.error("Couldn't send invites", {
        description: "Roles weren't available. Invite teammates later from Employees.",
      });
      await markStep("invite_team", "skipped");
      return true;
    }
    // Invites require a department + title (server 400s without them). Orgs are created with a set
    // of departments, so use "General" if it exists, else the first one, else create "General" — and
    // say which one, rather than claiming "General" while filing under whatever came first (WP-127).
    // Joiners land there with a generic title, both refinable later from Employees.
    let department: { id: string; name: string };
    try {
      const depts = await listDepartments();
      department =
        depts.find((d) => d.name.trim().toLowerCase() === "general") ??
        depts[0] ??
        (await createDepartment("General"));
    } catch {
      toast.error("Couldn't prepare a department for invites", {
        description: "Invite teammates later from Employees.",
      });
      await markStep("invite_team", "skipped");
      return true;
    }
    let invited = 0;
    let failed = 0;
    for (const email of valid) {
      try {
        await createInvite({
          email,
          role_id: role.id,
          department_id: department.id,
          title: "Team member",
        });
        invited++;
      } catch {
        failed++;
      }
    }
    if (invited > 0) {
      toast.success(`Invited ${invited} teammate${invited === 1 ? "" : "s"}`, {
        description:
          failed > 0
            ? `${failed} invite${failed === 1 ? "" : "s"} failed.`
            : `Filed under ${department.name} with a placeholder title — refine from Employees.`,
      });
    } else if (failed > 0) {
      toast.error("Couldn't send invites", {
        description: "You can invite teammates later from Employees.",
      });
    }
    await markStep("invite_team", invited > 0 ? "done" : "skipped");
    return true;
  }

  async function saveTracking() {
    // Not this person's to change, or the current policy couldn't be read: write nothing. Writing
    // anyway is what produced a 403 blamed on the plan, or a blind overwrite (WP-127).
    if (!policy) {
      await markStep("tracking", "skipped");
      return;
    }
    const wasOn = policy.cadence !== "off";
    // Nothing to write when the switch didn't move, or while the interval is locked (the switch
    // is disabled then, so this is belt and braces against a late entitlements read).
    if (screenshots === wasOn || lock) {
      await markStep("tracking", wasOn ? "done" : "skipped");
      return;
    }
    try {
      await updateTrackingPolicy({
        // Keep the org's own interval while screenshots stay on; switching them on starts at every
        // 5 minutes, adjustable in Settings → Monitoring.
        cadence: screenshots ? (wasOn ? policy.cadence : "min5") : "off",
        blur_level: policy.blur_level,
        retention_days: policy.retention_days,
        // Pinned off, as every Monitoring save does (WP-331) — see the note on `screenshots`.
        silent: false,
        auto_update: policy.auto_update,
        ...(policy.idle_end_secs !== undefined ? { idle_end_secs: policy.idle_end_secs } : {}),
        // Keep the org's pause allowance; omitting it would reset it to the default.
        ...(policy.pause_allowance_secs !== undefined
          ? { pause_allowance_secs: policy.pause_allowance_secs }
          : {}),
        expected_version: policy.version,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && screenshots && !wasOn) {
        // This role may manage monitoring (checked before the step is offered), so refusing to turn
        // capture on is the plan's ceiling — the one case the server answers this way.
        toast.message("Screenshots aren't in your plan", {
          description: "Tracking was left as it was. You can change plans in Settings → Billing.",
        });
      } else if (err instanceof ApiError && err.status === 409) {
        toast.message("Tracking policy changed elsewhere", {
          description: "Your changes weren't applied. Review it in Settings → Monitoring.",
        });
      } else {
        toast.error("Couldn't save tracking preferences", {
          description: "You can configure tracking later in Settings → Monitoring.",
        });
      }
    }
    await markStep("tracking", screenshots ? "done" : "skipped");
  }

  async function finishDashboard() {
    await markStep("personalize", "done");
  }

  async function handleNext() {
    if (saving) return;
    setSaving(true);
    try {
      const key = ONBOARDING_STEPS[step].key;
      if (key === "org") await saveOrg();
      else if (key === "team") {
        if (!(await saveTeam())) return;
      } else if (key === "tracking") await saveTracking();
      else if (key === "dashboard") await finishDashboard();

      if (step < last) {
        setStep((s) => s + 1);
      } else {
        toast.success("You're all set", { description: "Your workspace is ready." });
        router.push("/dashboard");
      }
    } finally {
      setSaving(false);
    }
  }

  function renderStep() {
    switch (ONBOARDING_STEPS[step].key) {
      case "org":
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ob-company">Organization name</Label>
              <Input
                id="ob-company"
                placeholder="Acme Inc."
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ob-tz">Timezone</Label>
                <Input
                  id="ob-tz"
                  placeholder="America/New_York"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ob-site">Website</Label>
                <Input
                  id="ob-site"
                  placeholder="acme.com"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
            </div>
          </div>
        );
      case "team":
        return (
          <div className="space-y-3">
            {emails.map((email, i) => (
              <div key={i} className="space-y-1.5">
                <Label htmlFor={`ob-invite-${i}`} className="sr-only">
                  Teammate email {i + 1}
                </Label>
                <Input
                  id={`ob-invite-${i}`}
                  type="email"
                  placeholder="teammate@acme.com"
                  value={email}
                  aria-invalid={badEmails.includes(i) || undefined}
                  aria-describedby={badEmails.includes(i) ? `ob-invite-${i}-error` : undefined}
                  onChange={(e) => {
                    setEmails((prev) => prev.map((v, j) => (j === i ? e.target.value : v)));
                    setBadEmails((prev) => prev.filter((j) => j !== i));
                  }}
                />
                {badEmails.includes(i) ? (
                  <p id={`ob-invite-${i}-error`} className="text-xs text-destructive">
                    That isn&apos;t an email address — fix it or clear it to continue.
                  </p>
                ) : null}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEmails((prev) => [...prev, ""])}
            >
              + Add another
            </Button>
          </div>
        );
      case "tracking":
        if (!policy) {
          return (
            <p className="text-sm text-muted-foreground">
              {!canMonitor
                ? "Tracking settings are changed by whoever manages monitoring in your organization, from Settings → Monitoring."
                : policyFailed
                  ? "Couldn't load your current tracking settings. Continue — you can set them any time in Settings → Monitoring."
                  : "Loading your current tracking settings…"}
            </p>
          );
        }
        return (
          <TrackingStep
            policy={policy}
            trackingMode={trackingMode}
            screenshots={screenshots}
            onScreenshots={setScreenshots}
            lockReason={
              !lock
                ? null
                : !capturing(lock)
                  ? lock.kind === "screenshots-off"
                    ? "Screenshots are switched off in Settings → Features, so nothing is captured whatever this says. Turn them on there first."
                    : "Screenshots aren't included in your plan."
                  : lock.kind === "activity-off"
                    ? "Changing this needs Activity monitoring, which is switched off in Settings → Features."
                    : "Changing this needs Activity monitoring, which isn't included in your plan."
            }
          />
        );
      case "dashboard":
        // There was a widget checklist here that saved nothing. The dashboard's own Customize does
        // this for real, and keeps the layout on the account.
        return (
          <p className="text-sm text-muted-foreground">
            Your dashboard shows the cards you pick. Use <strong>Customize</strong> on the Dashboard to
            add, hide or reorder them — the layout is saved to your account.
          </p>
        );
      default:
        return null;
    }
  }

  return (
    <Card className="w-full max-w-xl">
      <CardHeader className="gap-3">
        {/* Stepper */}
        <div className="flex items-center gap-1.5">
          {ONBOARDING_STEPS.map((s, i) => (
            <span
              key={s.key}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <CardTitle>{ONBOARDING_STEPS[step].title}</CardTitle>
          <span className="text-xs text-muted-foreground">
            Step {step + 1} of {ONBOARDING_STEPS.length}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{ONBOARDING_STEPS[step].hint}</p>
      </CardHeader>

      <CardContent>{renderStep()}</CardContent>

      <div className="flex items-center justify-between px-(--card-spacing)">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || saving}
        >
          <ArrowLeft className="size-4" /> Back
        </Button>
        <Button type="button" onClick={handleNext} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Saving
            </>
          ) : step === last ? (
            <>
              Finish <Check className="size-4" />
            </>
          ) : (
            <>
              Continue <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}

/**
 * What employees see while capture runs. The desktop app shows an indicator (this step pins silent
 * mode off); the managed Windows service runs with none (`legal/content/terms.tsx`, On-screen
 * notices) — so a `machine` org must not be told employees will see one.
 */
const INDICATOR: Record<TrackingMode, string> = {
  project: "Employees see an indicator in the desktop app while it records.",
  machine:
    "The background service on company-managed devices shows employees no indicator while it records.",
  both: "The desktop app shows employees an indicator while it records; the background service on company-managed devices shows none.",
};

/**
 * The tracking step's one switch, with what it actually does spelled out (UX audit ONB-07): it was
 * "Screenshots — Capture periodic screenshots.", switched on in passing with no word of the interval,
 * how long images are kept, or the employer's duty to tell people before capture starts.
 */
function TrackingStep({
  policy,
  trackingMode,
  screenshots,
  onScreenshots,
  lockReason,
}: {
  policy: TrackingPolicy;
  trackingMode: TrackingMode;
  screenshots: boolean;
  onScreenshots: (v: boolean) => void;
  /** Why the switch can't change right now, or `null`. */
  lockReason: string | null;
}) {
  const stored = cadenceMinutes(policy.cadence);
  // Switching on starts at every 5 minutes (see `saveTracking`); an org already capturing keeps its
  // own interval.
  const minutes = stored ?? 5;
  const days = policy.retention_days;
  return (
    <div className="space-y-3">
      <label
        className={cn(
          "flex items-start justify-between gap-3 rounded-lg border p-3",
          lockReason && "opacity-70",
        )}
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium">Screenshots</span>
          <span className="block text-xs text-muted-foreground">
            {screenshots
              ? `A screenshot of each employee's screen every ${minutes} minute${minutes === 1 ? "" : "s"} while their tracking runs, kept ${days} day${days === 1 ? "" : "s"} and then deleted. Admins with the screenshots permission can view them.`
              : "Off — no screenshots are taken."}
          </span>
        </span>
        <Switch
          checked={screenshots}
          onCheckedChange={onScreenshots}
          disabled={lockReason !== null}
          aria-label="Screenshots"
        />
      </label>
      {lockReason ? <p className="text-xs text-muted-foreground">{lockReason}</p> : null}

      <div className="space-y-1.5 rounded-lg border border-warning/30 bg-warning/[0.06] p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">Before capture starts</p>
        <p>
          {INDICATOR[trackingMode]} You are responsible for
          telling them what is captured, why, who can see it and how long it is kept — and for any
          consent your local law requires.{" "}
          <Link
            href={`${legalHref("terms")}#monitoring`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2 hover:no-underline"
          >
            Your monitoring obligations
          </Link>
        </p>
        <p>
          WorkPulse also lists what your organization records in each invite email and on the
          Download page.
        </p>
      </div>

      {policy.silent ? (
        <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
          Your current settings hide that indicator, so employees get no on-screen notice. Changing
          screenshots here turns it back on, as does saving Settings → Monitoring.
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Interval, retention and exclusions are all in Settings → Monitoring.
      </p>
    </div>
  );
}
