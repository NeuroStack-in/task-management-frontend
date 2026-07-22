"use client";

import { useEffect, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ONBOARDING_STEPS } from "@/modules/onboarding/steps";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
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
} from "@/modules/agents/services/fleet.service";

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

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </label>
  );
}

function CheckRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2.5 rounded-lg border p-3 text-sm">
      <Checkbox checked={checked} onCheckedChange={(v) => onCheckedChange(v === true)} />
      {label}
    </label>
  );
}

const WIDGETS = [
  "Productivity heatmap",
  "Attendance",
  "Team comparison",
  "Top employees",
  "Recent alerts",
  "Billing overview",
] as const;

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
  const [roles, setRoles] = useState<ApiRole[]>([]);

  // Step 3 — tracking
  const [idle, setIdle] = useState(true); // agent-side only — never sent to the server
  const [screenshots, setScreenshots] = useState(true);
  const [silent, setSilent] = useState(false);

  // Step 4 — dashboard (local only — no backend for widget prefs)
  const [widgets, setWidgets] = useState<Record<string, boolean>>({
    "Productivity heatmap": true,
    Attendance: true,
    "Team comparison": true,
    "Top employees": false,
    "Recent alerts": true,
    "Billing overview": false,
  });

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

  async function saveTeam() {
    const valid = emails.map((e) => e.trim()).filter((e) => EMAIL_RE.test(e));
    if (valid.length === 0) {
      await markStep("invite_team", "skipped");
      return;
    }
    const role = defaultRole(roles);
    if (!role) {
      toast.error("Couldn't send invites", {
        description: "Roles weren't available. Invite teammates later from Employees.",
      });
      await markStep("invite_team", "skipped");
      return;
    }
    // Invites now require a department + title (server 400s without them). A fresh org has no
    // departments yet, so ensure a starter one exists; joiners land there with a generic title,
    // both refinable later from Employees (edit employee). Real placement, not a bypass.
    let departmentId: string;
    try {
      const depts = await listDepartments();
      departmentId = depts[0]?.id ?? (await createDepartment("General")).id;
    } catch {
      toast.error("Couldn't prepare a department for invites", {
        description: "Invite teammates later from Employees.",
      });
      await markStep("invite_team", "skipped");
      return;
    }
    let invited = 0;
    let failed = 0;
    for (const email of valid) {
      try {
        await createInvite({
          email,
          role_id: role.id,
          department_id: departmentId,
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
            : "Filed under General with a placeholder title — refine from Employees.",
      });
    } else if (failed > 0) {
      toast.error("Couldn't send invites", {
        description: "You can invite teammates later from Employees.",
      });
    }
    await markStep("invite_team", invited > 0 ? "done" : "skipped");
  }

  async function saveTracking() {
    try {
      const cfg = await getTrackingPolicy();
      const t = cfg.tracking;
      await updateTrackingPolicy({
        cadence: screenshots ? "min5" : "off",
        blur_level: t.blur_level,
        retention_days: t.retention_days,
        silent,
        auto_update: t.auto_update,
        expected_version: t.version,
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        toast.message("Monitoring isn't in your plan", {
          description: "Tracking preferences were skipped. You can enable it later.",
        });
      } else if (err instanceof ApiError && err.status === 409) {
        toast.message("Tracking policy changed elsewhere", {
          description: "Your changes weren't applied. Review it later in Agents.",
        });
      } else {
        toast.error("Couldn't save tracking preferences", {
          description: "You can configure tracking later in Agents.",
        });
      }
    }
    // Mark progress regardless — "skipped" only when nothing was turned on.
    await markStep("tracking", screenshots || silent ? "done" : "skipped");
  }

  async function finishDashboard() {
    // No backend for widget preferences — selection stays local. Just record the milestone.
    await markStep("personalize", "done");
  }

  async function handleNext() {
    if (saving) return;
    setSaving(true);
    try {
      const key = ONBOARDING_STEPS[step].key;
      if (key === "org") await saveOrg();
      else if (key === "team") await saveTeam();
      else if (key === "tracking") await saveTracking();
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
                  onChange={(e) =>
                    setEmails((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                  }
                />
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
        return (
          <div className="space-y-3">
            <ToggleRow
              label="Idle detection"
              description="Pause timers after inactivity."
              checked={idle}
              onCheckedChange={setIdle}
            />
            <ToggleRow
              label="Screenshots"
              description="Capture periodic screenshots."
              checked={screenshots}
              onCheckedChange={setScreenshots}
            />
            <ToggleRow
              label="Silent mode"
              description="Track quietly in the background."
              checked={silent}
              onCheckedChange={setSilent}
            />
          </div>
        );
      case "dashboard":
        return (
          <div className="grid gap-2.5 sm:grid-cols-2">
            {WIDGETS.map((label) => (
              <CheckRow
                key={label}
                label={label}
                checked={Boolean(widgets[label])}
                onCheckedChange={(v) => setWidgets((prev) => ({ ...prev, [label]: v }))}
              />
            ))}
          </div>
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
