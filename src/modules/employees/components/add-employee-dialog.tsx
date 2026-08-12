"use client";

/**
 * Add employees who will **never sign in** (MANAGED-AGENT.md §6.4).
 *
 * The counterpart to `InviteDialog`, and deliberately a separate dialog rather than a mode of it:
 * an invite creates a *login* (role, password, an email that must be acted on), this creates a
 * *directory record* (a person a managed agent can attribute time to). Sharing one dialog would
 * mean a role select that means nothing in one branch and an email that is a destination in one and
 * an identifier in the other.
 *
 * Two ways in, because the two real jobs are different sizes: one person by hand, or a CSV out of an
 * HR system. Both post the same route and both surface **per-row results** — a 200-row import where
 * three rows failed is a normal outcome, and the three have to be nameable.
 */

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, FileUp, Upload, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { downloadBlob } from "@/lib/download";
import { friendlyError } from "@/lib/errors";
import { isEmail } from "@/lib/validation";
import { cn } from "@/lib/utils";
import {
  createMonitoredEmployees,
  monitoredRowError,
  type MonitoredEmployeeInput,
  type MonitoredRowResult,
} from "../services/employees.service";
import {
  CSV_TEMPLATE,
  parseEmployeeCsv,
  type ParsedEmployeeCsv,
} from "../lib/parse-employee-csv";

/**
 * Rows per request. **Must not exceed the server's own cap** (`MAX_BULK_ROWS = 200`), which rejects
 * the whole request rather than truncating. Larger files are chunked into sequential requests, so a
 * 600-row file is three round trips whose results are concatenated — the alternative is telling
 * someone to split a spreadsheet by hand.
 */
const CHUNK = 200;

/** How many bytes of CSV to accept. A file much larger than this is not a staff list. */
const MAX_CSV_BYTES = 2 * 1024 * 1024;

type Tab = "one" | "csv";

