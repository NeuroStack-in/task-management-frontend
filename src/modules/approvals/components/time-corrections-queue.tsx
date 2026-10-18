"use client";

/**
 * "Time corrections" on the Approvals page — employees' requests to fix their tracked time
 * (owner decision 2026-10-18, UX audit TIME-05). Approving applies the fix to their timesheet at
 * once, and payroll and attendance follow; rejecting leaves it as it was. Never your own request —
 * the server refuses it, and the button isn't offered.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { ApiError } from "@/lib/api";
import { friendlyError } from "@/lib/errors";
import { formatDuration } from "@/lib/format";
import { useAuthStore } from "@/stores/auth.store";
import { useDirectory } from "@/hooks/use-directory";
import { projectNameMap } from "@/modules/projects/services/projects.service";
import {
  decideTimeCorrection,
  getTimeCorrections,
  type ApiCorrection,
} from "../services/approvals.service";

const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const day = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString([], {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
const secs = (a: number, b: number) => Math.max(0, Math.round((b - a) / 1000));

export function TimeCorrectionsQueue() {
  const me = useAuthStore((s) => s.user?.id ?? null);
  const { employees: directory } = useDirectory();
  const [items, setItems] = useState<ApiCorrection[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [projects, setProjects] = useState<Map<string, string>>(new Map());
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<ApiCorrection | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const names = useMemo(
    () => new Map((directory ?? []).map((e) => [e.user_id, e.name] as const)),
    [directory],
  );

  const load = useCallback(() => {
    getTimeCorrections("pending").then(
      (r) => {
        setItems(r);
        setFailed(false);
      },
      () => setFailed(true),
    );
    projectNameMap().then(setProjects, () => undefined);
  }, []);
  useEffect(load, [load]);

  async function decide(
    c: ApiCorrection,
    decision: "approve" | "reject",
    reason?: string,
  ) {
    setBusy(c.request_id);
    try {
      await decideTimeCorrection({
        user_id: c.user_id,
        request_id: c.request_id,
        decision,
        ...(reason?.trim() ? { reason: reason.trim() } : {}),
      });
      toast.success(
        decision === "approve"
          ? "Correction approved — timesheet updated"
          : "Correction rejected",
      );
      setRejecting(null);
      setRejectReason("");
      load();
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      toast.error(
        code === "entry_changed"
          ? "That session changed since the request was made — it can't be applied as asked. Reject it so they can ask again."
          : code === "not_pending"
            ? "This request was already decided or withdrawn."
            : e instanceof ApiError && e.status === 400
              ? e.message
              : friendlyError(e, "Couldn't record the decision."),
      );
      load();
    } finally {
      setBusy(null);
    }
  }

  // Nothing to decide and nothing broken — stay out of the way.
  if (!failed && (!items || items.length === 0)) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="size-4" /> Time corrections
          {items?.length ? (
            <Badge variant="secondary">{items.length} pending</Badge>
          ) : null}
        </CardTitle>
        <p className="text-muted-foreground text-xs">
          Employees asking to fix their tracked time. Approving changes their timesheet
          straight away — pay and attendance follow.
        </p>
      </CardHeader>
      <CardContent className="divide-y p-0">
        {failed ? (
          <div className="flex items-center justify-between gap-3 px-6 py-4 text-sm">
            <span className="text-muted-foreground">
              Couldn&apos;t load time corrections.
            </span>
            <Button size="sm" variant="outline" onClick={load}>
              Retry
            </Button>
          </div>
        ) : (
          items!.map((c) => {
            const name = names.get(c.user_id) ?? "An employee";
            const before =
              c.kind === "edit" && c.base_start && c.base_end
                ? secs(c.base_start, c.base_end)
                : 0;
            const after = secs(c.start, c.end);
            const delta = after - before;
            const own = c.user_id === me;
            return (
              <div
                key={c.request_id}
                className="flex flex-wrap items-start gap-4 px-6 py-4"
              >
                <UserAvatar userId={c.user_id} name={name} className="size-9 shrink-0" />
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  <p className="font-medium">
                    {name} · {day(c.date)}
                  </p>
                  <p className="tabular-nums">
                    {c.kind === "add" ? (
                      <>
                        Add {clock(c.start)} – {clock(c.end)} ({formatDuration(after)})
                      </>
                    ) : (
                      <>
                        <span className="text-muted-foreground line-through">
                          {c.base_start ? clock(c.base_start) : "?"} –{" "}
                          {c.base_end ? clock(c.base_end) : "?"}
                        </span>{" "}
                        → {clock(c.start)} – {clock(c.end)}{" "}
                        <span className={delta < 0 ? "text-destructive" : "text-success"}>
                          ({delta < 0 ? "−" : "+"}
                          {formatDuration(Math.abs(delta))})
                        </span>
                      </>
                    )}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {projects.get(c.project_id) ?? "Project"}
                    {c.kind === "edit" &&
                    c.base_project_id &&
                    c.base_project_id !== c.project_id
                      ? ` (was ${projects.get(c.base_project_id) ?? "another project"})`
                      : ""}
                    {" · "}“{c.reason}”
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {own ? (
                    <span className="text-muted-foreground text-xs">
                      Your own — another approver decides
                    </span>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === c.request_id}
                        onClick={() => setRejecting(c)}
                      >
                        <X className="size-4" /> Reject
                      </Button>
                      <Button
                        size="sm"
                        disabled={busy === c.request_id}
                        onClick={() => void decide(c, "approve")}
                      >
                        {busy === c.request_id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Check className="size-4" />
                        )}
                        Approve
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>

      <ConfirmDialog
        open={rejecting !== null}
        onOpenChange={(o) => !o && setRejecting(null)}
        title="Reject this correction?"
        description="Their timesheet stays as it is. They'll see it wasn't approved, with your note if you add one."
        confirmLabel="Reject"
        destructive
        busy={rejecting ? busy === rejecting.request_id : false}
        onConfirm={() => rejecting && void decide(rejecting, "reject", rejectReason)}
      >
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          rows={2}
          maxLength={500}
          aria-label="Note for the employee (optional)"
          placeholder="Note for them (optional) — e.g. the meeting ended at 4, not 6."
          className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring w-full resize-none rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
        />
      </ConfirmDialog>
    </Card>
  );
}
