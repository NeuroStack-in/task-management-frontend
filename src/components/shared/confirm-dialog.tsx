"use client";

/**
 * "Are you sure?" — the one confirmation pattern for consequential actions.
 *
 * The UX audit (2026-10-16, XC-07) found no consistent rule: adding an owner, approving an org
 * request, cutting screenshot retention, disconnecting Slack, restoring a role, revoking an invite,
 * rejecting or withdrawing leave all ran on one click, while closing the org or switching features
 * confirmed well. The rule now: **irreversible or access-changing → confirm, naming the consequence**;
 * reversible → do it and offer Undo in the toast.
 *
 * The description says what will happen in plain words; `children` carries anything extra (a reason
 * box, a list of what changes). The confirm button shows `busy` and stays disabled meanwhile.
 */
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  confirmDisabled = false,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** What will happen, in plain words — the consequence, not "Are you sure?". */
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  /** Extra condition on the confirm button (e.g. a required reason). */
  confirmDisabled?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
