"use client";

/**
 * "Capture now" — ask a device for a screenshot on demand.
 *
 * Lives in the agents module but is used on the screenshots page, from one person's captures: you
 * know the *person* (`userId`), which is where someone actually wants a fresh frame, so the device is
 * resolved from the fleet here rather than making the user go find it.
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
import { ApiError } from "@/lib/api";
import { captureNow, listFleet, type ApiDevice } from "../services/fleet.service";
import { effectiveUserId } from "../lib/presence";
import { deviceStateLabel, isLiveDevice } from "../lib/device-state";

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
 *
 * **The watch backs off.** After the device confirms a capture the image is in S3 within a second,
 * but its row is written by the ingest fold of the agent's **next batch**, and that interval *is* the
 * org's screenshot cadence (1-10 min). A fixed 6 s tick therefore refetched the caller's grid ~110
 * times for one click, in hidden tabs too (QA audit 2026-10-08, WP-238). The wait now starts at 6 s
 * and grows by half each time up to a minute — about 14 checks across the window — and a hidden tab
 * skips the refetch.
 */
const FIRST_POLL_MS = 6_000;
const MAX_POLL_MS = 60_000;

/**
 * How long to keep watching. The image reaches S3 in a second, but its row is written by the ingest
 * fold of the agent's next batch, and that interval **is** the org's screenshot cadence — up to ten
 * minutes on the slowest setting. Eleven minutes covers it without waiting forever.
 */
const WATCH_WINDOW_MS = 11 * 60_000;

/**
 * Why a device can't be asked right now. `null` = it can. Kept as prose because it goes straight
 * into a tooltip — an admin looking at a greyed-out button deserves the reason, not a guess.
 */
function blockedReason(device: ApiDevice | null, resolving: boolean): string | null {
  if (resolving) return "Finding this person's device…";
  if (!device) return "No agent device is registered for this person.";
  if (!isLiveDevice(device.state)) {
    return `This device has been ${deviceStateLabel(device.state).toLowerCase()}.`;
  }
  if (device.connectivity === "offline")
    return "The device is offline — it can't receive the request.";
  return null;
}

