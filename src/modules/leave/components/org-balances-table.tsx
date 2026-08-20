"use client";

/**
 * Every employee's leave ledger for a year, with a per-person allowance editor.
 *
 * Sections 2 and 3 of the admin Leave page: who has consumed what, and the ability to grant or claw
 * back an individual's days on top of the uniform annual allowance.
 *
 * One column per **active leave type**, taken from the catalog the server returns rather than
 * derived from the rows — a type nobody has been granted yet would otherwise have no column at all,
 * which reads as "that type doesn't exist" instead of "nobody has any".
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, TriangleAlert, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { ApiError } from "@/lib/api";
import {
  adjustBalance,
  getOrgBalances,
  type ApiOrgBalances,
  type ApiTypeBalance,
} from "../services/leave.service";

/** Which person + type the editor is open on. */
interface EditTarget {
  userId: string;
  name: string;
  balance: ApiTypeBalance;
}

export function OrgBalancesTable() {
  const [data, setData] = useState<ApiOrgBalances | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [query, setQuery] = useState("");

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    getOrgBalances()
      .then((d) => {
        if (live) setData(d);
      })
      .catch((e: unknown) => {
        if (!live) return;
        setError(
          e instanceof ApiError
            ? e.message
            : "Couldn't load the org's leave balances.",
        );
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [nonce]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !data) return data?.employees ?? [];
    return data.employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) || e.emp_id.toLowerCase().includes(q),
    );
  }, [data, query]);

  if (loading && !data) {
    return (
      <Card>
        <CardContent className="flex min-h-[12rem] items-center justify-center">
          <Loader label="Loading leave balances…" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <TriangleAlert className="size-5 text-warning" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const types = data?.types ?? [];

  return (
    <>
      <Card className="gap-4">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Employee balances</CardTitle>
            <CardDescription>
              Consumed and remaining for {data?.year}. Click a figure to grant or reduce that
              person&apos;s allowance.
            </CardDescription>
          </div>
          <Input
            placeholder="Search name or ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full sm:w-56"
          />
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <EmptyState
              icon={Users}
              title={query ? "No one matches" : "No employees yet"}
              description={
                query
                  ? "Try a different name or employee ID."
                  : "Leave balances appear once the org has employees."
              }
              className="m-4 border-0"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    {types.map((t) => (
                      <TableHead key={t.type_id} className="text-right">
                        {t.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((emp) => (
                    <TableRow key={emp.user_id}>
                      <TableCell className="max-w-0">
                        <span className="block truncate font-medium">{emp.name}</span>
                        {emp.emp_id ? (
                          <span className="block truncate font-mono text-[0.7rem] text-muted-foreground">
                            {emp.emp_id}
                          </span>
                        ) : null}
                      </TableCell>
                      {types.map((t) => {
                        const b =
                          emp.balances.find((x) => x.type_id === t.type_id) ?? null;
                        if (!b) return <TableCell key={t.type_id} />;
                        return (
                          <TableCell key={t.type_id} className="text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setEdit({ userId: emp.user_id, name: emp.name, balance: b })
                              }
                              className="group inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 tabular-nums transition-colors hover:bg-muted"
                              aria-label={`Adjust ${t.name} for ${emp.name}`}
                            >
                              <span className="font-medium">{b.remaining}</span>
                              <span className="text-xs text-muted-foreground">
                                / {b.allowance}
                              </span>
                              {b.adjusted ? (
                                <Badge
                                  className="bg-primary/12 px-1 py-0 text-[0.6rem] text-primary"
                                  title="Hand-adjusted — a catalog change won't overwrite it"
                                >
                                  set
                                </Badge>
                              ) : null}
                              <Pencil className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
                            </button>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AdjustDialog
        target={edit}
        year={data?.year ?? ""}
        onClose={() => setEdit(null)}
        onSaved={() => {
          setEdit(null);
          reload();
        }}
      />
    </>
  );
}

/** The per-person allowance editor. Absolute figure, never a delta — see `adjustBalance`. */
function AdjustDialog({
  target,
  year,
  onClose,
  onSaved,
}: {
  target: EditTarget | null;
  year: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // Re-seed whenever a different cell is opened; the dialog is reused across every row.
  useEffect(() => {
    setValue(target ? String(target.balance.allowance) : "");
    setNote("");
  }, [target]);

  if (!target) return null;
  const { balance } = target;
  const parsed = Number(value);
  // Below `used` the server refuses anyway — saying so here saves a round trip and explains why.
  const tooLow = Number.isFinite(parsed) && parsed < balance.used;
  const invalid = value.trim() === "" || !Number.isFinite(parsed) || parsed < 0 || tooLow;

  const save = async () => {
    setSaving(true);
    try {
      await adjustBalance(target.userId, {
        type_id: balance.type_id,
        allowance: parsed,
        year,
        note: note.trim() || undefined,
      });
      toast.success("Allowance updated", {
        description: `${target.name} · ${balance.name} · ${parsed} day${parsed === 1 ? "" : "s"}`,
      });
      onSaved();
    } catch (e) {
      toast.error(
        e instanceof ApiError ? e.message : "Couldn't update the allowance. Try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Adjust {balance.name}</DialogTitle>
          <DialogDescription>
            {target.name} · {year}. Sets the total allowance for the year, so this replaces the
            current figure rather than adding to it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <Stat label="Allowance" value={balance.allowance} />
            <Stat label="Used" value={balance.used} />
            <Stat label="Remaining" value={balance.remaining} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="allowance">New allowance (days)</Label>
            <Input
              id="allowance"
              type="number"
              min={balance.used}
              max={366}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            {tooLow ? (
              <p className="text-xs text-destructive">
                {target.name} has already used {balance.used} day
                {balance.used === 1 ? "" : "s"} — the allowance can&apos;t go below that.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">
              Reason <span className="text-muted-foreground">optional</span>
            </Label>
            <Input
              id="note"
              placeholder="e.g. carried over from last year"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Recorded in the audit log, and this figure is then protected from org-wide allowance
              changes.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={invalid || saving}>
            {saving ? "Saving…" : "Save allowance"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2 py-1.5">
      <p className="text-base font-semibold tabular-nums">{value}</p>
      <p className="text-[0.7rem] text-muted-foreground">{label}</p>
    </div>
  );
}
