"use client";

/**
 * `/settings/agents/enrollment` — mint an enrolment code for a named employee and hand the
 * technician what they paste into the MSI (MANAGED-AGENT.md §6.2, Ph3-4).
 *
 * Built for a person standing at a laptop, not for an MDM push: pick the employee → generate →
 * one-time reveal of the code + the ready `msiexec` command → the pending-codes worklist. The reveal
 * is once and only once, mirroring the backend's returned-once discipline — reload the page and the
 * code is gone, because only its hash was ever stored.
 *
 * Hidden entirely in `project` mode (the server 409s a mint anyway) — offering a button that cannot
 * succeed is a dead end.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Loader2, Trash2, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api";
import { friendlyError } from "@/lib/errors";
import { useDirectory } from "@/hooks/use-directory";
import { usePermissions } from "@/hooks/use-permissions";
import { useTrackingMode } from "@/hooks/use-features";
import { personName } from "@/lib/format";
import {
  listEnrollmentCodes,
  mintEnrollmentCode,
  revokeEnrollmentCode,
  type MintedCode,
  type PendingCode,
} from "../services/fleet.service";

/** The MSI filename the download link + install command reference. Kept in one place. */
const MSI_NAME = "WorkPulseAgentService_x64.msi";

/** Build the paste-ready install command. The code carries the tenant, so nothing else is needed. */
function installCommand(code: string): string {
  return `msiexec /i ${MSI_NAME} /qn ENROLLTOKEN=${code}`;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => toast.error("Couldn't copy — select and copy manually"));
      }}
      aria-label={label}
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

export function EnrollmentView() {
  const { can } = usePermissions();
  const mode = useTrackingMode();
  const { employees, loading: dirLoading } = useDirectory(true);

  const [userId, setUserId] = useState("");
  const [upn, setUpn] = useState("");
  const [minting, setMinting] = useState(false);
  /** The just-minted code, revealed once. Cleared when a new employee is picked. */
  const [minted, setMinted] = useState<MintedCode | null>(null);
  /** A typed 409 rendered inline (not a toast) — it is the answer to a real question. */
  const [conflict, setConflict] = useState<string | null>(null);

  const [codes, setCodes] = useState<PendingCode[]>([]);
  const [codesLoading, setCodesLoading] = useState(true);

  const canManage = can("agents:manage");

  // Employees who already have a pending code — so the picker can flag them rather than let IT mint
  // a second code that will just sit unused beside the first.
  const pendingByUser = useMemo(
    () => new Set(codes.map((c) => c.user_id)),
    [codes],
  );

  const nameOf = useCallback(
    // Never the raw sub: this page lists the whole directory, so a miss means the employee was
    // deleted while their enrolment code survived.
    (id: string) => personName(employees.find((e) => e.user_id === id)?.name),
    [employees],
  );

  const reloadCodes = useCallback(() => {
    setCodesLoading(true);
    listEnrollmentCodes()
      .then(setCodes)
      .catch(() => setCodes([]))
      .finally(() => setCodesLoading(false));
  }, []);

  useEffect(() => {
    if (canManage) reloadCodes();
  }, [canManage, reloadCodes]);

  const mint = useCallback(() => {
    if (!userId) return;
    setMinting(true);
    setConflict(null);
    setMinted(null);
    mintEnrollmentCode({ user_id: userId, ...(upn.trim() ? { assign_upn: upn.trim() } : {}) })
      .then((code) => {
        setMinted(code);
        setUpn("");
        reloadCodes();
      })
      .catch((e) => {
        // The two typed 409s are answers, not errors — render them where the eye already is.
        if (e instanceof ApiError && e.code === "employee_already_has_device") {
          setConflict(
            `${nameOf(userId)} already has an agent. Release it from the device page before issuing a new code.`,
          );
        } else if (e instanceof ApiError && e.code === "tracking_mode_not_managed") {
          setConflict(
            "This organization isn't in Machine or Mixed mode. Switch it in Settings → Organization first.",
          );
        } else {
          toast.error("Couldn't mint a code", { description: friendlyError(e) });
        }
      })
      .finally(() => setMinting(false));
  }, [nameOf, reloadCodes, upn, userId]);

  const revoke = useCallback(
    (codeId: string) => {
      revokeEnrollmentCode(codeId)
        .then(() => {
          toast.success("Code revoked");
          reloadCodes();
        })
        .catch((e) => toast.error("Couldn't revoke", { description: friendlyError(e) }));
    },
    [reloadCodes],
  );

  if (!canManage) {
    return (
      <EmptyState
        icon={KeyRound}
        title="Enrolment is admin-only"
        description="You need the Manage device agents permission to mint enrolment codes."
      />
    );
  }

  // Hidden in project mode — the managed agent isn't deployed there, and the server 409s a mint
  // (`tracking_mode_not_managed`) anyway. Offering a button that cannot succeed is a dead end.
  if (mode === "project") {
    return (
      <EmptyState
        icon={KeyRound}
        title="Device enrolment isn't available in this mode"
        description="Switch to Machine or Mixed tracking in Settings → Organization to deploy the background agent."
      />
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Enrol a device"
        description="Mint a one-time code for an employee, then install the agent on their computer with it."
      />

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="enrol-employee">Employee</Label>
              <Select
                value={userId}
                onValueChange={(v) => {
                  setUserId(String(v));
                  setMinted(null);
                  setConflict(null);
                }}
              >
                <SelectTrigger id="enrol-employee">
                  <SelectValue placeholder={dirLoading ? "Loading…" : "Pick an employee"} />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.user_id} value={e.user_id}>
                      {e.name}
                      {pendingByUser.has(e.user_id) ? " · code pending" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enrol-upn">Windows account (optional)</Label>
              <Input
                id="enrol-upn"
                value={upn}
                onChange={(e) => setUpn(e.target.value)}
                placeholder="ACME\p.nair or p.nair@acme.test"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                If you know it, only this account is tracked on the device.
              </p>
            </div>
          </div>

          {conflict && (
            <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              {conflict}
            </p>
          )}

          <Button onClick={mint} disabled={!userId || minting}>
            {minting ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            Generate code
          </Button>

          {minted && (
            <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-medium">
                Code for {nameOf(minted.user_id)} — this is the only time it&apos;s shown.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-background px-3 py-2 font-mono text-sm">
                  {minted.code}
                </code>
                <CopyButton text={minted.code} label="Copy code" />
              </div>
              <div className="space-y-1.5">
                <Label>Install command</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all rounded bg-background px-3 py-2 font-mono text-xs">
                    {installCommand(minted.code)}
                  </code>
                  <CopyButton text={installCommand(minted.code)} label="Copy install command" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Run this on {nameOf(minted.user_id)}&apos;s computer as an administrator. The code
                  expires in a few hours and works once.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending worklist — codes issued but not yet installed. */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">Pending codes</h2>
        {codesLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : codes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No codes waiting to be installed. Generate one above.
          </p>
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {codes.map((c) => (
                <div key={c.code_id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{nameOf(c.user_id)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Issued by {nameOf(c.created_by)} · expires{" "}
                      {new Date(c.expires_at * 1000).toLocaleString()}
                      {c.assign_upn ? ` · ${c.assign_upn}` : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revoke(c.code_id)}
                    aria-label={`Revoke code for ${nameOf(c.user_id)}`}
                  >
                    <Trash2 className="size-4" /> Revoke
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
