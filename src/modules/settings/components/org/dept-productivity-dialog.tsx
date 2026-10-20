"use client";

/**
 * Per-department productivity configuration, opened from the Departments manager — one department at
 * a time. Two things, both scoped to this department:
 *
 *   1. **Score weights** (`/v1/org/departments/{id}/productivity-weights`) — U/Q/F/R, edited as
 *      percentages summing to 100. A department with none set inherits the org defaults; a 404 on
 *      GET is exactly that state, and the form is seeded from the org defaults with an
 *      "uses organization defaults" banner until the admin saves an override.
 *   2. **Classification rules** (`/v1/org/departments/{id}/rules`) — the same app/URL editor the org
 *      uses ({@link RulesEditor}), which **override** the org rules for this department's members.
 *
 * Two different gates, mirroring the server: the weights read is open to members and saving them
 * needs `settings:manage` (`OrgSettingsManage`); the rules need `monitoring:manage`
 * (`MonitoringManage`) to read *and* to save (WP-346).
 */
import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Info, Lock, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/shared/loader";
import { usePermissions } from "@/hooks/use-permissions";
import { ApiError } from "@/lib/api";
import { useRulesDoc } from "../../use-org-rules";
import { deptRulesPath } from "../../services/org.service";
import {
  deleteDeptProductivityWeights,
  getDeptProductivityWeights,
  getOrgProductivityWeights,
  updateDeptProductivityWeights,
  type ProductivityWeights,
} from "../../services/productivity.service";
import {
  GLOBAL_DEFAULT_WEIGHTS,
  toPercents,
  type PercentWeights,
} from "../../lib/productivity-weights";
import type { ApiDepartment } from "@/modules/employees/services/employees.service";
import { WeightsForm } from "./weights-form";
import { RulesEditor } from "./rules-editor";

const DEFAULT_PERCENTS = toPercents(GLOBAL_DEFAULT_WEIGHTS);

