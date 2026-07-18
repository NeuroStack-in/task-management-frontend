"use client";

/**
 * Policies — the org's policy documents on the **live backend** (`/v1/org/policies`, identity).
 *
 * Each policy has a title and either inline `body` text or an external `url` (both optional). Full
 * CRUD behind one editor dialog. List is open to members; writes need `settings:manage` (403 → toast).
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileText, ExternalLink } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api";
import {
  listPolicies,
  createPolicy,
  updatePolicy,
  deletePolicy,
  type OrgPolicy,
} from "@/modules/settings/services/org.service";

function messageOf(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

interface PolicyForm {
  title: string;
  body: string;
  url: string;
}
const EMPTY_POLICY: PolicyForm = { title: "", body: "", url: "" };

const byTitle = (a: OrgPolicy, b: OrgPolicy) => a.title.localeCompare(b.title);

export function PoliciesManager() {
  const { can } = usePermissions();
  const canManage = can("settings:manage");

  const [rows, setRows] = useState<OrgPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<PolicyForm>(EMPTY_POLICY);
  const [saving, setSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<OrgPolicy | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    let live = true;
    setLoading(true);
    setError(null);
    listPolicies()
      .then((r) => {
        if (live) setRows([...r].sort(byTitle));
      })
      .catch((e) => {
        if (live) setError(messageOf(e, "Couldn't load policies."));
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
    setForm(EMPTY_POLICY);
    setEditorOpen(true);
  }
  function openEdit(p: OrgPolicy) {
    setEditId(p.id);
    setForm({ title: p.title ?? "", body: p.body ?? "", url: p.url ?? "" });
    setEditorOpen(true);
  }

  async function save() {
    const title = form.title.trim();
    if (!title) return;
    const body = {
      title,
      body: form.body.trim() || undefined,
      url: form.url.trim() || undefined,
    };
    setSaving(true);
    try {
      if (editId) {
        const updated = await updatePolicy(editId, body);
        setRows((cur) => cur.map((r) => (r.id === editId ? updated : r)).sort(byTitle));
        toast.success("Policy updated");
      } else {
        const created = await createPolicy(body);
        setRows((cur) => [...cur, created].sort(byTitle));
        toast.success(`“${created.title}” added`);
      }
      setEditorOpen(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        toast.error("You don't have permission to change policies.");
      } else {
        toast.error(messageOf(e, "Couldn't save the policy."));
      }
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deletePolicy(pendingDelete.id);
      setRows((cur) => cur.filter((r) => r.id !== pendingDelete.id));
      toast.success(`“${pendingDelete.title}” deleted`);
      setPendingDelete(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        toast.error("You don't have permission to delete policies.");
      } else {
        toast.error(messageOf(e, "Couldn't delete the policy."));
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
            <CardTitle>Policies</CardTitle>
            <CardDescription>Workplace policies your team can reference.</CardDescription>
          </div>
          {canManage && !loading && !error ? (
            <Button size="sm" className="shrink-0" onClick={openAdd}>
              <Plus className="size-4" /> Add policy
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex min-h-[8rem] items-center justify-center">
            <Loader label="Loading policies…" />
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
            icon={FileText}
            title="No policies yet"
            description={
              canManage
                ? "Add your workplace policies so the team can reference them."
                : "No policies have been added for this organization."
            }
            className="border-0"
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border">
            {rows.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.title}</p>
                  {p.url ? (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 truncate text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="size-3 shrink-0" />
                      <span className="truncate">{p.url}</span>
                    </a>
                  ) : p.body ? (
                    <p className="truncate text-xs text-muted-foreground">{p.body}</p>
                  ) : null}
                </div>
                {canManage ? (
                  <>
                    <Button size="icon-sm" variant="ghost" onClick={() => openEdit(p)} aria-label={`Edit ${p.title}`}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => setPendingDelete(p)}
                      aria-label={`Delete ${p.title}`}
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit policy" : "Add a policy"}</DialogTitle>
            <DialogDescription>
              A title is required. Add inline text, an external link, or both.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Remote work policy"
                autoFocus
                disabled={saving}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Body</Label>
              <textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Policy details…"
                rows={4}
                disabled={saving}
                className={cn(
                  "w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Link (URL)</Label>
              <Input
                type="url"
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://intranet.example.com/policy"
                disabled={saving}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !form.title.trim()}>
              {saving ? "Saving…" : editId ? "Save changes" : "Add policy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{pendingDelete?.title}”?</DialogTitle>
            <DialogDescription>This can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete policy"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
