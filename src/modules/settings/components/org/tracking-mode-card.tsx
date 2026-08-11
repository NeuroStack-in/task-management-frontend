"use client";

import { useEffect, useState } from "react";
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
import { getOrg, updateOrg } from "../../services/org.service";
import { TrackingModeDialog } from "./tracking-mode-dialog";

/**
 * Settings → Organization → **how this org tracks work** (MANAGED-AGENT.md §4.3).
 *
 * A self-contained sub-manager (its own `getOrg`/`updateOrg` round-trip, like `DepartmentsManager`)
 * so it never joins the profile save bar — the mode change is a distinct, owner-only, confirmed
 * action, not a field on the profile form. Non-owners see it read-only.
 */
export function TrackingModeCard() {
  const isOwner = useAuthStore(isOwnerOf);
  const [mode, setMode] = useState<TrackingMode>("project");
  const [version, setVersion] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    getOrg()
      .then((o) => {
        if (!live) return;
        setMode(trackingModeOf(o.tracking_mode));
        setVersion(o.version);
      })
      .catch(() => {
        /* leave the default; the profile card surfaces a load error already */
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  async function apply(next: TrackingMode) {
    setSaving(true);
    try {
      const view = await updateOrg({ tracking_mode: next, version });
      setMode(trackingModeOf(view.tracking_mode));
      setVersion(view.version);
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
