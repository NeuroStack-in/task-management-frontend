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
 * Reads are open to members; saving needs `settings:manage`.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Info, RotateCcw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/shared/loader";
import { usePermissions } from "@/hooks/use-permissions";
import { ApiError } from "@/lib/api";
import { useRulesDoc } from "../../use-org-rules";
import { deptRulesPath } from "../../services/org.service";
import {
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
}: {
  deptId: string;
  canManage: boolean;
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
    Promise.allSettled([
      getDeptProductivityWeights(deptId),
      getOrgProductivityWeights(),
    ])
      .then(([deptRes, orgRes]) => {
        if (!live) return;
        const org =
          orgRes.status === "fulfilled" ? toPercents(orgRes.value) : DEFAULT_PERCENTS;
        setOrgPercents(org);
        if (deptRes.status === "fulfilled") {
          setPercents(toPercents(deptRes.value));
          setOverridden(true);
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
        toast.error(e instanceof ApiError ? e.message : "Couldn't save the weights. Try again.");
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
        <p className="text-sm text-muted-foreground">{error ?? "Weights are unavailable."}</p>
        <Button variant="outline" size="sm" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          {overridden
            ? "This department overrides the organization default weights."
            : "Uses organization defaults until overridden. Set weights below to override them for this department."}
        </span>
      </div>
      <WeightsForm
        values={percents}
        canManage={canManage}
        busy={saving}
        submitLabel="Save department weights"
        onSubmit={save}
        footerLeft={
          canManage ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={saving}
              onClick={() => setPercents({ ...orgPercents })}
            >
              <RotateCcw className="size-3.5" /> Reset to org defaults
            </Button>
          ) : null
        }
      />
    </div>
  );
}

/** The rules half — the org rules editor pointed at this department's rules path. */
function DeptRulesSection({
  deptId,
  canManage,
}: {
  deptId: string;
  canManage: boolean;
}) {
  const rules = useRulesDoc(deptRulesPath(deptId));
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>
          These classification rules <span className="font-medium text-foreground">override</span>{" "}
          the organization rules for this department. Where this department has no rule, the
          organization rules apply as the fallback.
        </span>
      </div>
      <RulesEditor
        rules={rules}
        canManage={canManage}
        savedMessage="Department rules saved"
        emptyLabel="Loading department rules…"
      />
    </div>
  );
}

export function DeptProductivitySheet({
  department,
  open,
  onOpenChange,
}: {
  department: ApiDepartment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { can } = usePermissions();
  const canManage = can("settings:manage");
  const [tab, setTab] = useState<"weights" | "rules">("weights");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 sm:max-w-2xl"
      >
        <SheetHeader className="border-b">
          <SheetTitle>Productivity · {department.name}</SheetTitle>
          <SheetDescription>
            Score weights and classification rules for the {department.name} department. Anything not
            set here inherits the organization defaults.
          </SheetDescription>
        </SheetHeader>

        <div className="flex gap-1 border-b px-4">
          {(["weights", "rules"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={
                "shrink-0 cursor-pointer rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors " +
                (tab === k
                  ? "-mb-px border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {k === "weights" ? "Score weights" : "Classification rules"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === "weights" ? (
            <DeptWeightsSection deptId={department.id} canManage={canManage} />
          ) : (
            <DeptRulesSection deptId={department.id} canManage={canManage} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
