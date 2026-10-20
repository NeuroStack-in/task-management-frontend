"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shared/page-header";
import { Loader } from "@/components/shared/loader";
import { Button } from "@/components/ui/button";
import { getPrefs, updatePrefs } from "@/modules/notifications/services/notifications.service";

type Channel = "inApp" | "email";

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

/** What this page edits: the in-app switch per notification type. */
interface NotificationPrefs {
  channels: Record<string, Record<Channel, boolean>>;
}

const INITIAL_PREFS: NotificationPrefs = {
  channels: Object.fromEntries(
    NOTIFICATION_TYPES.map((t) => [t.key, { ...t.defaults }]),
  ),
};

type PrefsDocument = Record<string, unknown>;

const isObject = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);

/**
 * Reads the server's opaque pref document into our shape, **field by field with a fallback**.
 *
 * A never-saved user gets the server's *default* document (a different shape), so nothing here may
 * assume our keys exist: each channel falls back to that type's default. This tolerates both the
 * server default and a previously-saved copy of our own shape.
 */
function fromServer(raw: unknown): NotificationPrefs {
  const doc = isObject(raw) ? raw : {};
  const rawChannels = (isObject(doc.channels) ? doc.channels : {}) as Record<
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
  return { channels };
}

/**
 * The document to store: the one we loaded, with **only the in-app switches** changed.
 *
 * The server stores the document whole and reads quiet hours, the digest and the email flags from it
 * at send time. Every save used to write this page's fallbacks for them too — `quietHours: true`,
 * `digest: "weekly"` — opting people into an overnight email blackout and a weekly digest through
 * controls the page doesn't even show (QA audit 2026-10-08, WP-517). Anything we don't edit is now
 * passed through exactly as loaded, absent stays absent.
 */
function toServer(loaded: PrefsDocument, prefs: NotificationPrefs): PrefsDocument {
  const loadedChannels = isObject(loaded.channels) ? loaded.channels : {};
  const channels: Record<string, unknown> = { ...loadedChannels };
  for (const t of NOTIFICATION_TYPES) {
    const prev = isObject(loadedChannels[t.key]) ? loadedChannels[t.key] : {};
    channels[t.key] = { ...(prev as object), inApp: prefs.channels[t.key].inApp };
  }
  return { ...loaded, channels };
}

/**
 * Settings → Notification preferences — **a personal preference, so each switch saves the moment
 * it is flipped**, with a toast saying so (UX audit 2026-10-16, XC-11 / SET-14). It used to hold a
 * draft behind a floating save bar, the same treatment as an organisation-wide policy, so it was one
 * more page where nobody could tell whether a change was already live.
 */
export function NotificationPreferences() {
  const [prefs, setPrefs] = useState<NotificationPrefs>(INITIAL_PREFS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** The latest switches, for a save that runs after later flips (saves are queued, see `flip`). */
  const prefsRef = useRef<NotificationPrefs>(INITIAL_PREFS);
  /** The stored document as last saved — written back with only our switches changed (`toServer`). */
  const storedRef = useRef<PrefsDocument>({});
  /** One save at a time, in order, so a quick on-off-on never lands out of sequence. */
  const queue = useRef<Promise<void>>(Promise.resolve());

  const load = useCallback(() => {
    let live = true;
    setLoading(true);
    setLoadError(null);
    getPrefs()
      .then((doc) => {
        if (!live) return;
        const next = fromServer(doc.prefs);
        storedRef.current = isObject(doc.prefs) ? doc.prefs : {};
        prefsRef.current = next;
        setPrefs(next);
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

  /** Flip one switch and save it straight away. A failed save puts the switches back as stored. */
  function flip(type: NotificationType) {
    const before = prefsRef.current;
    const on = !before.channels[type.key].inApp;
    const next: NotificationPrefs = {
      ...before,
      channels: { ...before.channels, [type.key]: { ...before.channels[type.key], inApp: on } },
    };
    prefsRef.current = next;
    setPrefs(next);
    queue.current = queue.current.then(async () => {
      // The newest switches, so a save queued behind another still sends everything flipped.
      const body = toServer(storedRef.current, prefsRef.current);
      try {
        await updatePrefs(body);
        storedRef.current = body;
        toast.success(`${type.label}: notifications ${on ? "on" : "off"}`, {
          id: `notif-pref-${type.key}`,
          description: "Saved to your account.",
        });
      } catch {
        const stored = fromServer(storedRef.current);
        prefsRef.current = stored;
        setPrefs(stored);
        toast.error("Couldn't save that change", {
          id: `notif-pref-${type.key}`,
          description: "Your notification preferences are as they were. Try again.",
        });
      }
    });
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
              Choose which events notify you in the app. Each switch saves as soon as you flip it.
            </p>
          </div>
        </div>

        <div className="divide-y">
          {NOTIFICATION_TYPES.map((type) => {
            const row = prefs.channels[type.key];
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
                <div className="flex shrink-0 items-center sm:pl-0">
                  <Switch
                    checked={row.inApp}
                    onCheckedChange={() => flip(type)}
                    aria-label={`Notify me in the app about ${type.label}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Delivery preferences (Quiet hours / Email digest) intentionally removed — WorkPulse
          notifications are in-app only, so there is no email timing or digest to control. */}

    </div>
  );
}
