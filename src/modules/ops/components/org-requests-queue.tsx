"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Building2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader } from "@/components/shared/loader";
import { EmptyState } from "@/components/shared/empty-state";
import { ApiError } from "@/lib/api";
import {
  approveOrgRequest,
  listOrgRequests,
  rejectOrgRequest,
  type OpsOrgRequest,
} from "../services/ops.service";

type Status = "pending" | "approved" | "rejected";
const TABS: { id: Status; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

/**
 * The organization-creation review queue — the cross-tenant console where WorkPulse staff decide
 * who gets an organization.
 *
 * Approving here is what **creates** the org: until an operator clicks it, no tenant exists at all.
 * That is why the row shows the applicant's verified email as prominently as the org name — the
 * identity is the thing being judged, not the workspace name.
 *
 * Access is enforced server-side on every call (`SYS#PLATFORM / ADMINS`). This component is only
 * rendered behind the same `/ops/me` check the support desk uses; it never decides access itself.
 */
export function OrgRequestsQueue() {
  const [status, setStatus] = useState<Status>("pending");
  const [rows, setRows] = useState<OpsOrgRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<OpsOrgRequest | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listOrgRequests(status)
      .then((r) => setRows(r.requests))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Couldn't load the queue."))
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(load, [load]);

  async function approve(r: OpsOrgRequest) {
    setBusyId(r.id);
    try {
      const out = await approveOrgRequest(r.id);
      toast.success(`${r.org_name} created`, { description: `Workspace: ${out.slug}` });
      load();
    } catch (e) {
      // Approval failing is expected in one real case: another pending request took the slug first.
      // Say so rather than "something went wrong" — the operator's next move differs entirely.
      toast.error(
        e instanceof ApiError ? e.message : "Couldn't create the organization. Nothing was changed.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function confirmReject() {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    try {
      await rejectOrgRequest(rejecting.id, reason.trim());
      toast.success("Request rejected", { description: "The applicant has been told why." });
      setRejecting(null);
      setReason("");
      load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Couldn't reject the request.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {TABS.map((t) => (
          <Button
            key={t.id}
            size="sm"
            variant={status === t.id ? "default" : "outline"}
            onClick={() => setStatus(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader label="Loading requests…" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button size="sm" variant="outline" onClick={load}>
            Retry
          </Button>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={status === "pending" ? "Nothing to review" : `No ${status} requests`}
          description={
            status === "pending"
              ? "New organization requests appear here for review."
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-heading font-semibold">{r.org_name}</p>
                    <Badge variant="secondary" className="font-mono text-[11px]">
                      {r.slug}
                    </Badge>
                    {/* Both requests pass review; only the first APPROVED gets the name. Shown so
                        the order is chosen deliberately rather than discovered as an error. */}
                    {r.slug_conflict ? (
                      <Badge
                        variant="outline"
                        className="text-warning border-warning/40 gap-1 text-[11px]"
                      >
                        <AlertTriangle className="size-3" />
                        Name also requested
                      </Badge>
                    ) : null}
                  </div>
                  {/* The verified email is the whole basis for the decision — established by the
                      pre-sign-up trigger before the request could exist. */}
                  <p className="text-sm">
                    {r.owner_name} ·{" "}
                    <span className="text-muted-foreground">{r.owner_email}</span>
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {[r.industry, r.size, r.timezone].filter(Boolean).join(" · ") || "—"}
                    {" · "}
                    {new Date(r.requested_at).toLocaleString()}
                  </p>
                  {r.reason ? (
                    <p className="text-muted-foreground text-xs italic">Reason: {r.reason}</p>
                  ) : null}
                  {r.tenant_id ? (
                    <p className="text-muted-foreground font-mono text-[11px]">{r.tenant_id}</p>
                  ) : null}
                </div>

                {status === "pending" ? (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      onClick={() => approve(r)}
                      disabled={busyId === r.id}
                      className="gap-1.5"
                    >
                      <Check className="size-4" />
                      {busyId === r.id ? "Creating…" : "Approve"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRejecting(r);
                        setReason("");
                      }}
                      disabled={busyId === r.id}
                      className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
                    >
                      <X className="size-4" />
                      Reject
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={rejecting !== null} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejecting?.org_name}?</DialogTitle>
            <DialogDescription>
              {/* The applicant sees this verbatim, and it is the only thing they can act on. */}
              The applicant is shown this reason, so write something they can act on. They can submit
              a new request afterwards.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. We couldn't verify this is a registered company — please apply with a work email."
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmReject}
              disabled={!reason.trim() || busyId === rejecting?.id}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {busyId === rejecting?.id ? "Rejecting…" : "Reject request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
