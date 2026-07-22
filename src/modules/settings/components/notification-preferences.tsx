"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Loader } from "@/components/shared/loader";
import { Button } from "@/components/ui/button";
import { getPrefs, updatePrefs } from "@/modules/notifications/services/notifications.service";
import { cn } from "@/lib/utils";

type Channel = "inApp" | "email";
type DigestValue = "off" | "daily" | "weekly";

interface NotificationType {
  key: string;
  label: string;
  description: string;
  defaults: Record<Channel, boolean>;
}

/**
 * Only notification types the backend can actually produce today (fan_out in
 * notifications/src/consumers.rs). Rows for planned-but-unbuilt producers (anomaly alerts,
 * timesheet reminders, mentions, product updates) were removed 2026-07-22: a toggle for an event
 * that can never fire reads as a broken feature, not a preference. When a producer lands, add its
 * row back here — the settings document and the consumer already handle unknown keys, so the
 * toggle is live the moment the row exists.
 */
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
    description: "Decisions on your time-off requests.",
    defaults: { inApp: true, email: true },
  },
  {
    key: "billing",
    label: "Billing & account",
    description: "Plan and seat changes for your organization.",
    defaults: { inApp: true, email: true },
  },
  {
    key: "security",
    label: "Security alerts",
    description: "MFA resets and other security changes to your account.",
    defaults: { inApp: true, email: true },
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

const DIGEST_VALUES: DigestValue[] = ["off", "daily", "weekly"];

/**
 * Reads the server's opaque pref document into our shape, **field by field with a fallback**.
 *
 * A never-saved user gets the server's *default* document (a different shape), so nothing here may
 * assume our keys exist: each channel falls back to that type's default, `digest`/`quietHours` fall
 * back to `INITIAL_PREFS` when absent or the wrong type. This tolerates both the server default and a
 * previously-saved copy of our own shape.
 */
function fromServer(raw: unknown): NotificationPrefs {
  const doc = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const rawChannels = (doc.channels && typeof doc.channels === "object" ? doc.channels : {}) as Record<
    string,
    { inApp?: unknown; email?: unknown } | undefined
  >;
  const channels = Object.fromEntries(
    NOTIFICATION_TYPES.map((t) => {
      const r = rawChannels[t.key];
      return [
        t.key,
        {
          inApp: typeof r?.inApp === "boolean" ? r.inApp : t.defaults.inApp,
          email: typeof r?.email === "boolean" ? r.email : t.defaults.email,
        },
      ];
    }),
  );
  const digest = DIGEST_VALUES.includes(doc.digest as DigestValue)
    ? (doc.digest as DigestValue)
    : INITIAL_PREFS.digest;
  const quietHours = typeof doc.quietHours === "boolean" ? doc.quietHours : INITIAL_PREFS.quietHours;
  return { channels, quietHours, digest };
}

export function NotificationPreferences() {
  // Working draft vs. last-saved baseline — the diff drives the save bar.
  const [saved, setSaved] = useState<NotificationPrefs>(INITIAL_PREFS);
  const [draft, setDraft] = useState<NotificationPrefs>(INITIAL_PREFS);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    let live = true;
    setLoading(true);
    setLoadError(null);
    getPrefs()
      .then((doc) => {
        if (!live) return;
        const prefs = fromServer(doc.prefs);
        setSaved(prefs);
        setDraft(prefs);
      })
      .catch(() => {
        if (live) setLoadError("Couldn't load your notification preferences.");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => load(), [load]);

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

  async function handleSave() {
    if (!dirty || saving) return;
    const next = draft;
    setSaving(true);
    try {
      await updatePrefs(next);
      setSaved(next);
      toast.success("Notification preferences saved");
    } catch {
      toast.error("Couldn't save your preferences. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader label="Loading preferences…" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Notification preferences"
          description="Choose what you're notified about and where."
        />
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button variant="outline" size="sm" onClick={load}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notification preferences"
        description="Choose what you're notified about and where."
      />

      {/* ── Per-type channel matrix ── */}
      <Card className="gap-0 overflow-hidden p-0 [--card-spacing:0px]">
        {/* Heading + column labels share one bordered row, so the divider sits
            directly beneath the heading (no stray flex-gap above it). */}
        <div className="flex items-end justify-between gap-4 border-b border-border px-5 pt-5 pb-4">
          <div>
            <h3 className="font-heading text-base font-medium leading-snug">
              Notification types
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick a delivery channel for each kind of event.
            </p>
          </div>
          <div className="hidden shrink-0 items-center gap-4 sm:flex">
            <span className="w-16 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              In-app
            </span>
            <span className="w-16 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Email
            </span>
          </div>
        </div>

        <div className="divide-y">
          {NOTIFICATION_TYPES.map((type) => {
            const row = draft.channels[type.key];
            return (
              <div
                key={type.key}
                className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:gap-4"
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
