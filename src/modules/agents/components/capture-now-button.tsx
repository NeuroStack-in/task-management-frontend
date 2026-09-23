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
 * **The response only means "asked."** The real outcome — captured, or a technical failure —
 * arrives on the push rail as `capture_result` and is toasted then. (Older agents could also refuse
 * on privacy grounds; the current agent captures on demand, but the reason map below still renders
 * any legacy refusal correctly.) If the socket is down the toast simply never comes; the audit log
 * still records both the request and the device's answer.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import { captureNow, listFleet, type ApiDevice } from "../services/fleet.service";
import { effectiveUserId } from "../lib/presence";

/**
 * The push ack is the **fast** path, not the only one.
 *
 * `capture_result` reaches the browser over MQTT, and that connection can be absent (no push grant,
 * blocked WebSocket, a tab that never subscribed) while the capture itself works perfectly — the
 * server's audit shows request → captured in 1-2 s either way. Reporting "no answer from the
 * device" on a missing push therefore accused the device of a fault the browser owned.
 *
 * So the button watches for the **frame itself**, using the `screenshot_id` the 202 already
 * returned, and treats the ack as an optimisation when it arrives.
 */
const POLL_MS = 6_000;

/**
 * How long to keep watching. The image reaches S3 in a second, but its row is written by the ingest
 * fold of the agent's next batch, and that interval **is** the org's screenshot cadence — up to ten
 * minutes on the slowest setting. Eleven minutes covers it without waiting forever.
 */
const WATCH_WINDOW_MS = 11 * 60_000;

/**
 * After the device confirms a capture the image is in S3 within a second — but its row is written
 * by the **ingest fold of the agent's next batch**, and the batch interval *is* the org's
 * screenshot cadence (1-10 min). So "captured" and "visible in the grid" are different moments, and
 * the button keeps refetching until the frame lands rather than leaving a stale page behind.
 */
const LANDING_POLL_MS = 10_000;
const LANDING_WINDOW_MS = 4 * 60_000;

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
  hasShot,
  size = "sm",
  tone = "default",
}: {
  /** Target device directly (device detail). Takes precedence over `userId`. */
  agentId?: string;
  /** Target a person; the device is resolved from the fleet (screenshots page). */
  userId?: string;
  /** Fired once the request is accepted by the server (not by the device). */
  onRequested?: () => void;
  /** Fired when the device confirms a capture — the caller refetches the grid. Called repeatedly
   *  while the frame is still landing, so the page updates the moment its row is written. */
  onCaptured?: () => void;
  /**
   * Does the caller's list already contain this shot? Lets the poll stop the instant the frame
   * appears instead of running its whole window. Without it the button polls to the timeout.
   */
  hasShot?: (shotId: string) => boolean;
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
  /** Pending "no answer" timer — cleared by the ack, by the next request, and on unmount. */
  const waitingRef = useRef<number | undefined>(undefined);
  /** Interval + deadline for the "waiting for the frame to land" poll. */
  const pollRef = useRef<number | undefined>(undefined);
  const hasShotRef = useRef(hasShot);
  hasShotRef.current = hasShot;
  const onCapturedRef = useRef(onCaptured);
  onCapturedRef.current = onCaptured;
  const [resolving, setResolving] = useState(false);
  /**
   * What the operator is waiting for, so the button can say it:
   *   `requesting` — the HTTP call; `capturing` — sent, waiting for the device's answer;
   *   `landing` — the device captured, waiting for the frame to reach the grid.
   */
  const [phase, setPhase] = useState<"idle" | "requesting" | "capturing" | "landing">("idle");
  const busy = phase !== "idle";

  // Resolve person → device. Only when we weren't handed an agent id, and only for someone who
  // may act on it, so the fleet read isn't spent for a viewer who'd see a disabled button anyway.
  useEffect(() => {
    if (agentId || !userId || !allowed) return;
    let alive = true;
    setResolving(true);
    listFleet()
      .then((fleet) => {
        if (!alive) return;
        // Route through effectiveUserId: a managed device attributes to its assigned employee, whose
        // id may not be in `user_id` at all (MANAGED-AGENT.md §8 Ph2).
        const theirs = fleet.devices.filter((d) => effectiveUserId(d) === userId);
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

  const stopWatch = useCallback(() => {
    window.clearInterval(pollRef.current);
    window.clearTimeout(waitingRef.current);
  }, []);

  /**
   * Watch for the requested frame and keep the page current while we wait.
   *
   * Every tick refetches the caller's grid, so the new screenshot appears **live** the moment its
   * row exists — no manual refresh, and no dependence on the push rail. The watch ends when
   * `hasShot` sees the id, and the button never stays stuck: the window closes it either way.
   */
  const startWatch = useCallback(
    (shotId: string) => {
      stopWatch();
      const deadline = Date.now() + WATCH_WINDOW_MS;
      const tick = () => {
        onCapturedRef.current?.();
        if (hasShotRef.current?.(shotId)) {
          stopWatch();
          setPhase("idle");
          toast.success("Screenshot added", { description: "The new frame is on this page." });
          return;
        }
        if (Date.now() >= deadline) {
          stopWatch();
          setPhase("idle");
          toast.info("Still waiting for the upload", {
            description:
              "The device was asked, but the frame hasn't arrived yet. It lands with the agent's " +
              "next batch — the page will pick it up on the next refresh.",
          });
        }
      };
      pollRef.current = window.setInterval(tick, POLL_MS);
    },
    [stopWatch],
  );

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
            screenshot_id?: string;
          } | null;
          if (!m || m.kind !== "capture_result" || m.agent_id !== targetId) return;
          // The device answered — a refusal ends the wait; an acceptance just means the frame
          // is on its way, and the poll below is what actually confirms it landed.
          if (m.accepted) {
            setPhase("landing");
          } else {
            stopWatch();
            setPhase("idle");
            // The agent owns this vocabulary and may add reasons faster than this UI learns them,
            // so an unknown one degrades to an honest sentence rather than a wrong one.
            const REASONS: Record<string, string> = {
              privacy_pause: "The employee has capture paused.",
              // A managed device has no project timer — "not tracking" means it isn't in a
              // capture-eligible state right now (out of hours, policy off, or an exception).
              not_tracking: "That device isn't tracking right now.",
              no_session: "No one is signed in on that device.",
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
    return () => {
      stopWatch();
      stop?.();
    };
  }, [allowed, targetId, onCaptured, stopWatch]);

  const request = useCallback(async () => {
    if (!targetId) return;
    stopWatch();
    setPhase("requesting");
    try {
      // The 202 carries the id the server minted, so the frame can be recognised when it lands —
      // this is what makes the flow independent of the push rail.
      const { screenshot_id } = await captureNow(targetId);
      setPhase("capturing");
      startWatch(screenshot_id);
      toast.success("Capture requested", {
        description: "The device will capture and upload it — it appears here shortly.",
      });
      onRequested?.();
    } catch (e) {
      stopWatch();
      setPhase("idle");
      toast.error(e instanceof ApiError ? e.message : "Couldn't request a capture.");
    }
  }, [targetId, onRequested, startWatch, stopWatch]);

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
      {phase === "requesting"
        ? "Requesting…"
        : phase === "capturing"
          ? "Capturing…"
          : phase === "landing"
            ? "Uploading…"
            : "Capture now"}
    </Button>
  );
}
