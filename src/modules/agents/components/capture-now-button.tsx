"use client";

/**
 * "Capture now" — ask a device for a screenshot on demand.
 *
 * Lives in the agents module but is used from **two** places, because the two have different
 * starting points and the same destination:
 *   * device detail — you already know the device (`agentId`);
 *   * the screenshots page — you know the *person* (`userId`), which is where someone actually
 *     wants a fresh frame, so the device is resolved from the fleet here rather than making the
 *     user go find it.
 *
 * **The response only means "asked."** The device holds the final veto — it refuses during a
 * privacy pause, without consent, when no timer is running, or on an excepted window — so this
 * never claims a capture happened. The real outcome arrives on the push rail as `capture_result`
 * and is toasted then. If the socket is down the toast simply never comes; the audit log still
 * records both the request and the device's answer.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { captureNow, listFleet, type ApiDevice } from "../services/fleet.service";

/**
 * Why a device can't be asked right now. `null` = it can. Kept as prose because it goes straight
 * into a tooltip — an admin looking at a greyed-out button deserves the reason, not a guess.
 */
function blockedReason(device: ApiDevice | null, resolving: boolean): string | null {
  if (resolving) return "Finding this person's device…";
  if (!device) return "No agent device is registered for this person.";
  if (device.state === "deactivated") return "This device has been deactivated.";
  if (device.connectivity === "offline")
    return "The device is offline — it can't receive the request.";
  return null;
}

export function CaptureNowButton({
  agentId,
  userId,
  onRequested,
  onCaptured,
  size = "sm",
  tone = "default",
}: {
  /** Target device directly (device detail). Takes precedence over `userId`. */
  agentId?: string;
  /** Target a person; the device is resolved from the fleet (screenshots page). */
  userId?: string;
  /** Fired once the request is accepted by the server (not by the device). */
  onRequested?: () => void;
  /** Fired when the device confirms a capture — the caller can refetch the grid. */
  onCaptured?: () => void;
  size?: "sm" | "default";
  /**
   * Where the button sits. `onFeature` is for the saturated `bg-feature` hero on device detail:
   * the default `outline` variant paints `bg-background` with a `border-input`, which on teal reads
   * as a washed-out ghost of a button rather than the page's main action.
   */
  tone?: "default" | "onFeature";
}) {
  const { can } = usePermissions();
  // Mirrors the server: direct monitoring AND be allowed to see the result.
  const allowed = can("agents:manage") && can("screenshots:view");

  const [device, setDevice] = useState<ApiDevice | null>(null);
  const [resolving, setResolving] = useState(false);
  const [busy, setBusy] = useState(false);

  // Resolve person → device. Only when we weren't handed an agent id, and only for someone who
  // may act on it, so the fleet read isn't spent for a viewer who'd see a disabled button anyway.
  useEffect(() => {
    if (agentId || !userId || !allowed) return;
    let alive = true;
    setResolving(true);
    listFleet()
      .then((fleet) => {
        if (!alive) return;
        const theirs = fleet.devices.filter((d) => d.user_id === userId);
        // Most recently heard from wins: a person with a desktop and a laptop should get the one
        // they're actually sitting at, not whichever the API happened to list first.
        const best =
          theirs.find((d) => d.connectivity !== "offline" && d.state !== "deactivated") ??
          [...theirs].sort((a, b) => b.last_heartbeat - a.last_heartbeat)[0] ??
          null;
        setDevice(best);
      })
      .catch(() => alive && setDevice(null))
      .finally(() => alive && setResolving(false));
    return () => {
      alive = false;
    };
  }, [agentId, userId, allowed]);

  const targetId = agentId ?? device?.agent_id ?? null;
  const blocked = agentId ? null : blockedReason(device, resolving);

  // The device's answer comes back as a push addressed to whoever asked. Subscribing is the whole
  // point of the rail — without it a refusal would be indistinguishable from a slow capture.
  useEffect(() => {
    if (!allowed || !targetId) return;
    let stop: (() => void) | null = null;
    import("@/lib/push")
      .then(({ startPush }) => {
        stop = startPush((msg) => {
          const m = msg as {
            kind?: string;
            agent_id?: string;
            accepted?: boolean;
            reason?: string;
          } | null;
          if (!m || m.kind !== "capture_result" || m.agent_id !== targetId) return;
          if (m.accepted) {
            toast.success("Screenshot captured", {
              description: "It appears here as soon as the device uploads it.",
            });
            onCaptured?.();
          } else {
            // The agent owns this vocabulary and may add reasons faster than this UI learns them,
            // so an unknown one degrades to an honest sentence rather than a wrong one.
            const REASONS: Record<string, string> = {
              privacy_pause: "The employee has capture paused.",
              not_tracking: "No timer is running on that device.",
              no_consent: "The employee hasn't consented to capture.",
              excepted: "The active window is on the exception list.",
              upload_host_rejected: "The device wouldn't upload to that destination.",
              capture_failed: "The device couldn't capture right now.",
            };
            toast.warning("Capture declined", {
              description:
                (m.reason && REASONS[m.reason]) ?? "The device declined the request.",
            });
          }
        });
      })
      .catch(() => {});
    return () => stop?.();
  }, [allowed, targetId, onCaptured]);

  const request = useCallback(async () => {
    if (!targetId) return;
    setBusy(true);
    try {
      await captureNow(targetId);
      toast.success("Capture requested", {
        description:
          "The device decides — it declines during a privacy pause or when no timer is running.",
      });
      onRequested?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't request a capture.");
    } finally {
      setBusy(false);
    }
  }, [targetId, onRequested]);

  const title = useMemo(
    () => blocked ?? "Ask this device for a screenshot now",
    [blocked],
  );

  if (!allowed) return null;

  const onFeature = tone === "onFeature";

  return (
    <Button
      variant={onFeature ? "ghost" : "outline"}
      size={size}
      onClick={request}
      disabled={busy || resolving || !targetId || Boolean(blocked)}
      title={title}
      className={cn(
        onFeature && [
          // Inverted rather than translucent: a solid surface makes this read as the hero's action
          // at a glance. `text-feature` is safe on white in every palette — each one's `--feature`
          // is a saturated or dark colour (indigo, teal, espresso, terracotta).
          "bg-white font-medium text-feature shadow-sm hover:bg-white/90 active:bg-white/80",
          // The ring has to be visible against the banner, not against the page background.
          "focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-0",
          // Blocked (offline, deactivated, no device) is a *state*, not a broken button: it settles
          // into the banner's own glass language instead of a 50%-opacity white smear. The title
          // still carries the reason.
          "disabled:bg-white/15 disabled:text-feature-foreground/70 disabled:opacity-100 disabled:shadow-none disabled:ring-1 disabled:ring-inset disabled:ring-white/25",
        ],
      )}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
      {busy ? "Requesting…" : "Capture now"}
    </Button>
  );
}