/** The weights half — its own load/save cycle, independent of the rules editor below. */
function DeptWeightsSection({
  deptId,
  canManage,
  onDirtyChange,
}: {
  deptId: string;
  canManage: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  // The org defaults this department falls back to (themselves defaulting to the product defaults).
  const [orgPercents, setOrgPercents] = useState<PercentWeights>(DEFAULT_PERCENTS);
  const [percents, setPercents] = useState<PercentWeights | null>(null);
  const [overridden, setOverridden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    let live = true;
    setLoading(true);
    setError(null);
    // Both scopes together: the department's own weights, and the org defaults it inherits.
    Promise.allSettled([getDeptProductivityWeights(deptId), getOrgProductivityWeights()])
      .then(([deptRes, orgRes]) => {
        if (!live) return;
        const org =
          orgRes.status === "fulfilled" ? toPercents(orgRes.value) : DEFAULT_PERCENTS;
        setOrgPercents(org);
        if (deptRes.status === "fulfilled" && deptRes.value.configured) {
          setPercents(toPercents(deptRes.value));
          setOverridden(true);
        } else if (deptRes.status === "fulfilled") {
          // Nothing stored for this department ⇒ it is scored on the org's defaults, not on the
          // product defaults the server echoes back (WP-100).
          setPercents(org);
          setOverridden(false);
        } else if (deptRes.reason instanceof ApiError && deptRes.reason.status === 404) {
          // Nothing set for this department ⇒ it inherits the org defaults.
          setPercents(org);
          setOverridden(false);
        } else {
          setError(
            deptRes.reason instanceof ApiError
              ? deptRes.reason.message
              : "Couldn't load this department's weights.",
          );
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [deptId]);
  useEffect(() => load(), [load]);

  /** Drop the override: the department follows the organization defaults again (WP-341). */
  async function inherit() {
    setSaving(true);
    try {
      await deleteDeptProductivityWeights(deptId);
      setPercents(orgPercents);
      setOverridden(false);
      toast.success("This department now follows the organization defaults");
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        toast.error("You don't have permission to change productivity weights.");
      } else {
        toast.error(
          e instanceof ApiError ? e.message : "Couldn't reset the weights. Try again.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  async function save(fractions: ProductivityWeights) {
    setSaving(true);
    try {
      const saved = await updateDeptProductivityWeights(deptId, fractions);
      setPercents(toPercents(saved));
      setOverridden(true);
      toast.success("Department weights saved");
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        toast.error("You don't have permission to change productivity weights.");
      } else {
        toast.error(
          e instanceof ApiError ? e.message : "Couldn't save the weights. Try again.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[8rem] items-center justify-center">
        <Loader label="Loading weights…" />
      </div>
    );
  }
  if (error || !percents) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-muted-foreground text-sm">
          {error ?? "Weights are unavailable."}
        </p>
        <Button variant="outline" size="sm" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="border-border bg-muted/50 text-muted-foreground flex items-start gap-2 rounded-md border px-3 py-2 text-xs">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          {overridden
            ? "This department has its own weights, so it doesn't follow changes to the organization defaults."
            : "Uses organization defaults until overridden. Set weights below to override them for this department."}
        </span>
      </div>
      {overridden && canManage ? (
        // Removes the override rather than copying the org's numbers in — a copy would still stay
        // apart from later changes to the organization defaults (WP-341).
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void inherit()}
            disabled={saving}
          >
            Follow organization defaults
          </Button>
        </div>
      ) : null}
      <WeightsForm
        values={percents}
        canManage={canManage}
        busy={saving}
        submitLabel="Save department weights"
        onSubmit={save}
        onDirtyChange={onDirtyChange}
        // Fills in the organization's numbers as an edit; Save stores them for this department.
        resetTo={
          overridden
            ? { values: orgPercents, label: "Copy organization defaults" }
            : undefined
        }
      />
    </div>
  );
}

/**
 * The rules half — the org rules editor pointed at this department's rules path. Mounted only with
 * `monitoring:manage`, which the server requires to read these rules as well as to save them.
 */
function DeptRulesSection({
  deptId,
  onDirtyChange,
}: {
  deptId: string;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const rules = useRulesDoc(deptRulesPath(deptId));
  return (
    <div className="space-y-3">
      <div className="border-border bg-muted/50 text-muted-foreground flex items-start gap-2 rounded-md border px-3 py-2 text-xs">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          These classification rules{" "}
          <span className="text-foreground font-medium">override</span> the organization
          rules for this department. Where this department has no rule, the organization
          rules apply as the fallback. Category score weights are organization-wide — set
          them in{" "}
          {/* A real link (UX audit SET-15). This section only mounts with `monitoring:manage`,
              which is what the Tracking rules page needs. Leaving with edits here still asks. */}
          <Link
            href="/settings/tracking-rules"
            className="text-primary font-medium underline-offset-2 hover:underline"
          >
            Tracking rules
          </Link>
          .
        </span>
      </div>
      <RulesEditor
        rules={rules}
        canManage
        showCategories={false}
        savedMessage="Department rules saved"
        emptyLabel="Loading department rules…"
        onDirtyChange={onDirtyChange}
      />
    </div>
  );
}

type DialogTab = "weights" | "rules";

export function DeptProductivityDialog({
  department,
  open,
  onOpenChange,
}: {
  department: ApiDepartment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { can } = usePermissions();
  const canManageWeights = can("settings:manage");
  const canManageRules = can("monitoring:manage");
  const tabIds = useId();
  const [tab, setTab] = useState<DialogTab>("weights");
  // Each section stays mounted once opened, hidden while the other tab shows: switching tab used to
  // unmount the other section and throw its draft away (QA audit 2026-10-08, WP-348). The rules
  // load only when their tab is first opened.
  const [rulesOpened, setRulesOpened] = useState(false);
  const [weightsDirty, setWeightsDirty] = useState(false);
  const [rulesDirty, setRulesDirty] = useState(false);
  /** Closing was asked for while something is unsaved — confirm before throwing it away. */
  const [confirmClose, setConfirmClose] = useState(false);
  const unsaved = weightsDirty || rulesDirty;

  const show = (k: DialogTab) => {
    setTab(k);
    if (k === "rules") setRulesOpened(true);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // X, Escape and an outside click all arrive here; none of them may discard edits silently.
        if (!next && unsaved) setConfirmClose(true);
        else onOpenChange(next);
      }}
    >
      {/* A centred modal rather than a side sheet: this is a focused, self-contained edit — pick a
          tab, change four numbers, save — not a companion panel you consult while working the list
          behind it. `p-0` so the header, tab rail and body own their own padding and the two
          borders can run edge to edge; the body is the only scroller, so the header and tabs stay
          put on a long rules list. */}
      <DialogContent className="flex max-h-[85vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-6 pt-6 pr-12 pb-4">
          <DialogTitle>Productivity · {department.name}</DialogTitle>
          <DialogDescription>
            Score weights and classification rules for the {department.name} department.
            Anything not set here inherits the organization defaults.
          </DialogDescription>
        </DialogHeader>

        {confirmClose && unsaved ? (
          <div
            role="alert"
            className="border-warning/40 bg-warning/10 flex flex-wrap items-center gap-3 border-b px-6 py-3 text-sm"
          >
            <TriangleAlert className="text-warning size-4 shrink-0" />
            <span className="min-w-0 flex-1">
              You have unsaved changes here. Closing now discards them.
            </span>
            <Button size="sm" variant="outline" onClick={() => setConfirmClose(false)}>
              Keep editing
            </Button>
            <Button size="sm" variant="destructive" onClick={() => onOpenChange(false)}>
              Discard and close
            </Button>
          </div>
        ) : null}

        <div
          role="tablist"
          aria-label="Productivity settings"
          className="flex shrink-0 gap-1 border-b px-4"
        >
          {(["weights", "rules"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              id={`${tabIds}-tab-${k}`}
              aria-selected={tab === k}
              aria-controls={`${tabIds}-panel-${k}`}
              onClick={() => show(k)}
              className={
                "shrink-0 cursor-pointer rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors " +
                (tab === k
                  ? "border-primary text-foreground -mb-px border-b-2"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {k === "weights" ? "Score weights" : "Classification rules"}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div
            role="tabpanel"
            id={`${tabIds}-panel-weights`}
            aria-labelledby={`${tabIds}-tab-weights`}
            hidden={tab !== "weights"}
          >
            <DeptWeightsSection
              deptId={department.id}
              canManage={canManageWeights}
              onDirtyChange={setWeightsDirty}
            />
          </div>
          <div
            role="tabpanel"
            id={`${tabIds}-panel-rules`}
            aria-labelledby={`${tabIds}-tab-rules`}
            hidden={tab !== "rules"}
          >
            {!rulesOpened ? null : canManageRules ? (
              <DeptRulesSection deptId={department.id} onDirtyChange={setRulesDirty} />
            ) : (
              <div className="border-border bg-muted text-muted-foreground flex items-center gap-2.5 rounded-md border px-4 py-3 text-sm">
                <Lock className="size-4 shrink-0" />
                Viewing and changing classification rules requires the{" "}
                <span className="text-foreground font-medium">
                  Manage monitoring settings
                </span>{" "}
                permission.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
