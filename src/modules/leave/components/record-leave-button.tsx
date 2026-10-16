"use client";

/**
 * "Record leave" on the Manage leave view — file leave on an employee's behalf (`leave:manage`).
 *
 * A manager could record nothing for anyone: a sick day an employee phoned in stayed "Absent",
 * because only the employee could request leave, and never for a day already past (owner decision
 * 2026-10-17, UX audit TIME-04). The request lands in the approval queue like any other.
 *
 * People and leave types come from the org ledger the view already shows (`GET /v1/leave/balances`),
 * read when the button is pressed.
 */
import { useState } from "react";
import { CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { friendlyError } from "@/lib/errors";
import {
  createRequestFor,
  getOrgBalances,
  type ApiLeaveType,
} from "../services/leave.service";
import { RequestLeaveDialog } from "./request-leave-dialog";

export function RecordLeaveButton({ onRecorded }: { onRecorded?: () => void }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [types, setTypes] = useState<ApiLeaveType[]>([]);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);

  async function start() {
    setLoading(true);
    try {
      const ledger = await getOrgBalances();
      setTypes(ledger.types.filter((t) => t.active !== false));
      setPeople(
        ledger.employees
          .map((e) => ({ id: e.user_id, name: e.name || e.emp_id || "Unnamed employee" }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setOpen(true);
    } catch (e) {
      toast.error(friendlyError(e, "Couldn't load employees and leave types."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={start} disabled={loading}>
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CalendarPlus className="size-4" />
        )}
        Record leave
      </Button>
      <RequestLeaveDialog
        open={open}
        onOpenChange={setOpen}
        types={types}
        employees={people}
        onSubmit={async (req, forUserId) => {
          if (!forUserId) return;
          await createRequestFor(forUserId, req);
          onRecorded?.();
        }}
      />
    </>
  );
}
