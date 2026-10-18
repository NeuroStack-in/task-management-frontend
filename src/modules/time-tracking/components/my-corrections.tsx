"use client";

/**
 * "My correction requests" — what the employee asked to fix, and where each stands (TIME-05).
 * A pending one can be withdrawn. Renders nothing until there is at least one request.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import {
  cancelCorrection,
  listMyCorrections,
  type ApiCorrection,
} from "../services/time-corrections.service";

const STATUS: Record<ApiCorrection["status"], { label: string; tone: string }> = {
  pending: { label: "Waiting for approval", tone: "bg-warning/15 text-warning" },
  approved: { label: "Approved — applied", tone: "bg-success/12 text-success" },
  rejected: { label: "Not approved", tone: "bg-destructive/12 text-destructive" },
  cancelled: { label: "Withdrawn", tone: "bg-muted text-muted-foreground" },
};

const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const day = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

/** `refreshKey` changes when a new request is filed, so the list re-reads. */
export function MyCorrections({ refreshKey = 0 }: { refreshKey?: number }) {
  const [items, setItems] = useState<ApiCorrection[] | null>(null);
  const [withdraw, setWithdraw] = useState<ApiCorrection | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    listMyCorrections().then(setItems, () => setItems([]));
  }, []);
  useEffect(load, [load, refreshKey]);

  if (!items || items.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">My correction requests</CardTitle>
        <p className="text-muted-foreground text-xs">
          Fixes you asked for. Your timesheet changes only once one is approved.
        </p>
      </CardHeader>
      <CardContent className="divide-y p-0">
        {items.slice(0, 20).map((c) => (
          <div
            key={c.request_id}
            className="flex flex-wrap items-start justify-between gap-3 px-6 py-3"
          >
            <div className="min-w-0 space-y-0.5 text-sm">
              <p className="font-medium">
                {day(c.date)} ·{" "}
                {c.kind === "add" ? (
                  <>
                    Add {clock(c.start)} – {clock(c.end)}
                  </>
                ) : (
                  <>
                    <span className="text-muted-foreground line-through">
                      {c.base_start ? clock(c.base_start) : "?"} –{" "}
                      {c.base_end ? clock(c.base_end) : "?"}
                    </span>{" "}
                    → {clock(c.start)} – {clock(c.end)}
                  </>
                )}
              </p>
              <p className="text-muted-foreground truncate text-xs">{c.reason}</p>
              {c.status === "rejected" && c.decision_reason ? (
                <p className="text-xs">Approver: {c.decision_reason}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Badge className={cn("font-normal", STATUS[c.status].tone)}>
                {STATUS[c.status].label}
              </Badge>
              {c.status === "pending" ? (
                <Button size="sm" variant="ghost" onClick={() => setWithdraw(c)}>
                  Withdraw
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
      <ConfirmDialog
        open={withdraw !== null}
        onOpenChange={(o) => !o && setWithdraw(null)}
        title="Withdraw this correction request?"
        description="It leaves your approver's queue and your timesheet stays as it is."
        confirmLabel="Withdraw"
        busy={busy}
        onConfirm={async () => {
          if (!withdraw) return;
          setBusy(true);
          try {
            await cancelCorrection(withdraw.request_id);
            toast.success("Request withdrawn");
            setWithdraw(null);
            load();
          } catch (e) {
            toast.error(friendlyError(e, "Couldn't withdraw the request."));
          } finally {
            setBusy(false);
          }
        }}
      />
    </Card>
  );
}
