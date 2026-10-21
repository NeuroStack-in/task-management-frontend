"use client";

/**
 * Org-wide **default** productivity score weights — `GET`/`PUT /v1/org/productivity-weights`.
 *
 * These are the weights every department inherits until it sets its own (per-department overrides
 * live in the Departments manager's "Productivity" sheet). When the org has never set them the GET
 * answers with `configured: false` and the product defaults (`GLOBAL_DEFAULT_WEIGHTS`), and the card
 * says so.
 *
 * List/read is open to members; saving needs `settings:manage` (server `OrgSettingsManage`).
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Info, SlidersHorizontal } from "lucide-react";
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
  // Tracking rules is gated on `monitoring:manage` (read and write), so link there only for roles
  // the page will open for — anyone else gets its name.
  const canRules = can("monitoring:manage");

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
        // The server answers 200 even when nothing is stored — `configured` says which (WP-100).
        setUsingDefaults(!w.configured);
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
              How much each of the four parts counts towards each person&apos;s daily 0–100
              productivity score. These are the organization&apos;s defaults.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* How the two "weights" controls combine (UX audit 2026-10-16, SET-07). Admins met a
            percentage mix here and 0–1 category weights in Tracking rules with nothing saying
            which one moves the score. The truth, from the scorer (`score_compute`, resolve order in
            `insights::shared::org::productivity_weights`): these four percentages are the mix —
            a department's own mix wins, then these, then the built-in 25/40/15/20 — and the
            category weights only feed Quality, and only on a day the AI rated no screenshots. */}
        <div className="border-border bg-muted/40 text-muted-foreground flex items-start gap-2 rounded-md border px-3 py-2.5 text-xs">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <div className="space-y-1.5">
            <p>
              <span className="text-foreground font-medium">How the score is worked out.</span>{" "}
              Each day, the four parts below are each scored 0–100 and blended using these
              percentages.
            </p>
            <ul className="list-disc space-y-1 pl-4">
              <li>
                A department can have its own percentages, set from its{" "}
                <span className="text-foreground font-medium">Productivity</span> button under{" "}
                {/* A plain anchor: a hash on this same page switches the tab (the page follows
                    `hashchange`, which a router push doesn't fire). */}
                <a
                  href="#departments"
                  className="text-primary font-medium underline-offset-2 hover:underline"
                >
                  Departments
                </a>
                . A department without its own uses these.
              </li>
              <li>
                The productive / neutral / distracting weights in{" "}
                {canRules ? (
                  <Link
                    href="/settings/tracking-rules"
                    className="text-primary font-medium underline-offset-2 hover:underline"
                  >
                    Tracking rules
                  </Link>
                ) : (
                  <span className="text-foreground font-medium">Tracking rules</span>
                )}{" "}
                don&apos;t change this mix. They only decide the Quality part, and only on days the
                AI rated none of the person&apos;s screenshots.
              </li>
            </ul>
          </div>
        </div>
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
                (Utilization&nbsp;25% · Quality&nbsp;40% · Focus&nbsp;15% · Reliability&nbsp;20%).
                Save to make them your own.
              </p>
            ) : null}
            <WeightsForm
              values={percents}
              canManage={canManage}
              busy={saving}
              submitLabel="Save default weights"
              onSubmit={save}
              // Fills in the built-in weights as an edit; Save stores them (WP-341).
              resetTo={{ values: DEFAULT_PERCENTS, label: "Use built-in defaults" }}
            />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
