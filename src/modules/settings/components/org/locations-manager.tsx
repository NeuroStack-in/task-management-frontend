"use client";

/**
 * Locations — office/site records on the **live backend** (`/v1/org/locations`, identity context).
 *
 * Full CRUD behind one editor dialog (shared by add + edit). List is open to members; writes need
 * `settings:manage` (server 403 → toast).
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  listLocations,
  createLocation,
  updateLocation,
  deleteLocation,
  type OrgLocation,
} from "@/modules/settings/services/org.service";

const TIMEZONE_OPTIONS = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Madrid",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;
const TZ_NONE = "__none__";

function messageOf(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

interface LocForm {
  name: string;
  address: string;
  city: string;
  country: string;
  timezone: string;
}
const EMPTY_LOC: LocForm = { name: "", address: "", city: "", country: "", timezone: "" };

export function LocationsManager() {
  const { can } = usePermissions();
  const canManage = can("settings:manage");

  const [rows, setRows] = useState<OrgLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor dialog: editing an existing row (id set) or adding (id null).
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<LocForm>(EMPTY_LOC);
  const [saving, setSaving] = useState(false);

  // Delete confirm.
  const [pendingDelete, setPendingDelete] = useState<OrgLocation | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    let live = true;
    setLoading(true);
    setError(null);
    listLocations()
      .then((r) => {
        if (live) setRows([...r].sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch((e) => {
        if (live) setError(messageOf(e, "Couldn't load locations."));
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
    setForm(EMPTY_LOC);
    setEditorOpen(true);
  }
  function openEdit(l: OrgLocation) {
    setEditId(l.id);
    setForm({
      name: l.name ?? "",
      address: l.address ?? "",
      city: l.city ?? "",
      country: l.country ?? "",
      timezone: l.timezone ?? "",
    });
    setEditorOpen(true);
  }

  async function save() {
    const name = form.name.trim();
    if (!name) return;
    const body = {
      name,
      address: form.address.trim() || undefined,
      city: form.city.trim() || undefined,
      country: form.country.trim() || undefined,
      timezone: form.timezone.trim() || undefined,
    };
    setSaving(true);
    try {
      if (editId) {
        const updated = await updateLocation(editId, body);
        setRows((cur) => cur.map((r) => (r.id === editId ? updated : r)).sort((a, b) => a.name.localeCompare(b.name)));
        toast.success("Location updated");
      } else {
        const created = await createLocation(body);
        setRows((cur) => [...cur, created].sort((a, b) => a.name.localeCompare(b.name)));
        toast.success(`“${created.name}” added`);
      }
      setEditorOpen(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        toast.error("You don't have permission to change locations.");
      } else {
        toast.error(messageOf(e, "Couldn't save the location."));
      }
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteLocation(pendingDelete.id);
      setRows((cur) => cur.filter((r) => r.id !== pendingDelete.id));
      toast.success(`“${pendingDelete.name}” deleted`);
      setPendingDelete(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        toast.error("You don't have permission to delete locations.");
      } else {
        toast.error(messageOf(e, "Couldn't delete the location."));
      }
    } finally {
      setDeleting(false);
    }
  }

  const subtitle = (l: OrgLocation) =>
    [l.city, l.country].filter(Boolean).join(", ") || l.address || l.timezone || "";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <CardTitle>Locations</CardTitle>
            <CardDescription>Offices and sites your workforce is based at.</CardDescription>
          </div>
          {canManage && !loading && !error ? (
            <Button size="sm" className="shrink-0" onClick={openAdd}>
              <Plus className="size-4" /> Add location
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex min-h-[8rem] items-center justify-center">
            <Loader label="Loading locations…" />
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
            icon={MapPin}
            title="No locations yet"
            description={
              canManage
                ? "Add the offices or sites your workforce is based at."
                : "No locations have been added for this organization."
            }
            className="border-0"
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border">
            {rows.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-3 py-2.5">
                <MapPin className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{l.name}</p>
                  {subtitle(l) ? (
                    <p className="truncate text-xs text-muted-foreground">{subtitle(l)}</p>
                  ) : null}
                </div>
                {canManage ? (
                  <>
                    <Button size="icon-sm" variant="ghost" onClick={() => openEdit(l)} aria-label={`Edit ${l.name}`}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setPendingDelete(l)}
                      aria-label={`Delete ${l.name}`}
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
            <DialogTitle>{editId ? "Edit location" : "Add a location"}</DialogTitle>
            <DialogDescription>Name is required; the rest are optional.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="HQ"
                autoFocus
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="123 Market St"
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <Label>City</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="San Francisco"
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Country</Label>
              <Input
                value={form.country}
                onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                placeholder="United States"
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Timezone</Label>
              <Select
                value={form.timezone || TZ_NONE}
                onValueChange={(v) => setForm((f) => ({ ...f, timezone: v === TZ_NONE ? "" : (v as string) }))}
                disabled={saving}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a timezone…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TZ_NONE}>No timezone</SelectItem>
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !form.name.trim()}>
              {saving ? "Saving…" : editId ? "Save changes" : "Add location"}
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
              {deleting ? "Deleting…" : "Delete location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
