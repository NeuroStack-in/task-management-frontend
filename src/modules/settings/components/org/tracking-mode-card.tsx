"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth.store";
import { isOwnerOf } from "@/hooks/use-features";
import { ApiError } from "@/lib/api";
import {
  TRACKING_MODE_META,
  TRACKING_MODES,
  trackingModeOf,
  type TrackingMode,
} from "@/lib/tracking-mode";
import { MODE_HIDDEN_ROUTES } from "@/constants/features";
import { useOrgMetaStore } from "@/stores/org-meta.store";
import { updateOrg } from "../../services/org.service";
import { TrackingModeDialog } from "./tracking-mode-dialog";

/**
 * Settings → Organization → **how this org tracks work** (MANAGED-AGENT.md §4.3).
 *
 * The org meta + optimistic-lock `version` come from the SHARED store (`useOrgMetaStore`), the same
 * one the profile card reads — so a profile save and a mode change never hold divergent versions and
 * a single user editing both never hits a spurious 409. The mode change is still a distinct,
 * owner-only, confirmed action, not a field on the profile form. Non-owners see it read-only.
 */
export function TrackingModeCard() {
  const isOwner = useAuthStore(isOwnerOf);
  const { view, version, status, load, applyPatchResult } = useOrgMetaStore();
  const loading = status === "idle" || status === "loading";
  const [mode, setMode] = useState<TrackingMode>("project");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // One shared fetch (deduped in the store).
  useEffect(() => {
    void load();
  }, [load]);

  // Seed the local mode from the shared meta **once** — later `view` writes (e.g. a profile save
  // bumping the version) must not clobber a mode the owner is midway through changing.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || status !== "ready") return;
    setMode(trackingModeOf(view?.tracking_mode));
    seeded.current = true;
  }, [status, view]);

  async function apply(next: TrackingMode) {
    setSaving(true);
    try {
      const updated = await updateOrg({ tracking_mode: next, version });
      // Thread the fresh version back into the shared store so the profile card's next save uses it.
      applyPatchResult(updated);
      setMode(trackingModeOf(updated.tracking_mode));
      setDialogOpen(false);
      toast.success("Tracking mode updated", {
        description: `This organization now uses ${TRACKING_MODE_META[next].label}.`,
      });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.error("This changed elsewhere", {
          description: "Reload the page and try again.",
        });
      } else {
        toast.error("Couldn't update tracking mode", {
          description: e instanceof ApiError ? e.message : "Please try again.",
        });
      }
    } finally {
      setSaving(false);
    }
  }

  const meta = TRACKING_MODE_META[mode];

  return (
    <Card>
      <CardHeader>
        <CardTitle>How this organization tracks work</CardTitle>
        <CardDescription>
          Which agent your team uses, and which surfaces this workspace shows.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{meta.label}</Badge>
          {loading && (
            <span className="text-xs text-muted-foreground">Loading…</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{meta.blurb}</p>

        {isOwner ? (
          <div className="flex items-center gap-3 pt-1">
            <Button
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={() => setDialogOpen(true)}
            >
              Change
            </Button>
            <span className="text-xs text-muted-foreground">
              Recorded in your audit log. Nothing you&apos;ve recorded is
              deleted.
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Only the organization owner can change how this organization tracks
            work.
          </p>
        )}
      </CardContent>

      {isOwner && (
        <TrackingModeDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          current={mode}
          modes={TRACKING_MODES}
          hiddenRoutes={MODE_HIDDEN_ROUTES}
          saving={saving}
          onConfirm={apply}
        />
      )}
    </Card>
  );
}