export function AddEmployeeDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired after any row was created — the roster refetches on it. */
  onCreated?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("one");
  const [submitting, setSubmitting] = useState(false);
  /** `n of total` while a chunked import runs — 600 rows takes visible seconds. */
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  /** Failures from the last run, kept on screen so they can be fixed and retried. */
  const [failures, setFailures] = useState<MonitoredRowResult[]>([]);

  // Single-employee fields.
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [title, setTitle] = useState("");

  // CSV state.
  const [csv, setCsv] = useState<(ParsedEmployeeCsv & { fileName: string }) | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const singleValid = name.trim().length > 0 && isEmail(email.trim());

  const reset = useCallback(() => {
    setName("");
    setEmail("");
    setTitle("");
    setCsv(null);
    setFailures([]);
    setProgress(null);
    if (fileInput.current) fileInput.current.value = "";
  }, []);

  const close = useCallback(
    (next: boolean) => {
      if (!next) reset();
      onOpenChange(next);
    },
    [onOpenChange, reset],
  );

  /** Post rows in chunks, concatenating per-row results. Indices are rebased onto the whole file so
   *  a failure in chunk 3 still points at the right CSV line. */
  const submitRows = useCallback(
    async (rows: MonitoredEmployeeInput[]) => {
      setSubmitting(true);
      setFailures([]);
      const all: MonitoredRowResult[] = [];
      try {
        for (let offset = 0; offset < rows.length; offset += CHUNK) {
          const slice = rows.slice(offset, offset + CHUNK);
          setProgress({ done: offset, total: rows.length });
          const res = await createMonitoredEmployees(slice);
          all.push(...res.results.map((r) => ({ ...r, index: r.index + offset })));
        }
      } catch (e) {
        // A thrown error means a whole request failed (auth, network, a 400 on the batch itself) —
        // distinct from per-row failures, which come back inside a 200.
        toast.error("Couldn't add employees", { description: friendlyError(e) });
        setSubmitting(false);
        setProgress(null);
        return;
      }
      setSubmitting(false);
      setProgress(null);

      const created = all.filter((r) => r.created).length;
      const failed = all.filter((r) => !r.created);
      setFailures(failed);

      if (created > 0) onCreated?.();

      if (failed.length === 0) {
        toast.success(created === 1 ? "Employee added" : `${created} employees added`, {
          description: "They appear in the directory and can be assigned a device. No login was created.",
        });
        close(false);
        return;
      }
      if (created === 0) {
        toast.error("Nothing was added", { description: `${failed.length} rows couldn't be used.` });
        return;
      }
      // The honest middle case: partial success is normal for an import, so say both numbers and
      // keep the dialog open with the failures listed.
      toast.warning(`${created} added, ${failed.length} skipped`, {
        description: "The rows that failed are listed below.",
      });
    },
    [close, onCreated],
  );

  const submitSingle = useCallback(() => {
    void submitRows([
      {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        ...(title.trim() ? { title: title.trim() } : {}),
      },
    ]);
  }, [email, name, submitRows, title]);

  const submitCsv = useCallback(() => {
    if (!csv || csv.rows.length === 0) return;
    void submitRows(
      csv.rows.map((r) => ({
        name: r.name,
        email: r.email,
        // The CSV carries department/team **names**, which the server keys by id. Sending a name as
        // an id would 400 the row, so they are dropped here and filed afterwards from the roster.
        // Wiring name→id resolution belongs with the department picker, not with the parser.
        ...(r.title ? { title: r.title } : {}),
      })),
    );
  }, [csv, submitRows]);

  const onFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_CSV_BYTES) {
      toast.error("That file is too large", { description: "CSV imports are limited to 2 MB." });
      return;
    }
    setFailures([]);
    file
      .text()
      .then((text) => setCsv({ ...parseEmployeeCsv(text), fileName: file.name }))
      .catch(() => toast.error("Couldn't read that file"));
  }, []);

  const busyLabel = progress
    ? `Adding ${progress.done} of ${progress.total}…`
    : "Adding…";

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add employee</DialogTitle>
          <DialogDescription>
            Creates a directory record with <strong>no login</strong>. They can be assigned a
            monitored device; they can&apos;t sign in to WorkPulse. Use <em>Invite</em> instead if
            this person needs console access.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(
            [
              ["one", "One person"],
              ["csv", "Import CSV"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "one" ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="me-name">Full name</Label>
              <Input
                id="me-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Priya Nair"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="me-email">Work email</Label>
              <Input
                id="me-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="priya.nair@example.com"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Used to identify them in the directory — no email is sent.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="me-title">Job title (optional)</Label>
              <Input
                id="me-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Backend Engineer"
                autoComplete="off"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => fileInput.current?.click()}
                disabled={submitting}
              >
                <FileUp className="size-4" /> Choose CSV
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  downloadBlob(
                    new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" }),
                    "employees-template.csv",
                  )
                }
              >
                Download template
              </Button>
            </div>

            {csv?.fatal ? (
              <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                {csv.fatal}
              </p>
            ) : csv ? (
              <div className="space-y-2 rounded-lg border p-3 text-sm">
                <p className="font-medium">{csv.fileName}</p>
                <p className="text-muted-foreground">
                  {csv.rows.length} {csv.rows.length === 1 ? "person" : "people"} ready
                  {csv.duplicates > 0 ? ` · ${csv.duplicates} duplicate rows folded` : ""}
                  {csv.errors.length > 0 ? ` · ${csv.errors.length} rows skipped` : ""}
                </p>
                {csv.errors.length > 0 && (
                  <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                    {csv.errors.map((e) => (
                      <li key={e.line}>
                        Row {e.line}: {e.reason}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-muted-foreground">
                  Department and team columns are read but not applied yet — file people from the
                  roster after importing.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                A <code className="font-mono text-xs">name</code> and{" "}
                <code className="font-mono text-xs">email</code> column are required. Other columns
                are ignored.
              </p>
            )}
          </div>
        )}

        {failures.length > 0 && (
          <div className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm font-medium text-destructive">
              {failures.length} {failures.length === 1 ? "row" : "rows"} not added
            </p>
            <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
              {failures.map((f) => (
                <li key={`${f.index}-${f.email}`}>
                  {f.email || `Row ${f.index + 1}`} — {monitoredRowError(f.error)}
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} disabled={submitting}>
            Cancel
          </Button>
          {tab === "one" ? (
            <Button onClick={submitSingle} disabled={!singleValid || submitting}>
              <UserPlus className="size-4" />
              {submitting ? busyLabel : "Add employee"}
            </Button>
          ) : (
            <Button
              onClick={submitCsv}
              disabled={submitting || !csv || csv.rows.length === 0}
            >
              <Upload className="size-4" />
              {submitting
                ? busyLabel
                : `Import ${csv?.rows.length ?? 0} ${csv?.rows.length === 1 ? "person" : "people"}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
