"use client";

/**
 * "Request a fix" — ask an approver to correct a session, or to add time the timer missed
 * (owner decision 2026-10-18, UX audit TIME-05: entries decide pay and attendance, and an employee
 * could see a wrong one but never fix it). Nothing changes until it is approved; the request shows
 * under "My correction requests" with its status.
 */
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { TimePicker } from "@/components/ui/date-picker";
import { ApiError } from "@/lib/api";
import { friendlyError } from "@/lib/errors";
import {
  listProjects,
  type ApiProject,
} from "@/modules/projects/services/projects.service";
import { fileCorrection } from "../services/time-corrections.service";
import type { TimesheetRow } from "../use-timesheet";

/** `HH:MM` of an epoch-ms instant, in the viewer's clock. */
function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Epoch ms for `HH:MM` on `date` (`YYYY-MM-DD`), in the viewer's clock. */
function at(date: string, time: string): number {
  return new Date(`${date}T${time}:00`).getTime();
}

const CODE_MESSAGES: Record<string, string> = {
  correction_pending:
    "There's already a pending request for this session. Wait for it, or withdraw it first.",
  session_running: "That session is still running — it can be corrected once it stops.",
};

export function TimeCorrectionDialog({
  open,
  onOpenChange,
  date,
  row,
  onFiled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The day (`YYYY-MM-DD`). */
  date: string;
  /** The session to fix; `null` to add missing time. */
  row: TimesheetRow | null;
  onFiled?: () => void;
}) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [projectId, setProjectId] = useState("");
  const [reason, setReason] = useState("");
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStart(row ? hhmm(row.startMs) : "");
    setEnd(row?.endMs ? hhmm(row.endMs) : "");
    setProjectId(row?.projectId ?? "");
    setReason("");
    setError(null);
    let live = true;
    listProjects().then(
      (p) => live && setProjects(p),
      () => live && setProjects([]),
    );
    return () => {
      live = false;
    };
  }, [open, row]);

  const options = useMemo(() => {
    // The session's own project stays selectable even if the person has since left it.
    const list = [...projects];
    if (row?.projectId && !list.some((p) => p.id === row.projectId)) {
      list.unshift({ id: row.projectId, name: row.project } as ApiProject);
    }
    return list;
  }, [projects, row]);

  async function submit() {
    setError(null);
    if (!start || !end) return setError("Enter both a start and an end time.");
    const s = at(date, start);
    const e = at(date, end);
    if (e <= s) return setError("The end has to be after the start, on the same day.");
    if (e > Date.now()) return setError("The end can't be in the future.");
    if (!projectId) return setError("Choose the project this time was spent on.");
    if (reason.trim().length < 3)
      return setError("Say briefly why — your approver reads it.");
    setBusy(true);
    try {
      await fileCorrection({
        ...(row ? { session_id: row.id } : {}),
        date,
        start: s,
        end: e,
        project_id: projectId,
        reason: reason.trim(),
      });
      toast.success("Correction requested", {
        description:
          "Nothing changes until your approver says yes. You'll see the status below.",
      });
      onOpenChange(false);
      onFiled?.();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      setError(
        (code && CODE_MESSAGES[code]) ??
          (err instanceof ApiError && err.status === 400
            ? err.message
            : friendlyError(err, "Couldn't send the request.")),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {row ? "Request a fix to this session" : "Add time the timer missed"}
          </DialogTitle>
          <DialogDescription>
            {row
              ? `Recorded ${row.start} – ${row.end ?? "…"} on ${row.project}. Say what it should be — it changes only when an approver says yes.`
              : "For time you worked but the timer didn't record. It's added only when an approver says yes."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tc-start">Start</Label>
              <TimePicker
                id="tc-start"
                value={start}
                onChange={setStart}
                stepMinutes={5}
                clearable={false}
                className="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tc-end">End</Label>
              <TimePicker
                id="tc-end"
                value={end}
                onChange={setEnd}
                stepMinutes={5}
                clearable={false}
                className="w-full"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tc-project">Project</Label>
            <select
              id="tc-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="border-input bg-background focus-visible:ring-ring/40 h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              <option value="">Choose a project…</option>
              {options.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tc-reason">Why</Label>
            <textarea
              id="tc-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder={
                row
                  ? "e.g. Forgot to stop the timer when I left at 6."
                  : "e.g. Laptop was off during the client workshop."
              }
              className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring w-full resize-none rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            />
          </div>
          {error ? (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Send for approval
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
