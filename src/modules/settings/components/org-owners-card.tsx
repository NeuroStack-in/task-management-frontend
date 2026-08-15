"use client";

/**
 * The org's owners — add, remove, and see who holds the role (LLD §16).
 *
 * **Distinct from Transfer ownership**, which sits below it. Transfer is *hand over and step back*:
 * the transferor gives up ownership whichever exit they pick. This adds an owner and leaves everyone
 * already holding it in place, which is the ordinary case — a second founder, a deputy, cover for
 * someone on leave.
 *
 * **The one rule that cannot be broken: an org must never reach zero owners.** Only an owner can
 * appoint an owner, so an org that loses its last one is unrecoverable from inside the product. The
 * server refuses it with a `last_owner` conflict; this disables the control at one owner so the
 * refusal is something you read *before* acting rather than a failure afterwards.
 *
 * Owner-only, gated on `is_owner` server-side. A non-owner gets 403 and this card hides rather than
 * showing an error — plenty of roles can open this page without being entitled to the section.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Crown, Plus, ShieldMinus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader } from "@/components/shared/loader";
import { ApiError } from "@/lib/api";
import { initials } from "@/lib/format";
import {
  listOwners,
  grantOwner,
  revokeOwner,
  type OrgOwner,
} from "../services/org.service";
import { listRoles, type ApiRole } from "@/modules/roles/services/roles.service";
import { useEmployees } from "@/modules/employees/use-employees";

/** The role a demoted owner keeps by default — never nothing (the server requires one). */
const DEFAULT_TAKE_ROLE = "role-admin";

export function OrgOwnersCard() {
  const [owners, setOwners] = useState<OrgOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addId, setAddId] = useState<string | null>(null);
  const [roles, setRoles] = useState<ApiRole[]>([]);

  const { employees } = useEmployees();

  const load = useCallback(() => {
    let live = true;
    setLoading(true);
    listOwners()
      .then((r) => live && setOwners(r.owners))
      .catch((e) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 403) setForbidden(true);
        else toast.error("Couldn't load the owners.");
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => load(), [load]);

  useEffect(() => {
    listRoles()
      .then(setRoles)
      .catch(() => {
        /* the default take-role still works without the list */
      });
  }, []);

  const ownerIds = useMemo(() => new Set(owners.map((o) => o.user_id)), [owners]);
  // Only active members who are not already owners — granting an existing owner is a no-op, and the
  // server refuses a deactivated one outright.
  const candidates = useMemo(
    () => employees.filter((u) => u.status === "active" && !ownerIds.has(u.id)),
    [employees, ownerIds],
  );
  // The roles a demoted owner may take. `role-owner` is excluded: that is not a demotion.
  const takeRoles = useMemo(
    () => roles.filter((r) => r.id !== "role-owner"),
    [roles],
  );

  async function add() {
    if (!addId || busy) return;
    setBusy(true);
    try {
      const r = await grantOwner(addId);
      setOwners(r.owners);
      setAddId(null);
      toast.success("Owner added", {
        description: "They now have full, unrestricted access to this organisation.",
      });
    } catch (e) {
      toast.error(
        e instanceof ApiError ? e.message : "Couldn't add that owner.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(o: OrgOwner) {
    if (busy) return;
    setBusy(true);
    try {
      const takeRole = takeRoles.some((r) => r.id === DEFAULT_TAKE_ROLE)
        ? DEFAULT_TAKE_ROLE
        : (takeRoles[0]?.id ?? DEFAULT_TAKE_ROLE);
      const r = await revokeOwner(o.user_id, takeRole);
      setOwners(r.owners);
      toast.success(`${o.is_you ? "You are" : `${o.name} is`} no longer an owner`, {
        description: "They keep their place in the organisation with an ordinary role.",
      });
    } catch (e) {
      // The server's own last-owner guard, in case this UI's count was stale.
      const last = e instanceof ApiError && e.message.includes("last_owner");
      toast.error(
        last
          ? "That's the only owner — add another before removing this one."
          : "Couldn't remove that owner.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (forbidden) return null;

  const soleOwner = owners.length <= 1;

  return (
    <Card className="gap-0 p-0">
      <div className="flex items-start gap-4 px-6 py-5">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-feature-tint text-primary">
          <Crown className="size-4" />
        </span>
        <div className="min-w-0 space-y-1">
          <h3 className="font-heading text-base font-medium">Organization owners</h3>
          <p className="text-sm text-muted-foreground">
            Owners have full, unrestricted access — every permission, on everything.
            An organisation must always have at least one.
          </p>
        </div>
      </div>

      <div className="border-t border-border px-6 py-4">
        {loading ? (
          <Loader label="Loading owners…" />
        ) : (
          <ul className="divide-y divide-border">
            {owners.map((o) => (
              <li key={o.user_id} className="flex items-center gap-3 py-3">
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs">{initials(o.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {o.name}
                    {o.is_you ? (
                      <Badge variant="secondary" className="ml-2 align-middle">
                        You
                      </Badge>
                    ) : null}
                  </p>
                  {o.email ? (
                    <p className="truncate text-xs text-muted-foreground">{o.email}</p>
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || soleOwner}
                  onClick={() => remove(o)}
                  // Say *why* it is unavailable rather than leaving a dead control. Self-removal is
                  // allowed when someone else owns the org — stepping down is legitimate.
                  title={
                    soleOwner
                      ? "The only owner cannot be removed — add another first"
                      : o.is_you
                        ? "Step down as an owner"
                        : `Remove ${o.name} as an owner`
                  }
                >
                  <ShieldMinus className="size-3.5" />
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center">
        <Select
          value={addId ?? ""}
          onValueChange={(v) => setAddId(typeof v === "string" && v ? v : null)}
        >
          <SelectTrigger className="sm:w-72">
            <SelectValue placeholder="Add an owner…" />
          </SelectTrigger>
          <SelectContent>
            {candidates.length === 0 ? (
              <SelectItem value="" disabled>
                No other active members
              </SelectItem>
            ) : (
              candidates.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Button onClick={add} disabled={!addId || busy}>
          <Plus className="size-4" />
          Add owner
        </Button>
        <p className="text-xs text-muted-foreground sm:ml-auto">
          {soleOwner
            ? "This organisation has one owner."
            : `${owners.length} owners.`}
        </p>
      </div>
    </Card>
  );
}
