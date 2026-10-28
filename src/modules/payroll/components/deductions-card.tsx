"use client";

/**
 * Deduction rules — read view for everyone with payroll access, inline editor for `payroll:manage`.
 * The PUT replaces the whole list (`CONFIG#DEDUCTIONS` document), so the editor works on a draft
 * copy of all rules and saves them wholesale. On a server 403 the view falls back to read-only —
 * the server is the real gate; `can()` is UX only.
 */
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { useOrgCurrency } from "@/hooks/use-org";
import type { ApiDeduction } from "../services/payroll.service";

/**
 * A rule as the run applies it (`payroll_runs::employee_totals`): a percent comes off **each
 * employee's gross**; a flat amount comes off **each employee's pay, once per run** — runs are
 * monthly. "Flat" alone left it open whether 500 was per person or split across the run (UX audit
 * 2026-10-16, TIME-20).
 */
function deductionLabel(kind: string, value: number, currency?: string): string {
  return kind === "percent"
    ? `${value}% of gross`
    : `${formatCurrency(value, currency)} per employee`;
}

/** The kind's name in the editor — the same wording as the read view. */
const KIND_LABELS = { percent: "% of gross", flat: "Flat per employee" } as const;

/** Editor row: `value` stays a string while typing; parsed + validated on save. */
interface DraftRule {
  name: string;
  kind: "percent" | "flat";
  value: string;
  active: boolean;
}

function toDraft(rules: ApiDeduction[]): DraftRule[] {
  return rules.map((r) => ({
    name: r.name,
    kind: r.kind === "flat" ? "flat" : "percent",
    value: String(r.value),
    active: r.active,
  }));
}

/** Validate per the server's shape (`[{name, kind: percent|flat, value, active}]`). Returns the
 *  typed list or a message. The server stores the document verbatim, so the client is the only
 *  shape check — keep it strict. */
function validate(rows: DraftRule[]): { rules: ApiDeduction[] } | { error: string } {
  const rules: ApiDeduction[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const name = row.name.trim();
    if (!name) return { error: "Every rule needs a name." };
    const key = name.toLowerCase();
    if (seen.has(key)) return { error: `Duplicate rule name "${name}".` };
    seen.add(key);
    const value = Number(row.value);
    if (!Number.isFinite(value) || value < 0) {
      return { error: `"${name}" needs a non-negative number.` };
    }
    if (row.kind === "percent" && value > 100) {
      return { error: `"${name}" is a percent rule — keep it at 100% or less.` };
    }
    rules.push({ name, kind: row.kind, value, active: row.active });
  }
  return { rules };
}

export function DeductionsCard({
  deductions,
  loadError,
  onRetry,
  canManage,
  onSave,
}: {
  deductions: ApiDeduction[];
  /** The rules could not be read — show that, never "none configured" (see `usePayroll`). */
  loadError?: string | null;
  onRetry?: () => void;
  canManage: boolean;
  onSave: (rules: ApiDeduction[]) => Promise<ApiDeduction[]>;
}) {
  // Flat amounts in the org's own currency (WP-078).
  const currency = useOrgCurrency() ?? undefined;
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<DraftRule[]>([]);
  const [saving, setSaving] = useState(false);
  // Set when the server 403s a save: the UI thought we could manage, the server said no. Keep the
  // read-only view and stop offering the editor (honest degradation).
  const [denied, setDenied] = useState(false);

  // No editor over a failed read: saving replaces the whole rule set, so editing "nothing" would
  // delete every real rule (QA audit 2026-10-08, WP-075).
  const showEditor = canManage && !denied && !loadError;

  function startEdit() {
    setRows(toDraft(deductions));
    setEditing(true);
  }

  function patchRow(i: number, patch: Partial<DraftRule>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function save() {
    const result = validate(rows);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    setSaving(true);
    try {
      await onSave(result.rules);
      setEditing(false);
      toast.success("Deduction rules saved", {
        description: `${result.rules.length} rule${result.rules.length === 1 ? "" : "s"} — used from the next draft or redraft. Finalized runs keep their figures.`,
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setDenied(true);
        setEditing(false);
        toast.error("The server denied the change — you don't have payroll manage access.");
      } else {
        toast.error(e instanceof ApiError ? e.message : "Couldn't save the deduction rules.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>Deduction rules</CardTitle>
          {/* What a rule does, and what this list is — today's rules, not a run's (TIME-20). A run
              stores its totals and each person's line, but not the rules it was computed with, so
              an older run may have used different ones. */}
          <p className="text-muted-foreground text-xs">
            Applied per employee when a run is drafted: a percentage comes off their gross pay, and
            a flat amount comes off their pay once per run (each run is one month). Deductions never
            take anyone&apos;s pay below zero.
          </p>
          <p className="text-muted-foreground text-xs">
            These are the current rules. Each run keeps the rules it was drafted with (shown under
            People); redraft a month to apply a change to it.
          </p>
        </div>
        {showEditor && !editing ? (
          <Button variant="outline" size="sm" onClick={startEdit} className="shrink-0">
            <Pencil className="size-4" /> Edit
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {loadError && !editing ? (
          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="text-destructive">Couldn&apos;t load the deduction rules: {loadError}</p>
            {onRetry ? (
              <Button variant="outline" size="sm" onClick={onRetry}>
                Retry
              </Button>
            ) : null}
          </div>
        ) : !editing ? (
          deductions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No deduction rules configured.
              {showEditor ? " Use Edit to add the first one." : ""}
            </p>
          ) : (
            <ul className="divide-y">
              {deductions.map((d) => (
                <li key={d.name} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="font-medium capitalize">{d.name}</span>
                    {!d.active ? (
                      <Badge variant="outline" className="font-normal text-muted-foreground">
                        inactive
                      </Badge>
                    ) : null}
                  </span>
                  <span className="tabular-nums">{deductionLabel(d.kind, d.value, currency)}</span>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="space-y-3">
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rules — add one below.</p>
            ) : (
              <ul className="space-y-2">
                {rows.map((row, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2">
                    <Input
                      value={row.name}
                      onChange={(e) => patchRow(i, { name: e.target.value })}
                      placeholder="Rule name (e.g. tax)"
                      className="w-40 flex-1"
                      aria-label="Rule name"
                    />
                    <Select
                      value={row.kind}
                      onValueChange={(v) => patchRow(i, { kind: v as DraftRule["kind"] })}
                      items={KIND_LABELS}
                    >
                      <SelectTrigger className="w-44" aria-label="Rule kind">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">{KIND_LABELS.percent}</SelectItem>
                        <SelectItem value="flat">{KIND_LABELS.flat}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={row.value}
                      onChange={(e) => patchRow(i, { value: e.target.value })}
                      inputMode="decimal"
                      placeholder={row.kind === "percent" ? "%" : "amount"}
                      className="w-24 text-right tabular-nums"
                      aria-label={
                        row.kind === "percent"
                          ? "Percent of gross"
                          : `Amount per employee${currency ? ` (${currency})` : ""}`
                      }
                    />
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Switch
                        size="sm"
                        checked={row.active}
                        onCheckedChange={(checked) => patchRow(i, { active: checked })}
                      />
                      active
                    </label>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${row.name || "rule"}`}
                      onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center justify-between pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setRows((rs) => [...rs, { name: "", kind: "percent", value: "", active: true }])
                }
              >
                <Plus className="size-4" /> Add rule
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={saving} onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button size="sm" disabled={saving} onClick={save}>
                  {saving ? "Saving…" : "Save rules"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
