"use client";

/**
 * The owner's first-run setup — organization, team, tracking, dashboard.
 *
 * UX audit 2026-10-16, ONB-14: it was a grey app card under a hand-drawn logo, with no headings and a
 * free-text timezone ("America/New_York" typed by hand) — another product from the sign-up the owner
 * had just come through. It now renders inside the same split frame (`OnboardingExperience` puts it
 * in `AuthFrame`) on the same field primitives: an H1 for the page, an H2 per step, the step
 * indicator sign-up uses, labelled fields, and the organization timezone picker Settings uses
 * (searchable, every IANA zone). Where a step points at a Settings page the owner can open, it's a
 * link (SET-15).
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ONBOARDING_STEPS } from "@/modules/onboarding/steps";
import { ApiError } from "@/lib/api";
import { canAccess, canAccessPath } from "@/lib/rbac";
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
import { TimezonePicker } from "@/modules/settings/components/org/timezone-picker";
import { browserZone, pickerZones, serverResolves } from "@/modules/settings/lib/timezones";
import { effectiveFromState, useEntitlementsStore } from "@/stores/entitlements.store";
import { legalHref } from "@/modules/legal/documents";
import { useTrackingMode } from "@/hooks/use-features";
import type { TrackingMode } from "@/lib/tracking-mode";
import {
  AuthErrorSummary,
  AuthField,
  AuthHeading,
  AuthSteps,
} from "@/modules/auth/components/auth-frame";

/**
 * "Settings → Monitoring" as a link when this person can open the page, plain text when they can't
 * (UX audit SET-15). The wizard saves each step as it goes, so following one loses only the step on
 * screen.
 */
