"use client";

/**
 * Release (or revoke) a managed device (MANAGED-AGENT.md §6.3, Ph3). `agents:manage`.
 *
 * Release is the deliberate action behind a laptop refresh or a leaver: it frees the employee's 1:1
 * claim and stops the agent, so a replacement can be assigned. The confirm dialog states the
 * consequence in **one sentence** and nothing else — the point is that IT understands the agent
 * stops recording immediately, and that nothing already recorded is lost.
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
  onReleased,
}: {
  deviceId: string;
  employeeName: string;
  /** Called after a successful release — the page reloads the device. */
  onReleased?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const release = () => {
    setBusy(true);
    releaseDevice(deviceId)
      .then(() => {
        toast.success("Device released", {
          description: `${employeeName} can be assigned a replacement device.`,
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
            <DialogDescription>
              The agent stops recording immediately. Everything already recorded stays on{" "}
              {employeeName}&apos;s record. Assign a replacement device to them afterwards.
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
