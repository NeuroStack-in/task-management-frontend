"use client";

/**
 * "Apps seen but not classified" — the worklist behind the rules editor
 * (`backend/docs/PRODUCTIVITY.md` §5).
 *
 * **Why this exists:** Q — the heaviest term in the productivity score — is a share of *classified*
 * time, and an app no rule matches falls to `Neutral`. So a team living in a tool nobody wrote a
 * rule for has its quality measured against an assumption, silently. A hand-maintained rule list
 * cannot keep up with every org's bespoke software, and until the app catalogue landed there was no
 * way to even see the gap.
 *
 * **Adding a rule here is a normal edit.** The row becomes an entry in the same `apps` list the
 * table below manages, saved through the same `PATCH /v1/org/rules`. There is no separate
 * "suggestion" storage and no auto-apply: the model proposes, a human decides, and the stored
 * artifact is the rule — which is what keeps every score reproducible (`docs/AI.md` §1).
 */
import { useCallback, useEffect, useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader } from "@/components/shared/loader";
import { ApiError } from "@/lib/api";
import {
  getUnclassifiedApps,
  type RuleCategoryName,
  type UnclassifiedApp,
} from "@/modules/insights/services/insights.service";

const CATEGORIES: RuleCategoryName[] = ["productive", "neutral", "distracting"];

const CATEGORY_STYLE: Record<RuleCategoryName, string> = {
  productive: "bg-success/12 text-success",
  neutral: "bg-muted text-muted-foreground",
  distracting: "bg-destructive/12 text-destructive",
};

const fmtHours = (sec: number) => {
  const h = sec / 3600;
  if (h >= 10) return `${Math.round(h)}h`;
  if (h >= 1) return `${h.toFixed(1)}h`;
  return `${Math.max(1, Math.round(sec / 60))}m`;
};

export function UnclassifiedAppsPanel({
  canManage,
  onAdd,
}: {
  canManage: boolean;
  /** Append a rule to the draft the editor is holding. The parent owns saving. */
  onAdd: (app: string, category: RuleCategoryName) => void;
}) {
  const [apps, setApps] = useState<UnclassifiedApp[]>([]);
  const [totalSeen, setTotalSeen] = useState(0);
  const [noRules, setNoRules] = useState(false);
  const [loading, setLoading] = useState(true);
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Rows already added in this session — kept out of the list without a refetch. */
  const [done, setDone] = useState<Set<string>>(new Set());

  const load = useCallback((suggest: boolean) => {
    let live = true;
    if (suggest) setSuggesting(true);
    else setLoading(true);
    setError(null);
    getUnclassifiedApps(suggest)
      .then((r) => {
        if (!live) return;
        setApps(r.apps);
        setTotalSeen(r.total_seen);
        setNoRules(r.no_rules_configured);
      })
      .catch((e) => {
        if (!live) return;
        // A 403 is ordinary here — the panel needs a higher permission than viewing the tab.
        setError(
          e instanceof ApiError && e.status === 403
            ? null
            : "Couldn't load unclassified apps.",
        );
      })
      .finally(() => {
        if (!live) return;
        setLoading(false);
        setSuggesting(false);
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => load(false), [load]);

  const visible = apps.filter((a) => !done.has(a.app));

  function add(a: UnclassifiedApp, category: RuleCategoryName) {
    onAdd(a.app, category);
    setDone((cur) => new Set(cur).add(a.app));
  }

  if (loading) {
    return (
      <div className="flex min-h-[5rem] items-center justify-center rounded-xl border">
        <Loader label="Checking for unclassified apps…" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-muted-foreground rounded-xl border p-4 text-sm">{error}</div>
    );
  }
  // Nothing to do is the good state — say so quietly rather than rendering an empty frame.
  if (visible.length === 0) {
    return (
      <div className="text-muted-foreground rounded-xl border p-4 text-sm">
        {totalSeen === 0
          ? "No app activity reported yet — once agents report, anything without a rule shows up here."
          : `Every app the agents have reported (${totalSeen}) matches a rule.`}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h4 className="text-sm font-medium">Seen but not classified</h4>
          <p className="text-muted-foreground text-xs">
            {noRules ? (
              <>
                This organization has no rules yet, so <strong>everything</strong> is
                unclassified — all of this time currently counts as neutral.
              </>
            ) : (
              <>
                {visible.length} of {totalSeen} reported apps match no rule, so their time
                counts as neutral in the productivity score. Most-used first.
              </>
            )}
          </p>
        </div>
        {canManage ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => load(true)}
            disabled={suggesting}
          >
            <Sparkles className="size-3.5" />
            {suggesting ? "Asking…" : "Suggest categories"}
          </Button>
        ) : null}
      </div>

      <ul className="divide-border divide-y">
        {visible.map((a) => (
          <li key={a.app} className="flex flex-wrap items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{a.app}</p>
              <p className="text-muted-foreground text-xs">
                {fmtHours(a.total_sec)} observed
                {a.suggested_reason ? ` · ${a.suggested_reason}` : ""}
              </p>
            </div>

            {a.suggested_category ? (
              <Badge className={CATEGORY_STYLE[a.suggested_category]}>
                <Sparkles className="mr-1 size-3" />
                {a.suggested_category}
              </Badge>
            ) : null}

            {canManage ? (
              <div className="flex gap-1">
                {CATEGORIES.map((c) => (
                  <Button
                    key={c}
                    size="sm"
                    // The suggestion is pre-selected visually, never pre-applied — the admin still
                    // clicks, so an approval is always a human act.
                    variant={a.suggested_category === c ? "default" : "outline"}
                    onClick={() => add(a, c)}
                    aria-label={`Classify ${a.app} as ${c}`}
                  >
                    {c}
                  </Button>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <RefreshCw className="size-3" />
        Added rules apply on save, and affect scores from the next recompute.
      </p>
    </div>
  );
}
