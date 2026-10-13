"use client";

/**
 * Set an employee's compensation — `PUT /v1/payroll/comp/{user_id}` (`payroll:manage`).
 *
 * This is deliberately a *write* surface: the API has **no comp GET route** (comp lives on the
 * `USER#` item and is consumed server-side when a run is drafted; the fields are also payroll-masked
 * out of every other response for callers without `payroll:read`). So the card can't list current
 * values — it shows the PUT's echo as confirmation, which is the only comp read the API offers.
 *
 * The employee picker uses the workforce directory (`employees:view`); if the caller can manage
 * payroll but can't list employees, it degrades to a plain user-id field instead of breaking.
 */
import { useEffect, useState } from "react";
import { BadgeDollarSign } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useOrgCurrency } from "@/hooks/use-org";
import { listAllEmployees, type ApiEmployee } from "@/modules/employees/services/employees.service";
import type { ApiCompensation, CompensationInput } from "../services/payroll.service";
import { personName } from "@/lib/format";

type PayType = CompensationInput["pay_type"];

export function SetCompensationCard({
  onSave,
}: {
  onSave: (userId: string, body: CompensationInput) => Promise<ApiCompensation>;
}) {
  // Every amount in the org's own currency (WP-078).
  const currency = useOrgCurrency() ?? undefined;
  const [employees, setEmployees] = useState<ApiEmployee[] | null>(null);
  // Directory unavailable (no employees:view, or transient failure) → manual user-id entry.
  const [directoryFailed, setDirectoryFailed] = useState(false);

  const [userId, setUserId] = useState("");
  const [payType, setPayType] = useState<PayType>("salaried");
  const [rate, setRate] = useState("");
  const [saving, setSaving] = useState(false);
  // Server 403 on save → the whole card goes read-only-honest (it renders nothing readable anyway,
  // so it collapses to an explanation instead of a form that can't work).
  const [denied, setDenied] = useState(false);
  const [lastSaved, setLastSaved] = useState<ApiCompensation | null>(null);

  useEffect(() => {
    let live = true;
    listAllEmployees()
      .then((rows) => {
        if (!live) return;
        setEmployees(rows.filter((e) => e.status === "active"));
      })
      .catch(() => {
        if (live) setDirectoryFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);

  // Never the raw sub — a miss here means the employee was deleted while their comp row survived.
  const nameOf = (id: string) =>
    personName(employees?.find((e) => e.user_id === id)?.name);

  async function save() {
    const id = userId.trim();
    if (!id) {
      toast.error("Pick an employee first.");
      return;
    }
    // `Number("")` is 0, so an empty field used to save a rate of 0 — and the field cleared after
    // every save with the employee still selected, so the next click zeroed what was just entered
    // (QA audit 2026-10-08, WP-074). An empty rate is refused, and the saved figure stays in the box.
    if (!rate.trim()) {
      toast.error("Enter a rate.");
      return;
    }
    const value = Number(rate);
    if (!Number.isFinite(value) || value < 0) {
      toast.error("Enter a non-negative rate.");
      return;
    }
    setSaving(true);
    try {
      const view = await onSave(id, { pay_type: payType, rate: value });
      setLastSaved(view);
      setRate(String(view.rate));
      toast.success(`Compensation set for ${nameOf(view.user_id)}`, {
        description:
          view.pay_type === "hourly"
            ? `Hourly at ${formatCurrency(view.rate, currency)}/h — the next drafted run uses it.`
            : `Salaried at ${formatCurrency(view.rate, currency)}/mo — the next drafted run uses it.`,
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setDenied(true);
        toast.error("The server denied the change — you don't have payroll manage access.");
      } else if (e instanceof ApiError && e.status === 404) {
        toast.error("No such employee in this org.");
      } else {
        toast.error(e instanceof ApiError ? e.message : "Couldn't save the compensation.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (denied) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Compensation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You don&apos;t have access to set compensation.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <BadgeDollarSign className="size-4 text-muted-foreground" />
        <CardTitle>Set compensation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Pay type and rate feed run totals when a run is drafted. The API keeps comp write-only here
          — current values aren&apos;t listed anywhere, so set, don&apos;t read.
        </p>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
          <div className="space-y-1.5">
            {/* Labels tied to their controls by id, so each is announced by name (WP-478). */}
            <Label htmlFor="comp-employee">Employee</Label>
            {!directoryFailed ? (
              <Select
                value={userId || null}
                onValueChange={(v) => setUserId(v as string)}
                items={Object.fromEntries(
                  (employees ?? []).map((e) => [
                    e.user_id,
                    `${e.name}${e.emp_id ? ` (${e.emp_id})` : ""}`,
                  ]),
                )}
              >
                <SelectTrigger id="comp-employee" className="w-full" aria-label="Employee">
                  <SelectValue
                    placeholder={employees === null ? "Loading employees…" : "Select an employee"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {(employees ?? []).map((e) => (
                    <SelectItem key={e.user_id} value={e.user_id}>
                      {e.name}
                      {e.emp_id ? ` (${e.emp_id})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="comp-employee"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="user id (directory unavailable)"
              />
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="comp-pay-type">Pay type</Label>
            <Select
              value={payType}
              onValueChange={(v) => setPayType(v as PayType)}
              items={{ salaried: "Salaried", hourly: "Hourly" }}
            >
              <SelectTrigger id="comp-pay-type" className="w-32" aria-label="Pay type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="salaried">Salaried</SelectItem>
                <SelectItem value="hourly">Hourly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="comp-rate">{payType === "hourly" ? "Rate / hour" : "Salary / month"}</Label>
            <Input
              id="comp-rate"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              inputMode="decimal"
              placeholder="0"
              className="w-32 text-right tabular-nums"
            />
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save comp"}
          </Button>
        </div>
        {payType === "hourly" ? (
          <p className="text-xs text-muted-foreground">
            Payroll runs pay hourly staff for <span className="font-medium text-foreground">billable</span>{" "}
            timer hours only — time on non-billable projects counts for nothing.
          </p>
        ) : null}
        {lastSaved ? (
          <p className="text-xs text-muted-foreground">
            Last saved: <span className="font-medium text-foreground">{nameOf(lastSaved.user_id)}</span>{" "}
            — {lastSaved.pay_type} at{" "}
            <span className="tabular-nums">{formatCurrency(lastSaved.rate, currency)}</span>
            {lastSaved.pay_type === "hourly" ? "/h" : "/mo"}.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
