"use client";

/**
 * Release a device (MANAGED-AGENT.md §6.3, Ph3). `agents:manage`.
 *
 * Release is the deliberate action behind a laptop refresh or a leaver. What it does depends on the
 * kind of agent, and the backend forks on that (`fleet::features::release_device`):
 *
 * - A **managed** device has its credential revoked and its employee's 1:1 claim freed.
 * - An **interactive** desktop agent is *told* to stop: its timer stops, it flushes what it owes,
 *   and it signs the employee out. It holds no claim and no credential to revoke.
 *
 * The confirm dialog leads with the half the employee will actually experience — being signed out
 * of an app they may be mid-task in — because that is the consequence IT must have understood
 * before clicking, and it is the one that generates the support call if it arrives unannounced.
 *
 * **This only reaches agents on v0.1.20 or later.** Earlier builds have no handler for either the
 * MQTT command or the ack flag and keep running; they ignore the release rather than failing on it.
 */

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Unplug } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { friendlyError } from "@/lib/errors";
import { releaseDevice } from "../services/fleet.service";

export function ReleaseDeviceButton({
  deviceId,
  employeeName,
  managed = false,
  onReleased,
}: {
  deviceId: string;
  /**
   * Who the device belongs to, for the copy. Optional: the owner lookup can fail or be out of the
   * caller's reach, and that must not take Release away (WP-240) — the copy then says "the employee".
   */
  employeeName?: string;
  /**
   * A managed (login-less) device: release revokes its credential and frees the 1:1 claim — there is
   * no app to be signed out of, so the interactive copy described the wrong product (WP-066).
   */
  managed?: boolean;
  /** Called after a successful release — the page reloads the device. */
  onReleased?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const who = employeeName ?? "the employee";
  const Who = employeeName ?? "The employee";

  const release = () => {
    setBusy(true);
    releaseDevice(deviceId)
      .then(() => {
        // Said as what actually happens: an interactive agent is told to sign out and does so at
        // its next check-in (an asleep laptop, later); a managed device's credential is revoked.
        toast.success("Device released", {
          description: managed
            ? "Its credential is revoked and the laptop can be enrolled again — for anyone."
            : `${Who} will be signed out of the desktop app at its next check-in.`,
        });
        setOpen(false);
        onReleased?.();
      })
      .catch((e) => toast.error("Couldn't release the device", { description: friendlyError(e) }))
      .finally(() => setBusy(false));
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Unplug className="size-4" /> Release
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Release this device?</DialogTitle>
            {/* Says the part that is visible to the employee **first** — they are about to be
                signed out of an app they may be mid-task in, and that is the consequence IT needs
                to have understood before clicking, not a detail below the fold.

                It no longer says "assign a replacement device": that describes freeing the 1:1
                claim a *managed* device holds, which the desktop agent never takes. The employee
                simply signs in again — on this laptop or a new one — and that is what to promise. */}
            <DialogDescription>
              {managed ? (
                <>
                  The monitoring service on this laptop loses its credential and stops reporting,
                  and the laptop is free to enrol for someone else. Everything already recorded
                  stays on {who}&apos;s record.
                </>
              ) : (
                <>
                  {Who}&apos;s timer stops and they are signed out of the desktop app at
                  its next check-in. Everything already recorded stays on their record, and they
                  can sign in again on this laptop or a replacement.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={release} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4" />}
              Release device
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