function SettingsLink({ href, children }: { href: string; children: React.ReactNode }) {
  if (!canAccessPath(currentRoleSnapshot(), href)) return <>{children}</>;
  return (
    <Link
      href={href}
      className="font-semibold underline underline-offset-2"
      style={{ color: "var(--m-accent-ink)" }}
    >
      {children}
    </Link>
  );
}

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
  const summaryRef = useRef<HTMLDivElement>(null);

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
  // Features → Screenshots decides whether capture runs and whether the interval can change (SET-03,
  // `captureLock` — the server checks the same switch).
  const screenshotsOn = useEntitlementsStore((s) => effectiveFromState(s, "monitoring.screenshots"));
  const screenshotsInPlan = useEntitlementsStore(
    (s) => !s.loaded || s.allowed.includes("monitoring.screenshots"),
  );
  const lock = captureLock({ screenshotsOn, screenshotsInPlan });
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
        // No zone on the org: start from this browser's.
        const mine = browserZone();
        const fallback = mine && pickerZones().includes(mine) ? mine : "";
        setTimezone((v) => v || org.timezone || fallback);
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
    if (bad.length > 0) {
      requestAnimationFrame(() => summaryRef.current?.focus());
      return false;
    }
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
      case "org": {
        const tzUnusable = timezone.trim() !== "" && !serverResolves(timezone);
        return (
          <>
            <AuthField
              id="ob-company"
              label="Organization name"
              value={orgName}
              onChange={setOrgName}
              autoComplete="organization"
            />
            <AuthField
              id="ob-tz"
              label="Timezone"
              hint="Sets when your organization's day starts and ends — attendance, lateness and daily reports follow it."
              value={timezone}
              onChange={setTimezone}
              control={
                <div className="m-tz">
                  <TimezonePicker
                    id="ob-tz"
                    value={timezone}
                    onChange={setTimezone}
                    warn={tzUnusable || !timezone.trim()}
                    aria-describedby={`ob-tz-hint${tzUnusable || !timezone.trim() ? " ob-tz-note" : ""}`}
                  />
                </div>
              }
            />
            {tzUnusable || !timezone.trim() ? (
              <p id="ob-tz-note" className="m-anote">
                {tzUnusable
                  ? "WorkPulse can't use this timezone yet, so your organization's day would close on UTC. Choose a city on the same time."
                  : "Not set — your organization's day closes on UTC until you choose one."}
              </p>
            ) : null}
            <AuthField
              id="ob-site"
              label="Website"
              hint="Optional"
              value={website}
              onChange={setWebsite}
              inputMode="text"
              autoCapitalize="none"
              spellCheck={false}
            />
          </>
        );
      }
      case "team":
        return (
          <>
            <AuthErrorSummary
              errors={badEmails.map((i) => [
                `ob-invite-${i}`,
                `Teammate ${i + 1}: that isn't an email address — fix it or clear it to continue`,
              ])}
              summaryRef={summaryRef}
            />
            <p className="m-anote mb-3">
              Each person gets an email with a link and a code to join as an Employee. You can change
              their role, department and title later from{" "}
              <SettingsLink href="/employees">Employees</SettingsLink>.
            </p>
            {emails.map((email, i) => (
              <AuthField
                key={i}
                id={`ob-invite-${i}`}
                label={`Teammate ${i + 1} — work email`}
                type="email"
                value={email}
                error={
                  badEmails.includes(i)
                    ? "That isn't an email address — fix it or clear it to continue"
                    : undefined
                }
                onChange={(v) => {
                  setEmails((prev) => prev.map((x, j) => (j === i ? v : x)));
                  setBadEmails((prev) => prev.filter((j) => j !== i));
                }}
                inputMode="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            ))}
            <button
              type="button"
              className="m-btn m-btn-ghost m-btn--sm mt-3"
              onClick={() => setEmails((prev) => [...prev, ""])}
            >
              + Add another
            </button>
          </>
        );
      case "tracking":
        if (!policy) {
          return (
            <p className="m-anote" role="status">
              {!canMonitor ? (
                <>
                  Tracking settings are changed by whoever manages monitoring in your organization,
                  from <SettingsLink href="/settings/monitoring">Settings → Monitoring</SettingsLink>.
                </>
              ) : policyFailed ? (
                <>
                  Couldn&apos;t load your current tracking settings. Continue — you can set them any
                  time in <SettingsLink href="/settings/monitoring">Settings → Monitoring</SettingsLink>.
                </>
              ) : (
                "Loading your current tracking settings…"
              )}
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
              capturing(lock) ? null : lock?.kind === "screenshots-off" ? (
                <>
                  Screenshots are switched off in{" "}
                  <SettingsLink href="/settings/features">Settings → Features</SettingsLink>, so
                  nothing is captured whatever this says. Turn them on there first.
                </>
              ) : (
                <>
                  Screenshots aren&apos;t included in your plan — see{" "}
                  <SettingsLink href="/settings/billing">Settings → Billing</SettingsLink>.
                </>
              )
            }
          />
        );
      case "dashboard":
        // There was a widget checklist here that saved nothing. The dashboard's own Customize does
        // this for real, and keeps the layout on the account.
        return (
          <p className="m-anote">
            Your dashboard shows the cards you pick. Use <strong>Customize</strong> on the Dashboard
            to add, hide or reorder them — the layout is saved to your account.
          </p>
        );
      default:
        return null;
    }
  }

  const current = ONBOARDING_STEPS[step];

  return (
    <>
      <AuthHeading
        title="Set up your workspace"
        subtitle="A few choices to get your organization started. Each step saves as you continue, and everything can be changed later."
      />
      <AuthSteps steps={ONBOARDING_STEPS.map((s) => s.title)} current={step} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleNext();
        }}
        noValidate
        aria-labelledby="ob-step-title"
      >
        <h2 id="ob-step-title" className="m-obstep__title">
          {current.title}
        </h2>
        <p className="m-obstep__hint">{current.hint}</p>

        {renderStep()}

        <div className="m-authactions">
          {step > 0 ? (
            <button
              type="button"
              className="m-btn m-btn-ghost"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={saving}
            >
              <ArrowLeft className="size-4" /> Back
            </button>
          ) : null}
          <button type="submit" className="m-btn m-btn-primary flex-1" disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="m-spin size-4" /> Saving
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
          </button>
        </div>
      </form>
    </>
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
  lockReason: React.ReactNode | null;
}) {
  const stored = cadenceMinutes(policy.cadence);
  // Switching on starts at every 5 minutes (see `saveTracking`); an org already capturing keeps its
  // own interval.
  const minutes = stored ?? 5;
  const days = policy.retention_days;
  return (
    <>
      <label className={`m-check m-obswitch${lockReason ? " is-locked" : ""}`}>
        <input
          type="checkbox"
          role="switch"
          checked={screenshots}
          onChange={(e) => onScreenshots(e.target.checked)}
          disabled={lockReason !== null}
          aria-describedby="ob-shots-what"
        />
        <span className="m-check__text">
          Take screenshots
          <span className="m-check__note" id="ob-shots-what">
            {screenshots
              ? `A screenshot of each employee's screen every ${minutes} minute${minutes === 1 ? "" : "s"} while their tracking runs, kept ${days} day${days === 1 ? "" : "s"} and then deleted. Admins with the screenshots permission can view them.`
              : "Off — no screenshots are taken."}
          </span>
        </span>
      </label>
      {lockReason ? <p className="m-anote">{lockReason}</p> : null}

      <section className="m-obnotice" aria-labelledby="ob-notice-title">
        <h3 id="ob-notice-title">Before capture starts</h3>
        <p>
          {INDICATOR[trackingMode]} You are responsible for telling them what is captured, why, who
          can see it and how long it is kept — and for any consent your local law requires.{" "}
          <Link
            href={`${legalHref("terms")}#monitoring`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline underline-offset-2"
            style={{ color: "var(--m-accent-ink)" }}
          >
            Your monitoring obligations
          </Link>{" "}
          (opens in a new tab)
        </p>
        <p>
          WorkPulse also lists what your organization records in each invite email and on the
          Download page.
        </p>
      </section>

      {policy.silent ? (
        <p className="m-obwarn">
          Your current settings hide that indicator, so employees get no on-screen notice. Changing
          screenshots here turns it back on, as does saving Settings → Monitoring.
        </p>
      ) : null}

      <p className="m-anote">
        Interval, retention and exclusions are all in{" "}
        <SettingsLink href="/settings/monitoring">Settings → Monitoring</SettingsLink>.
      </p>
    </>
  );
}
