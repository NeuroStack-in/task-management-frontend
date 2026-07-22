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
import type { ApiDeduction } from "../services/payroll.service";

function deductionLabel(kind: string, value: number): string {
  return kind === "percent" ? `${value}%` : formatCurrency(value);
}

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
  canManage,
  onSave,
}: {
  deductions: ApiDeduction[];
  canManage: boolean;
  onSave: (rules: ApiDeduction[]) => Promise<ApiDeduction[]>;
}) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<DraftRule[]>([]);
  const [saving, setSaving] = useState(false);
  // Set when the server 403s a save: the UI thought we could manage, the server said no. Keep the
  // read-only view and stop offering the editor (honest degradation).
  const [denied, setDenied] = useState(false);

  const showEditor = canManage && !denied;

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
        description: `${result.rules.length} rule${result.rules.length === 1 ? "" : "s"} — drafts pick them up on the next run.`,
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
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Deduction rules</CardTitle>
        {showEditor && !editing ? (
          <Button variant="outline" size="sm" onClick={startEdit}>
            <Pencil className="size-4" /> Edit
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {!editing ? (
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
                  <span className="font-mono tabular-nums">{deductionLabel(d.kind, d.value)}</span>
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
                      items={{ percent: "Percent", flat: "Flat" }}
                    >
                      <SelectTrigger className="w-28" aria-label="Rule kind">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percent">Percent</SelectItem>
                        <SelectItem value="flat">Flat</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={row.value}
                      onChange={(e) => patchRow(i, { value: e.target.value })}
                      inputMode="decimal"
                      placeholder={row.kind === "percent" ? "%" : "amount"}
                      className="w-24 text-right tabular-nums"
                      aria-label="Rule value"
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
