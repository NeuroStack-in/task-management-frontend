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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { ApiError } from "@/lib/api";
import { UserAvatar } from "@/components/shared/user-avatar";
import { adjustBalance, getOrgBalances, type ApiOrgBalances, type ApiTypeBalance } from "../services/leave.service";
import { formatDays } from "../lib/days";
import { balanceCell } from "../lib/balance-cell";

/** Which person + type the editor is open on. */
interface EditTarget {
  userId: string;
  name: string;
  balance: ApiTypeBalance;
  /** The type's catalog allowance — the editor's starting figure when nothing was granted yet. */
  typeAllowance: number;
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
              Remaining of each allowance for {data?.year}. Click a figure to grant or reduce that
              person&apos;s allowance. &ldquo;Not started&rdquo;: that balance is created, at the
              figure shown, the next time they use Leave.
            </CardDescription>
          </div>
          <Input
            placeholder="Search name or ID…"
            // A placeholder is not a label (UX audit 2026-10-16, TIME-15).
            aria-label="Search employee balances by name or ID"
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
            <>
              {/* Phones: one card per person, every type's figure a button inside it. The table
                  squeezed the name column to nothing (`max-w-0`) and leave names to "A.." on a
                  390 px screen (UX audit 2026-10-16, TIME-12 / XC-05). */}
              <ul className="divide-y divide-border sm:hidden" aria-label="Employee balances">
                {rows.map((emp) => (
                  <li key={emp.user_id} className="space-y-3 px-4 py-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        userId={emp.user_id}
                        name={emp.name}
                        className="size-8 shrink-0"
                        fallbackClassName="text-xs"
                      />
                      <div className="min-w-0">
                        <span className="block font-medium break-words">{emp.name}</span>
                        {emp.emp_id ? (
                          <span className="block font-mono text-[0.7rem] text-muted-foreground">
                            {emp.emp_id}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <dl className="grid grid-cols-2 gap-2">
                      {types.map((t) => {
                        const b = emp.balances.find((x) => x.type_id === t.type_id) ?? null;
                        return (
                          <div key={t.type_id} className="rounded-lg bg-muted/40 px-2.5 py-2">
                            <dt className="text-xs text-muted-foreground break-words">{t.name}</dt>
                            <dd className="-mx-1.5">
                              {b ? (
                                <BalanceButton
                                  balance={b}
                                  typeAllowance={t.annual_allowance}
                                  typeName={t.name}
                                  personName={emp.name}
                                  year={data?.year}
                                  onClick={() =>
                                    setEdit({
                                      userId: emp.user_id,
                                      name: emp.name,
                                      balance: b,
                                      typeAllowance: t.annual_allowance,
                                    })
                                  }
                                />
                              ) : (
                                <span className="px-1.5 text-sm text-muted-foreground">—</span>
                              )}
                            </dd>
                          </div>
                        );
                      })}
                    </dl>
                  </li>
                ))}
              </ul>

              <div className="hidden sm:block">
                <Table scrollLabel="Employee balances">
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
                        {/* `min-w-44`, not `max-w-0`: a zero max-width let the leave columns
                            squeeze the name to an ellipsis (TIME-12). */}
                        <TableCell className="min-w-44">
                          <div className="flex items-center gap-3">
                            <UserAvatar
                              userId={emp.user_id}
                              name={emp.name}
                              className="size-8 shrink-0"
                              fallbackClassName="text-xs"
                            />
                            <div className="min-w-0">
                              <span className="block truncate font-medium">{emp.name}</span>
                              {emp.emp_id ? (
                                <span className="block truncate font-mono text-[0.7rem] text-muted-foreground">
                                  {emp.emp_id}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </TableCell>
                        {types.map((t) => {
                          const b =
                            emp.balances.find((x) => x.type_id === t.type_id) ?? null;
                          if (!b) return <TableCell key={t.type_id} />;
                          return (
                            <TableCell key={t.type_id} className="text-right">
                              <BalanceButton
                                balance={b}
                                typeAllowance={t.annual_allowance}
                                typeName={t.name}
                                personName={emp.name}
                                year={data?.year}
                                onClick={() =>
                                  setEdit({
                                    userId: emp.user_id,
                                    name: emp.name,
                                    balance: b,
                                    typeAllowance: t.annual_allowance,
                                  })
                                }
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
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

/** One person's figure for one type — opens the allowance editor. Shared by the table and the cards. */
function BalanceButton({
  balance: b,
  typeAllowance,
  typeName,
  personName,
  year,
  onClick,
}: {
  balance: ApiTypeBalance;
  /** The type's catalog allowance — what a not-yet-started balance will be seeded at. */
  typeAllowance: number;
  typeName: string;
  personName: string;
  year?: string;
  onClick: () => void;
}) {
  const c = balanceCell(b, typeAllowance);
  const said = c.noLimit
    ? `no limit${c.used > 0 ? `, ${formatDays(c.used)} taken` : ""}`
    : `${formatDays(c.remaining)} of ${formatDays(c.allowance)} days left`;
  return (
    <button
      type="button"
      onClick={onClick}
      // Wraps between the figure and its badges, never inside a figure: in a phone's two-column
      // card "No limit" and "10 / 10" broke across lines.
      className="group inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-md px-1.5 py-1 text-left tabular-nums transition-colors hover:bg-muted"
      aria-label={`Adjust ${typeName} for ${personName}: ${said}${c.notStarted ? ", not started yet" : ""}`}
      title={
        c.notStarted
          ? `Not started for ${year ?? "this year"} — ${personName} receives this ${typeName} allowance the next time they use Leave, unless you set another here.`
          : undefined
      }
    >
      {c.noLimit ? (
        <span className="whitespace-nowrap">
          <span className="font-medium">No limit</span>
          {c.used > 0 ? (
            <span className="text-xs text-muted-foreground"> · {formatDays(c.used)} taken</span>
          ) : null}
        </span>
      ) : (
        <span className="whitespace-nowrap">
          <span className={c.notStarted ? "text-muted-foreground" : "font-medium"}>
            {formatDays(c.remaining)}
          </span>
          <span className="text-xs text-muted-foreground"> / {formatDays(c.allowance)}</span>
        </span>
      )}
      {c.notStarted ? (
        <Badge variant="outline" className="px-1 py-0 text-[0.6rem] font-normal text-muted-foreground">
          not started
        </Badge>
      ) : null}
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

  // Re-seed whenever a different cell is opened; the dialog is reused across every row. Nothing
  // granted yet starts from the type's catalog allowance — what a first visit to Leave would grant.
  useEffect(() => {
    setValue(
      target
        ? String(target.balance.seeded ? target.balance.allowance : target.typeAllowance)
        : "",
    );
    setNote("");
  }, [target]);

  if (!target) return null;
  const { balance } = target;
  const parsed = Number(value);
  // Below `used` the server refuses anyway — saying so here saves a round trip and explains why.
  const tooLow = Number.isFinite(parsed) && parsed < balance.used;
  // The server's allowance is a whole number of days, at most 366. A fraction (natural to type
  // when `used` is 2.5) failed deserialisation with a vague "details weren't accepted" (WP-273).
  const notWhole = Number.isFinite(parsed) && !Number.isInteger(parsed);
  const tooHigh = Number.isFinite(parsed) && parsed > 366;
  const invalid =
    value.trim() === "" || !Number.isFinite(parsed) || parsed < 0 || tooLow || notWhole || tooHigh;

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
          {balance.seeded ? (
            <div className="grid grid-cols-3 gap-2 text-center text-sm">
              <Stat
                label="Allowance"
                value={balance.allowance > 0 ? formatDays(balance.allowance) : "No limit"}
              />
              <Stat label="Used" value={formatDays(balance.used)} />
              <Stat
                label="Remaining"
                value={balance.allowance > 0 ? formatDays(balance.remaining) : "—"}
              />
            </div>
          ) : (
            // Said as the server does it (TIME-17): the first use seeds the catalog allowance.
            <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              {target.name}&apos;s {balance.name} for {year} hasn&apos;t started yet. They&apos;ll
              receive{" "}
              {target.typeAllowance > 0
                ? `the catalog allowance of ${formatDays(target.typeAllowance)} days`
                : "no limit (the catalog sets none)"}{" "}
              the next time they use Leave. Saving sets the figure below instead.
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="allowance">New allowance (days)</Label>
            <Input
              id="allowance"
              type="number"
              min={balance.used}
              max={366}
              step={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            {/* `0` is a real setting with a real meaning server-side (`balance_allows`): no limit,
                never "none left". Say it before someone types it to mean "take it all away". */}
            {!tooLow && !notWhole && !tooHigh ? (
              <p className="text-xs text-muted-foreground">
                0 means no limit — requests are never refused for balance.
              </p>
            ) : null}
            {tooLow ? (
              <p className="text-xs text-destructive">
                {target.name} has already used {formatDays(balance.used)} day
                {balance.used === 1 ? "" : "s"} — the allowance can&apos;t go below that.
              </p>
            ) : notWhole ? (
              <p className="text-xs text-destructive">Use a whole number of days.</p>
            ) : tooHigh ? (
              <p className="text-xs text-destructive">An allowance can be at most 366 days.</p>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2 py-1.5">
      <p className="text-base font-semibold tabular-nums">{value}</p>
      <p className="text-[0.7rem] text-muted-foreground">{label}</p>
    </div>
  );
}
