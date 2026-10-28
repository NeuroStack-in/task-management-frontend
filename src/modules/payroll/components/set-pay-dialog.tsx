"use client";

/**
 * Set a person's pay — `PUT /v1/payroll/comp/{user_id}` (`payroll:manage`), from the payroll page
 * itself (2026-10-28 rework: it was a separate write-only card with its own employee picker).
 *
 * Opened from a person's row (their current pay prefilled) or with no one chosen, in which case it
 * offers the directory's active people. A saved change reaches the run only when it is redrafted, and
 * the caller says so.
 */
import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { listAllEmployees, type ApiEmployee } from "@/modules/employees/services/employees.service";
import type { ApiCompensation, CompensationInput } from "../services/payroll.service";

type PayType = CompensationInput["pay_type"];

export interface PayTarget {
  user_id: string;
  name: string;
  pay_type?: string;
  rate?: number;
}

export function SetPayDialog({
  open,
  target,
  currency,
  onOpenChange,
  onSave,
  onSaved,
}: {
  open: boolean;
  /** The person, with their current pay when known; `null` = choose someone. */
  target: PayTarget | null;
  currency?: string;
  onOpenChange: (open: boolean) => void;
  onSave: (userId: string, body: CompensationInput) => Promise<ApiCompensation>;
  /** After a successful save — the caller offers the redraft. */
  onSaved?: (saved: ApiCompensation, name: string) => void;
}) {
  const [employees, setEmployees] = useState<ApiEmployee[] | null>(null);
  const [userId, setUserId] = useState("");
  const [payType, setPayType] = useState<PayType>("salaried");
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);

  // Fill from the person each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setUserId(target?.user_id ?? "");
    setPayType(target?.pay_type === "hourly" ? "hourly" : "salaried");
    setRate(target?.rate != null ? String(target.rate) : "");
  }, [open, target]);

  // The picker's list, only when no one was chosen.
  useEffect(() => {
    if (!open || target || employees) return;
    let live = true;
    listAllEmployees()
      .then((rows) => live && setEmployees(rows.filter((e) => e.status === "active")))
      .catch(() => live && setEmployees([]));
    return () => {
      live = false;
    };
  }, [open, target, employees]);

  const name =
    target?.name ?? employees?.find((e) => e.user_id === userId)?.name ?? "this person";

  async function save() {
    if (!userId) {
      toast.error("Choose who to set pay for.");
      return;
    }
    // An empty box is refused rather than saved as 0 (QA audit 2026-10-08, WP-074).
    const value = Number(rate);
    if (!rate.trim() || !Number.isFinite(value) || value < 0) {
      toast.error("Enter the pay as a number, 0 or more.");
      return;
    }
    setSaving(true);
    try {
      const saved = await onSave(userId, { pay_type: payType, rate: value });
      onOpenChange(false);
      onSaved?.(saved, name);
    } catch (e) {
      toast.error(
        e instanceof ApiError && e.status === 403
          ? "You don't have access to set pay."
          : e instanceof ApiError && e.status === 404
            ? "That person isn't in this organization any more."
            : e instanceof ApiError
              ? e.message
              : "Couldn't save the pay.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{target ? `Pay for ${target.name}` : "Set pay"}</DialogTitle>
          <DialogDescription>
            Salaried pay is a monthly amount, reduced for days the person is absent. Hourly pay is the
            rate times every hour they track. The month&apos;s run uses it once you redraft it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {target ? null : (
            <div className="space-y-1.5">
              <Label htmlFor="pay-employee">Employee</Label>
              <Select
                value={userId || null}
                onValueChange={(v) => setUserId(v as string)}
                items={Object.fromEntries((employees ?? []).map((e) => [e.user_id, e.name]))}
              >
                <SelectTrigger id="pay-employee" className="w-full" aria-label="Employee">
                  <SelectValue
                    placeholder={employees === null ? "Loading people…" : "Choose someone"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {(employees ?? []).map((e) => (
                    <SelectItem key={e.user_id} value={e.user_id}>
                      {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pay-type">Pay type</Label>
              <Select
                value={payType}
                onValueChange={(v) => setPayType(v as PayType)}
                items={{ salaried: "Salaried", hourly: "Hourly" }}
              >
                <SelectTrigger id="pay-type" className="w-full" aria-label="Pay type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="salaried">Salaried</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-rate">{payType === "hourly" ? "Per hour" : "Per month"}</Label>
              <Input
                id="pay-rate"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                className="text-right tabular-nums"
              />
            </div>
          </div>
          {rate.trim() && Number.isFinite(Number(rate)) ? (
            <p className="text-muted-foreground text-xs">
              {formatCurrency(Number(rate), currency)}
              {payType === "hourly" ? " for every tracked hour" : " a month, before absent days"}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save pay"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
