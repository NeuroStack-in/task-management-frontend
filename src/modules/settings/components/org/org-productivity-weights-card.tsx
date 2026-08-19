"use client";

/**
 * Org-wide **default** productivity score weights — `GET`/`PUT /v1/org/productivity-weights`.
 *
 * These are the weights every department inherits until it sets its own (per-department overrides
 * live in the Departments manager's "Productivity" sheet). A 404 on GET means the org has never set
 * them, so the card falls back to the product defaults (`GLOBAL_DEFAULT_WEIGHTS`) and says so.
 *
 * List/read is open to members; saving needs `settings:manage` (server `OrgSettingsManage`).
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/shared/loader";
import { usePermissions } from "@/hooks/use-permissions";
import { ApiError } from "@/lib/api";
import {
  getOrgProductivityWeights,
  updateOrgProductivityWeights,
  type ProductivityWeights,
} from "../../services/productivity.service";
import {
  GLOBAL_DEFAULT_WEIGHTS,
  toPercents,
  type PercentWeights,
} from "../../lib/productivity-weights";
import { WeightsForm } from "./weights-form";

const DEFAULT_PERCENTS = toPercents(GLOBAL_DEFAULT_WEIGHTS);

export function OrgProductivityWeightsCard() {
  const { can } = usePermissions();
  const canManage = can("settings:manage");

  const [percents, setPercents] = useState<PercentWeights | null>(null);
  const [usingDefaults, setUsingDefaults] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    let live = true;
    setLoading(true);
    setError(null);
    getOrgProductivityWeights()
      .then((w) => {
        if (!live) return;
        setPercents(toPercents(w));
        setUsingDefaults(false);
      })
      .catch((e) => {
        if (!live) return;
        // Never set ⇒ fall back to the product defaults rather than erroring.
        if (e instanceof ApiError && e.status === 404) {
          setPercents(DEFAULT_PERCENTS);
          setUsingDefaults(true);
        } else {
          setError(e instanceof ApiError ? e.message : "Couldn't load productivity weights.");
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => load(), [load]);

  async function save(fractions: ProductivityWeights) {
    setSaving(true);
    try {
      const saved = await updateOrgProductivityWeights(fractions);
      setPercents(toPercents(saved));
      setUsingDefaults(false);
      toast.success("Organization default weights saved");
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        toast.error("You don't have permission to change productivity weights.");
      } else {
        toast.error(e instanceof ApiError ? e.message : "Couldn't save the weights. Try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-feature-tint text-primary">
            <SlidersHorizontal className="size-4" />
          </span>
          <div className="space-y-1.5">
            <CardTitle>Productivity score weights</CardTitle>
            <CardDescription>
              How the four score terms blend into each person&apos;s 0–100 productivity score. These
              are the organization defaults; individual departments can override them.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex min-h-[8rem] items-center justify-center">
            <Loader label="Loading weights…" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>
              Retry
            </Button>
          </div>
        ) : percents ? (
          <>
            {usingDefaults ? (
              <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                No organization defaults set yet — showing the built-in defaults
                (Utilisation&nbsp;25% · Quality&nbsp;40% · Focus&nbsp;15% · Reliability&nbsp;20%).
                Save to make them your own.
              </p>
            ) : null}
            <WeightsForm
              values={percents}
              canManage={canManage}
              busy={saving}
              submitLabel="Save default weights"
              onSubmit={save}
              footerLeft={
                canManage ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={saving}
                    onClick={() => setPercents({ ...DEFAULT_PERCENTS })}
                  >
                    <RotateCcw className="size-3.5" /> Reset to defaults
                  </Button>
                ) : null
              }
            />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