export function CaptureNowButton({
  userId,
  onRequested,
  onCaptured,
  hasShot,
  size = "sm",
}: {
  /** The person to capture; their device is resolved from the fleet. */
  userId: string;
  /** Fired once the request is accepted by the server (not by the device). */
  onRequested?: () => void;
  /** The caller refetches its grid. Called on each check while the frame is still landing, so the
   *  page updates soon after its row is written. */
  onCaptured?: () => void;
  /**
   * Does the caller's list already contain this shot? Ends the watch the moment the frame appears
   * instead of running its whole window. Without it the button watches to the timeout.
   */
  hasShot?: (shotId: string) => boolean;
  size?: "sm" | "default";
}) {
  const { can } = usePermissions();
  // Mirrors the server exactly: `MonitoringManage` to direct monitoring AND `ScreenshotsRead` to see
  // the result (fleet::capture_now). It was gated on `agents:manage`, so an IT role that manages
  // devices but not monitoring got a button that always 403'd (QA audit 2026-10-08, WP-239).
  const allowed = can("monitoring:manage") && can("screenshots:view");

  const [device, setDevice] = useState<ApiDevice | null>(null);
  /** The next check of the "waiting for the frame to land" watch. */
  const pollRef = useRef<number | undefined>(undefined);
  /**
   * The screenshot this button is waiting for: `null` when idle, `""` while asked but the 202 (and
   * its id) hasn't arrived yet. The device's answer is pushed to **every** tab of the person who
   * asked, so only a tab that is actually waiting may act on it — another tab used to flip to a
   * disabled "Uploading…" that nothing would ever clear.
   */
  const pendingShotRef = useRef<string | null>(null);
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

  // Resolve person → device. Only for someone who may act on it, so the fleet read isn't spent for
  // a viewer who'd see no button anyway.
  useEffect(() => {
    if (!userId || !allowed) return;
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
          theirs.find((d) => d.connectivity !== "offline" && isLiveDevice(d.state)) ??
          [...theirs].sort((a, b) => b.last_heartbeat - a.last_heartbeat)[0] ??
          null;
        setDevice(best);
      })
      .catch(() => alive && setDevice(null))
      .finally(() => alive && setResolving(false));
    return () => {
      alive = false;
    };
  }, [userId, allowed]);

  const targetId = device?.agent_id ?? null;
  const blocked = blockedReason(device, resolving);

  const stopWatch = useCallback(() => {
    window.clearTimeout(pollRef.current);
    pollRef.current = undefined;
    pendingShotRef.current = null;
  }, []);

  /** The requested frame is in the caller's list: the watch is over. */
  const landed = useCallback(() => {
    stopWatch();
    setPhase("idle");
    toast.success("Screenshot added", { description: "The new frame is on this page." });
  }, [stopWatch]);

  /**
   * Watch for the requested frame and keep the page current while we wait.
   *
   * Each check refetches the caller's grid, so the new screenshot appears without a manual refresh
   * and without depending on the push rail. The waits grow (see `FIRST_POLL_MS`), a hidden tab skips
   * the refetch, the watch ends when `hasShot` sees the id, and the window closes it either way — the
   * button never stays stuck.
   */
  const startWatch = useCallback(
    (shotId: string) => {
      stopWatch();
      pendingShotRef.current = shotId;
      const deadline = Date.now() + WATCH_WINDOW_MS;
      let wait = FIRST_POLL_MS;
      const tick = () => {
        if (pendingShotRef.current !== shotId) return; // stopped, or superseded by a new request
        if (Date.now() >= deadline) {
          stopWatch();
          setPhase("idle");
          toast.info("Still waiting for the upload", {
            description:
              "The device was asked, but the frame hasn't arrived yet. It lands with the agent's " +
              "next batch — the page will pick it up on the next refresh.",
          });
          return;
        }
        if (document.visibilityState !== "hidden") onCapturedRef.current?.();
        wait = Math.min(MAX_POLL_MS, Math.round(wait * 1.5));
        pollRef.current = window.setTimeout(tick, wait);
      };
      pollRef.current = window.setTimeout(tick, wait);
    },
    [stopWatch],
  );

  // Recognise the frame the moment the caller's refetched list holds it, not one check later.
  useEffect(() => {
    const id = pendingShotRef.current;
    if (id && hasShot?.(id)) landed();
  }, [hasShot, landed]);

  // A different device, or leaving the page, ends the watch — and resets the label, rather than
  // leaving a disabled "Uploading…" that nothing would clear.
  useEffect(
    () => () => {
      stopWatch();
      setPhase("idle");
    },
    [targetId, stopWatch],
  );

  // The device's answer comes back as a push addressed to whoever asked. Subscribing is the whole
  // point of the rail — without it a refusal would be indistinguishable from a slow capture.
  useEffect(() => {
    if (!allowed || !targetId) return;
    let alive = true;
    let stop: (() => void) | null = null;
    import("@/lib/push")
      .then(({ startPush }) => {
        if (!alive) return; // unmounted before the module loaded — never subscribe
        stop = startPush((msg) => {
          const m = msg as {
            kind?: string;
            agent_id?: string;
            accepted?: boolean;
            reason?: string;
            screenshot_id?: string;
          } | null;
          if (!m || m.kind !== "capture_result" || m.agent_id !== targetId) return;
          // Only the request this button is waiting for (see `pendingShotRef`).
          const pending = pendingShotRef.current;
          if (pending === null) return;
          if (pending && m.screenshot_id && m.screenshot_id !== pending) return;
          // The device answered — a refusal ends the wait; an acceptance just means the frame
          // is on its way, and the watch is what actually confirms it landed.
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
      alive = false;
      stop?.();
    };
  }, [allowed, targetId, stopWatch]);

  const request = useCallback(async () => {
    if (!targetId) return;
    stopWatch();
    // Asked, id not known yet — a device answer that beats the 202 still belongs to this request.
    pendingShotRef.current = "";
    setPhase("requesting");
    try {
      // The 202 carries the id the server minted, so the frame can be recognised when it lands —
      // this is what makes the flow independent of the push rail.
      const { screenshot_id } = await captureNow(targetId);
      // A refusal that arrived first already ended the request and said why; leaving the page
      // ended it too.
      if (pendingShotRef.current !== "") return;
      setPhase((p) => (p === "landing" ? p : "capturing"));
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

  return (
    <Button
      variant="outline"
      size={size}
      onClick={request}
      disabled={busy || resolving || !targetId || Boolean(blocked)}
      title={title}
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
