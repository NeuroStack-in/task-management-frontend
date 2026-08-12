"use client";

/**
 * The **legal capture gate** editor (MANAGED-AGENT.md §9.2, D16) — the org-level authorisation and the
 * permitted hours the managed agent enforces before *any* screenshot or activity capture. Self-
 * contained (its own load + version-locked save via `PUT /v1/fleet/capture-gate`) so it doesn't have
 * to thread into the tracking-policy form, which is version-locked on a different item.
 *
 * Fail-closed: until an admin turns the policy on here, every managed device is heartbeat-only.
 */
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader } from "@/components/shared/loader";
import { ApiError } from "@/lib/api";
import {
  getTrackingPolicy,
  updateCaptureGate,
  type CaptureGate,
} from "@/modules/agents/services/fleet.service";

const DAYS = [
  { n: 1, label: "Mon" },
  { n: 2, label: "Tue" },
  { n: 3, label: "Wed" },
  { n: 4, label: "Thu" },
  { n: 5, label: "Fri" },
  { n: 6, label: "Sat" },
  { n: 7, label: "Sun" },
];

/** `minutes` (0..1439) → `HH:MM`. */
function toHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
/** `HH:MM` → minutes-of-day, clamped 0..1439. */
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  return Math.min(1439, Math.max(0, (h || 0) * 60 + (m || 0)));
}

export function CaptureGateCard({ canManage }: { canManage: boolean }) {
  const [gate, setGate] = useState<CaptureGate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Local form state.
  const [policyActive, setPolicyActive] = useState(false);
  const [windowOn, setWindowOn] = useState(false);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("18:00");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);

  useEffect(() => {
    let live = true;
    getTrackingPolicy()
      .then((cfg) => {
        if (!live) return;
        const g = cfg.capture_gate;
        setGate(g);
        setPolicyActive(g.capture_policy_active);
        if (g.capture_window) {
          setWindowOn(true);
          setStart(toHHMM(g.capture_window.start_minute));
          setEnd(toHHMM(g.capture_window.end_minute));
          setWeekdays(
            g.capture_window.weekdays.length ? g.capture_window.weekdays : [1, 2, 3, 4, 5],
          );
        }
      })
      .catch((e) => live && setError(e instanceof ApiError ? e.message : "Failed to load"));
    return () => {
      live = false;
    };
  }, []);

  async function save() {
    if (!gate) return;
    setSaving(true);
    try {
      const updated = await updateCaptureGate({
        capture_policy_active: policyActive,
        capture_window: windowOn
          ? {
              weekdays: [...weekdays].sort((a, b) => a - b),
              start_minute: toMinutes(start),
              end_minute: toMinutes(end),
            }
          : null,
        expected_version: gate.version,
      });
      setGate(updated);
      toast.success("Capture policy saved", {
        description: policyActive
          ? "Managed devices will capture within the rules you set."
          : "Capture is off — managed devices report attendance only.",
      });
    } catch (e) {
      if (e instanceof ApiError && e.code === "version_conflict") {
        toast.error("Someone else changed this", { description: "Reload and try again." });
      } else {
        toast.error("Save failed", {
          description: e instanceof ApiError ? e.message : "Please try again.",
        });
      }
    } finally {
      setSaving(false);
    }
  }

  function toggleDay(n: number) {
    setWeekdays((cur) => (cur.includes(n) ? cur.filter((d) => d !== n) : [...cur, n]));
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">{error}</CardContent>
      </Card>
    );
  }
  if (!gate) return <Loader />;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          Capture authorisation
        </CardTitle>
        <CardDescription>
          The legal gate managed devices enforce before any screenshot or activity capture. Off by
          default — attendance is always recorded; capture happens only inside these rules.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Master switch */}
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-medium">Allow capture on managed devices</span>
            <span className="block text-xs text-muted-foreground">
              When off, devices report attendance only — no screenshots, no activity.
            </span>
          </span>
          <Switch
            checked={policyActive}
            onCheckedChange={setPolicyActive}
            disabled={!canManage}
          />
        </label>

        {/* Capture window */}
        <div className="space-y-3 border-t border-border pt-4">
          <label className="flex items-center justify-between gap-4">
            <span>
              <span className="block text-sm font-medium">Restrict to a capture window</span>
              <span className="block text-xs text-muted-foreground">
                Device-local time. Off ⇒ capture any time the other rules allow.
              </span>
            </span>
            <Switch
              checked={windowOn}
              onCheckedChange={setWindowOn}
              disabled={!canManage || !policyActive}
            />
          </label>

          {windowOn ? (
            <div className="space-y-3 pl-1">
              <div className="flex items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <span className="text-muted-foreground">From</span>
                  <input
                    type="time"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    disabled={!canManage}
                    className="rounded-md border border-border bg-background px-2 py-1"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-muted-foreground">to</span>
                  <input
                    type="time"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    disabled={!canManage}
                    className="rounded-md border border-border bg-background px-2 py-1"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DAYS.map((d) => (
                  <button
                    key={d.n}
                    type="button"
                    disabled={!canManage}
                    onClick={() => toggleDay(d.n)}
                    className={
                      "rounded-full border px-3 py-1 text-xs font-medium transition " +
                      (weekdays.includes(d.n)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground")
                    }
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {canManage ? (
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save capture policy"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
