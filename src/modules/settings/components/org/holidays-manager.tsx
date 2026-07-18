"use client";

/**
 * Holidays — the org's holiday calendar on the **live backend** (`/v1/org/holidays`, identity).
 *
 * Each holiday is a name + a `YYYY-MM-DD` date. Full CRUD behind one editor dialog. List is open to
 * members; writes need `settings:manage` (server 403 → toast).
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, CalendarDays } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { usePermissions } from "@/hooks/use-permissions";
import { ApiError } from "@/lib/api";
import {
  listHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  type OrgHoliday,
} from "@/modules/settings/services/org.service";

function messageOf(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

/** Format a `YYYY-MM-DD` for display without tripping over timezones. */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const byDate = (a: OrgHoliday, b: OrgHoliday) => a.date.localeCompare(b.date);

export function HolidaysManager() {
  const { can } = usePermissions();
  const canManage = can("settings:manage");

  const [rows, setRows] = useState<OrgHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<OrgHoliday | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    let live = true;
    setLoading(true);
    setError(null);
    listHolidays()
      .then((r) => {
        if (live) setRows([...r].sort(byDate));
      })
      .catch((e) => {
        if (live) setError(messageOf(e, "Couldn't load holidays."));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => load(), [load]);

  function openAdd() {
    setEditId(null);
    setName("");
    setDate("");
    setEditorOpen(true);
  }
  function openEdit(h: OrgHoliday) {
    setEditId(h.id);
    setName(h.name);
    setDate(h.date);
    setEditorOpen(true);
  }

  async function save() {
    const n = name.trim();
    if (!n || !date) return;
    setSaving(true);
    try {
      if (editId) {
        const updated = await updateHoliday(editId, { name: n, date });
        setRows((cur) => cur.map((r) => (r.id === editId ? updated : r)).sort(byDate));
        toast.success("Holiday updated");
      } else {
        const created = await createHoliday({ name: n, date });
        setRows((cur) => [...cur, created].sort(byDate));
        toast.success(`“${created.name}” added`);
      }
      setEditorOpen(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        toast.error("You don't have permission to change holidays.");
      } else {
        toast.error(messageOf(e, "Couldn't save the holiday."));
      }
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteHoliday(pendingDelete.id);
      setRows((cur) => cur.filter((r) => r.id !== pendingDelete.id));
      toast.success(`“${pendingDelete.name}” deleted`);
      setPendingDelete(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        toast.error("You don't have permission to delete holidays.");
      } else {
        toast.error(messageOf(e, "Couldn't delete the holiday."));
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle>Holidays</CardTitle>
            <CardDescription>Company holidays used across scheduling and attendance.</CardDescription>
          </div>
          {canManage && !loading && !error ? (
            <Button size="sm" className="shrink-0" onClick={openAdd}>
              <Plus className="size-4" /> Add holiday
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex min-h-[8rem] items-center justify-center">
            <Loader label="Loading holidays…" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>
              Retry
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No holidays yet"
            description={
              canManage
                ? "Add the company holidays for this organization."
                : "No holidays have been added for this organization."
            }
            className="border-0"
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border">
            {rows.map((h) => (
              <li key={h.id} className="flex items-center gap-3 px-3 py-2.5">
                <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-sm font-medium">{h.name}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{formatDate(h.date)}</span>
                {canManage ? (
                  <>
                    <Button size="icon-sm" variant="ghost" onClick={() => openEdit(h)} aria-label={`Edit ${h.name}`}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setPendingDelete(h)}
                      aria-label={`Delete ${h.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {/* Add / edit */}
      <Dialog open={editorOpen} onOpenChange={(o) => !o && setEditorOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit holiday" : "Add a holiday"}</DialogTitle>
            <DialogDescription>Give it a name and a date.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="New Year's Day"
                autoFocus
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={saving} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !name.trim() || !date}>
              {saving ? "Saving…" : editId ? "Save changes" : "Add holiday"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{pendingDelete?.name}”?</DialogTitle>
            <DialogDescription>This can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete holiday"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
