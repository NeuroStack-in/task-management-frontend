"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsSaveBar } from "@/components/shared/settings-save-bar";
import { cn } from "@/lib/utils";

type Channel = "inApp" | "email";
type DigestValue = "off" | "daily" | "weekly";

interface NotificationType {
  key: string;
  label: string;
  description: string;
  defaults: Record<Channel, boolean>;
}

const NOTIFICATION_TYPES: NotificationType[] = [
  {
    key: "task-assignments",
    label: "Task assignments",
    description: "When a task or project is assigned to you.",
    defaults: { inApp: true, email: true },
  },
  {
    key: "approvals",
    label: "Approvals",
    description: "Decisions on your time-off requests and timesheets.",
    defaults: { inApp: true, email: true },
  },
  {
    key: "anomalies",
    label: "Productivity anomalies",
    description: "Inactivity, productivity drops, and burnout alerts for your team.",
    defaults: { inApp: true, email: false },
  },
  {
    key: "timesheet-reminders",
    label: "Timesheet reminders",
    description: "Nudges to submit your weekly timesheet before the deadline.",
    defaults: { inApp: true, email: true },
  },
  {
    key: "mentions",
    label: "Mentions & messages",
    description: "When someone @mentions you or sends a direct message.",
    defaults: { inApp: true, email: false },
  },
  {
    key: "billing",
    label: "Billing & account",
    description: "Invoices, payment issues, and seat changes.",
    defaults: { inApp: true, email: true },
  },
  {
    key: "security",
    label: "Security alerts",
    description: "New sign-ins, MFA changes, and suspicious activity.",
    defaults: { inApp: true, email: true },
  },
  {
    key: "product-updates",
    label: "Product updates",
    description: "New features, tips, and occasional announcements.",
    defaults: { inApp: false, email: false },
  },
];

const DIGEST_OPTIONS: { value: DigestValue; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
];

interface NotificationPrefs {
  channels: Record<string, Record<Channel, boolean>>;
  quietHours: boolean;
  digest: DigestValue;
}

const INITIAL_PREFS: NotificationPrefs = {
  channels: Object.fromEntries(
    NOTIFICATION_TYPES.map((t) => [t.key, { ...t.defaults }]),
  ),
  quietHours: true,
  digest: "weekly",
};

export function NotificationPreferences() {
  // Working draft vs. last-saved baseline — the diff drives the save bar.
  const [saved, setSaved] = useState<NotificationPrefs>(INITIAL_PREFS);
  const [draft, setDraft] = useState<NotificationPrefs>(INITIAL_PREFS);
  const [saving, setSaving] = useState(false);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(saved),
    [draft, saved],
  );

  function toggleChannel(key: string, channel: Channel) {
    setDraft((p) => ({
      ...p,
      channels: {
        ...p.channels,
        [key]: { ...p.channels[key], [channel]: !p.channels[key][channel] },
      },
    }));
  }

  function handleReset() {
    setDraft(saved);
  }

  function handleSave() {
    if (!dirty || saving) return;
    const next = draft;
    setSaving(true);
    // Simulated persistence latency (Phase 1 is frontend-only).
    setTimeout(() => {
      setSaved(next);
      setSaving(false);
      toast.success("Notification preferences saved");
    }, 500);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Choose what you're notified about and where."
      />

      {/* ── Per-type channel matrix ── */}
      <Card>
        <CardHeader>
          <CardTitle>Notification types</CardTitle>
          <CardDescription>
            Pick a delivery channel for each kind of event.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {/* Channel header (desktop) */}
          <div className="hidden items-center gap-4 border-b px-6 py-2 sm:flex">
            <span className="flex-1" />
            <span className="w-16 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              In-app
            </span>
            <span className="w-16 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Email
            </span>
          </div>

          <div className="divide-y">
            {NOTIFICATION_TYPES.map((type) => {
              const row = draft.channels[type.key];
              return (
                <div
                  key={type.key}
                  className="flex flex-col gap-2 px-6 py-3 sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{type.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {type.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 sm:pl-0">
                    {(["inApp", "email"] as Channel[]).map((channel) => (
                      <div
                        key={channel}
                        className="flex w-16 items-center justify-start gap-2 sm:justify-center"
                      >
                        <span className="text-xs text-muted-foreground sm:hidden">
                          {channel === "inApp" ? "In-app" : "Email"}
                        </span>
                        <Switch
                          checked={row[channel]}
                          onCheckedChange={() => toggleChannel(type.key, channel)}
                          aria-label={`${type.label} — ${
                            channel === "inApp" ? "in-app" : "email"
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Delivery preferences ── */}
      <Card>
        <CardHeader>
          <CardTitle>Delivery</CardTitle>
          <CardDescription>
            Control timing and how much email WorkPulse sends.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          <div className="flex items-center justify-between gap-6 py-3">
            <div>
              <p className="text-sm font-medium">Quiet hours</p>
              <p className="text-xs text-muted-foreground">
                Pause non-urgent notifications from 8:00 PM to 8:00 AM in your
                timezone.
              </p>
            </div>
            <Switch
              checked={draft.quietHours}
              onCheckedChange={(v) =>
                setDraft((p) => ({ ...p, quietHours: v }))
              }
            />
          </div>
          <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <div>
              <p className="text-sm font-medium">Email digest</p>
              <p className="text-xs text-muted-foreground">
                Bundle low-priority updates into a single recurring email.
              </p>
            </div>
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {DIGEST_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDraft((p) => ({ ...p, digest: opt.value }))}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    draft.digest === opt.value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sticky save bar — appears only when there are unsaved changes */}
      <SettingsSaveBar
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onReset={handleReset}
        saveLabel="Save preferences"
      />
    </div>
  );
}
