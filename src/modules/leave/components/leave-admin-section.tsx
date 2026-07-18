"use client";

/**
 * Leave administration — org configuration, deliberately fenced off from the personal leave page
 * above it. Two things live here:
 *
 *  - the leave-type catalog (`PUT /v1/leave/types`, `POST /v1/leave/types/restore`);
 *  - the balance backfill (`POST /v1/leave/seed-balances`), a maintenance action.
 *
 * Every write needs the backend's `leave:manage` bit. The frontend permission catalog has no such
 * id, so the caller gates this whole section on `settings:manage` — the org-configuration bit. The
 * server is the real gate; a role that slips past the UI check still gets a 403.
 */
import { useState } from "react";
import { toast } from "sonner";
import { ListChecks, TriangleAlert, Wrench } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ApiError } from "@/lib/api";
import { useLeaveAdmin } from "../use-leave-admin";
import { LeaveTypesDialog } from "./leave-types-dialog";

const currentYear = () => String(new Date().getFullYear());

export function LeaveAdminSection({ onChanged }: { onChanged?: () => void }) {
  const admin = useLeaveAdmin();
  const [typesOpen, setTypesOpen] = useState(false);
  const [year, setYear] = useState(currentYear);
  const [confirmSeed, setConfirmSeed] = useState(false);
  const [seeding, setSeeding] = useState(false);

  async function handleSave(next: Parameters<typeof admin.save>[0]) {
    await admin.save(next);
    // The catalog drives the balances and the request picker on the page above.
    onChanged?.();
  }

  async function handleRestore() {
    await admin.restore();
    onChanged?.();
  }

  async function handleSeed() {
    const y = year.trim();
    if (!/^\d{4}$/.test(y)) {
      toast.error("Enter a year as YYYY, e.g. 2026.");
      return;
    }
    setSeeding(true);
    try {
      const res = await admin.seed(y);
      toast.success(`Seeded ${res.year}`, {
        description: `${res.seeded_users} active employee${
          res.seeded_users === 1 ? "" : "s"
        } now have balances for ${res.year}.`,
      });
      setConfirmSeed(false);
      onChanged?.();
    } catch (e) {
      toast.error(
        e instanceof ApiError ? e.message : "Couldn't seed balances. Try again.",
      );
    } finally {
      setSeeding(false);
    }
  }

  const activeCount = admin.types.filter((t) => t.active).length;

  return (
    <Card className="gap-0 p-0 [--card-spacing:0px]">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <Wrench className="size-4 text-muted-foreground" />
        <h2 className="font-display text-base font-semibold tracking-tight">
          Leave administration
        </h2>
        <Badge variant="outline" className="ml-1 font-normal text-muted-foreground">
          Org settings
        </Badge>
      </div>

      {admin.error ? (
        <div className="flex items-center justify-between gap-3 px-5 py-4 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <TriangleAlert className="size-4 text-warning" /> {admin.error}
          </span>
          <Button variant="outline" size="sm" onClick={admin.reload}>
            Retry
          </Button>
        </div>
      ) : null}

      {/* Leave types */}
      <section className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <ListChecks className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold">Leave types</p>
            <p className="text-xs text-muted-foreground">
              {admin.loading
                ? "Loading the catalog…"
                : `${activeCount} active of ${admin.types.length} configured. Allowances apply to every employee.`}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => setTypesOpen(true)}
          disabled={admin.loading}
        >
          Edit types
        </Button>
      </section>

      {/* Seed balances — maintenance */}
      <section className="space-y-3 p-5">
        <div>
          <p className="text-sm font-semibold">Backfill leave balances</p>
          <p className="text-xs text-muted-foreground">
            Materializes every active employee&apos;s balances for a year. Safe to re-run — existing
            balances keep the days already taken. Normally unnecessary: balances are created on first
            use, so this is for a fresh org or a year rollover.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder={currentYear()}
            className="w-28"
            aria-label="Year to seed"
          />
          {confirmSeed ? (
            <>
              <Button size="sm" onClick={handleSeed} disabled={seeding}>
                {seeding ? "Seeding…" : `Yes, seed ${year.trim() || "…"}`}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmSeed(false)}
                disabled={seeding}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setConfirmSeed(true)}>
              Seed balances
            </Button>
          )}
        </div>
      </section>

      <LeaveTypesDialog
        open={typesOpen}
        onOpenChange={setTypesOpen}
        types={admin.types}
        loading={admin.loading}
        onSave={handleSave}
        onRestore={handleRestore}
      />
    </Card>
  );
}
