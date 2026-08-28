"use client";

/**
 * The app/URL classification editor, extracted so both the **org** tracking-rules page and the
 * **per-department** override sheet render the exact same UI. It owns the working draft, dirty
 * tracking, tabbed panels (categories / apps & websites / restricted lists) and the save bar, and is
 * driven by whatever `OrgRulesState` it's handed — org-scoped (`useOrgRules`) or department-scoped
 * (`useRulesDoc(deptRulesPath(id))`).
 *
 * `showUnclassified` gates the org-only "apps the agents reported that no rule matches" panel — that
 * data is org-wide, so it's off for the department scope.
 */
import { useEffect, useMemo, useState } from "react";
import { Globe, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SettingsSaveBar } from "@/components/shared/settings-save-bar";
import { Loader } from "@/components/shared/loader";
import { ApiError } from "@/lib/api";
import { isDomain } from "@/lib/validation";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { cn } from "@/lib/utils";
import { UnclassifiedAppsPanel } from "./unclassified-apps-panel";
import type {
  OrgRulesState,
  RulesDoc,
  RuleCategory,
  AppRule,
  UrlRule,
} from "../../use-org-rules";

/**
 * Add/overwrite one app rule, returning a new list. **Upsert, never append** — the unclassified
 * panel's list is a snapshot, so a rule may already exist by the time it's applied; appending blind
 * produced duplicate React keys and unreachable rules (matching is first-match-wins). Process names
 * are lowercased to match `addApp`. Folding several through this in turn is how "accept all" applies
 * a batch in one write.
 */
function upsertRule(
  apps: AppRule[],
  app: string,
  category: RuleCategory,
): AppRule[] {
  const proc = app.trim().toLowerCase();
  const at = apps.findIndex((a) => a.process_name.trim().toLowerCase() === proc);
  return at >= 0
    ? apps.map((a, i) => (i === at ? { ...a, category } : a))
    : [...apps, { display_name: app, process_name: proc, category, tracked: true }];
}

const CATEGORIES: RuleCategory[] = ["productive", "neutral", "distracting"];
const CATEGORY_LABEL: Record<RuleCategory, string> = {
  productive: "Productive",
  neutral: "Neutral",
  distracting: "Distracting",
};
const CATEGORY_COLOR: Record<RuleCategory, string> = {
  productive: "var(--positive)",
  neutral: "var(--muted-foreground)",
  distracting: "var(--negative)",
};
const CATEGORY_DESC: Record<RuleCategory, string> = {
  productive: "Work tools — editors, docs, design, task management.",
  neutral: "General browsers, communication, calendars, utilities.",
  distracting: "Social media, streaming, gaming, entertainment.",
};

function CategoryDot({ category }: { category: RuleCategory }) {
  return (
    <span
      className="inline-block size-2.5 shrink-0 rounded-full"
      style={{ background: CATEGORY_COLOR[category] }}
    />
  );
}

function CategorySelect({
  value,
  onChange,
  disabled,
}: {
  value: RuleCategory;
  onChange: (v: RuleCategory) => void;
  disabled?: boolean;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as RuleCategory)} disabled={disabled}>
      <SelectTrigger size="sm" className="w-36">
        <SelectValue>
          {(v) => (
            <span className="flex items-center gap-2">
              <CategoryDot category={v as RuleCategory} />
              {CATEGORY_LABEL[v as RuleCategory] ?? "Select"}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {CATEGORIES.map((k) => (
          <SelectItem key={k} value={k}>
            <span className="flex items-center gap-2">
              <CategoryDot category={k} />
              {CATEGORY_LABEL[k]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ── Categories / weights ── */

function CategoriesPanel({
  weights,
  onWeights,
  canManage,
}: {
  weights: Record<RuleCategory, number>;
  onWeights: (next: Record<RuleCategory, number>) => void;
  canManage: boolean;
}) {
  return (
    <div className="space-y-3" data-tour="settings:weights">
      {CATEGORIES.map((cat) => (
        <div
          key={cat}
          className="flex items-stretch overflow-hidden rounded-lg border border-border bg-card"
        >
          <span className="w-1.5 shrink-0" style={{ backgroundColor: CATEGORY_COLOR[cat] }} />
          <div className="flex flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 sm:w-32 sm:shrink-0">
              <CategoryDot category={cat} />
              <p className="text-sm font-medium">{CATEGORY_LABEL[cat]}</p>
            </div>
            <p className="flex-1 text-xs text-muted-foreground">{CATEGORY_DESC[cat]}</p>
            <div className="flex shrink-0 items-center gap-2 sm:justify-end">
              <span className="text-xs text-muted-foreground">Score weight</span>
              <Input
                type="number"
                min={0}
                max={5}
                step={0.5}
                value={weights[cat]}
                disabled={!canManage}
                onChange={(e) =>
                  onWeights({ ...weights, [cat]: Math.max(0, Number(e.target.value) || 0) })
                }
                className="w-20"
              />
            </div>
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        The productivity score weights each category&apos;s tracked minutes. A higher weight
        strengthens that category&apos;s effect; distracting time typically weighs 0.
      </p>
    </div>
  );
}

/* ── Apps & websites classification ── */

function AppsPanel({
  apps,
  urls,
  onApps,
  onUrls,
  canManage,
  showUnclassified,
}: {
  apps: AppRule[];
  urls: UrlRule[];
  onApps: (next: AppRule[]) => void;
  onUrls: (next: UrlRule[]) => void;
  canManage: boolean;
  showUnclassified: boolean;
}) {
  const [query, setQuery] = useState("");
  const [appName, setAppName] = useState("");
  const [appProc, setAppProc] = useState("");
  const [urlDomain, setUrlDomain] = useState("");
  const q = query.trim().toLowerCase();

  const addApp = () => {
    const name = appName.trim();
    const proc = appProc.trim().toLowerCase();
    if (!name || !proc) {
      toast.error("Enter a display name and a process name (e.g. Slack, slack.exe).");
      return;
    }
    if (apps.some((a) => a.process_name === proc)) {
      toast.error(`“${proc}” is already listed.`);
      return;
    }
    onApps([...apps, { display_name: name, process_name: proc, category: "neutral", tracked: true }]);
    setAppName("");
    setAppProc("");
  };

  const addUrl = () => {
    const d = urlDomain.trim().toLowerCase();
    if (!isDomain(d)) {
      toast.error("Enter a valid domain, e.g. figma.com");
      return;
    }
    if (urls.some((u) => u.domain === d)) {
      toast.error(`“${d}” is already listed.`);
      return;
    }
    onUrls([...urls, { domain: d, category: "neutral", tracked: true }]);
    setUrlDomain("");
  };

  const shownApps = apps.filter(
    (a) => a.display_name.toLowerCase().includes(q) || a.process_name.includes(q),
  );
  const shownUrls = urls.filter((u) => u.domain.includes(q));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apps &amp; Websites</CardTitle>
        <CardDescription>
          Classify each application (by process name) and website (by domain), and choose whether the
          agent tracks it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="relative sm:w-72">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search apps or domains…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Org-scoped: apps the agents reported that no rule matches. Off for the department scope,
            where this org-wide gap panel doesn't apply. */}
        {showUnclassified ? (
          <UnclassifiedAppsPanel
            canManage={canManage}
            onAdd={(app, category) => onApps(upsertRule(apps, app, category))}
            onAddMany={(rules) => {
              // Fold the whole batch into ONE new array before a single `onApps`. Calling `onAdd`
              // per rule would each read this same render's `apps` snapshot and clobber the previous,
              // keeping only the last — so "accept all" would add exactly one rule.
              const next = rules.reduce(
                (acc, r) => upsertRule(acc, r.app, r.category),
                apps,
              );
              onApps(next);
            }}
          />
        ) : null}

        {/* Apps */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Applications</p>
          {canManage && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input placeholder="Display name (Slack)" value={appName} onChange={(e) => setAppName(e.target.value)} />
              <Input placeholder="Process (slack.exe)" value={appProc} onChange={(e) => setAppProc(e.target.value)} />
              <Button size="sm" variant="outline" onClick={addApp} className="shrink-0">
                <Plus className="size-4" /> Add app
              </Button>
            </div>
          )}
          <RuleTable
            rows={shownApps.map((a) => ({ key: a.process_name, label: a.display_name, sub: a.process_name, category: a.category, tracked: a.tracked }))}
            empty={apps.length === 0 ? "No app rules yet." : "No matches."}
            canManage={canManage}
            onCategory={(key, c) => onApps(apps.map((a) => (a.process_name === key ? { ...a, category: c } : a)))}
            onTracked={(key) => onApps(apps.map((a) => (a.process_name === key ? { ...a, tracked: !a.tracked } : a)))}
            onRemove={(key) => onApps(apps.filter((a) => a.process_name !== key))}
          />
        </div>

        {/* Websites */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Websites</p>
          {canManage && (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="domain.com"
                  value={urlDomain}
                  onChange={(e) => setUrlDomain(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addUrl()}
                  className="pl-9"
                />
              </div>
              <Button size="sm" variant="outline" onClick={addUrl} className="shrink-0">
                <Plus className="size-4" /> Add site
              </Button>
            </div>
          )}
          <RuleTable
            rows={shownUrls.map((u) => ({ key: u.domain, label: u.domain, sub: null, category: u.category, tracked: u.tracked }))}
            empty={urls.length === 0 ? "No website rules yet." : "No matches."}
            canManage={canManage}
            onCategory={(key, c) => onUrls(urls.map((u) => (u.domain === key ? { ...u, category: c } : u)))}
            onTracked={(key) => onUrls(urls.map((u) => (u.domain === key ? { ...u, tracked: !u.tracked } : u)))}
            onRemove={(key) => onUrls(urls.filter((u) => u.domain !== key))}
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface RuleRow {
  key: string;
  label: string;
  sub: string | null;
  category: RuleCategory;
  tracked: boolean;
}

function RuleTable({
  rows,
  empty,
  canManage,
  onCategory,
  onTracked,
  onRemove,
}: {
  rows: RuleRow[];
  empty: string;
  canManage: boolean;
  onCategory: (key: string, c: RuleCategory) => void;
  onTracked: (key: string) => void;
  onRemove: (key: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full caption-bottom text-sm">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Tracked</TableHead>
            {canManage && <TableHead className="w-10" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={canManage ? 4 : 3} className="py-8 text-center text-sm text-muted-foreground">
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            // The React key carries the index as well as the logical id — a stored document *can*
            // hold two rules for one process/domain, and keying on `r.key` alone dropped a row.
            // `r.key` stays the id the handlers match on (first-match-wins makes only one reachable).
            rows.map((r, i) => (
              <TableRow key={`${r.key}#${i}`} className={cn(!r.tracked && "opacity-60")}>
                <TableCell>
                  <p className="font-medium">{r.label}</p>
                  {r.sub ? <p className="font-mono text-xs text-muted-foreground">{r.sub}</p> : null}
                </TableCell>
                <TableCell>
                  <CategorySelect value={r.category} onChange={(c) => onCategory(r.key, c)} disabled={!canManage} />
                </TableCell>
                <TableCell className="text-right">
                  <Switch size="sm" checked={r.tracked} disabled={!canManage} onCheckedChange={() => onTracked(r.key)} />
                </TableCell>
                {canManage && (
                  <TableCell className="text-right">
                    <Button size="icon-sm" variant="ghost" aria-label={`Remove ${r.label}`} onClick={() => onRemove(r.key)}>
                      <X className="size-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </table>
    </div>
  );
}

/* ── Allow / block lists ── */

function ChipInput({
  title,
  description,
  accent,
  placeholder,
  validate,
  items,
  onChange,
  canManage,
}: {
  title: string;
  description: string;
  accent: "positive" | "negative";
  placeholder: string;
  validate: (v: string) => boolean;
  items: string[];
  onChange: (next: string[]) => void;
  canManage: boolean;
}) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim().toLowerCase();
    if (!v) return;
    if (!validate(v)) {
      toast.error(`“${v}” doesn't look valid.`);
      return;
    }
    if (!items.includes(v)) onChange([...items, v]);
    setInput("");
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className={cn("size-2 rounded-full", accent === "positive" ? "bg-positive" : "bg-negative")} />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage && (
          <div className="flex gap-2">
            <Input
              placeholder={placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              className="text-sm"
            />
            <Button size="sm" variant="outline" onClick={add}>
              <Plus className="size-4" />
            </Button>
          </div>
        )}
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">No entries yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {items.map((item) => (
              <div key={item} className="flex items-center gap-1.5 rounded-sm border border-border bg-muted px-2.5 py-1 text-xs">
                {item}
                {canManage && (
                  <button
                    onClick={() => onChange(items.filter((i) => i !== item))}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    aria-label={`Remove ${item}`}
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function looksLikeProcess(v: string) {
  return /^[a-z0-9 ._-]+$/i.test(v);
}

/* ── Root ── */

type TabKey = "categories" | "apps" | "lists";

export function RulesEditor({
  rules,
  canManage,
  showUnclassified = false,
  savedMessage = "Tracking rules saved",
  emptyLabel = "Loading tracking rules…",
}: {
  rules: OrgRulesState;
  canManage: boolean;
  /** Show the org-only "unclassified apps" gap panel. Off for department scope. */
  showUnclassified?: boolean;
  /** Toast shown on a successful save. */
  savedMessage?: string;
  /** Loader label while the doc first loads. */
  emptyLabel?: string;
}) {
  const { doc, loading, error, reload, save } = rules;

  const [draft, setDraft] = useState<RulesDoc | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("categories");

  // Seed the working draft whenever the server doc (re)loads.
  useEffect(() => {
    if (doc) setDraft(structuredClone(doc));
  }, [doc]);

  const dirty = useMemo(
    () => Boolean(doc && draft && JSON.stringify(doc) !== JSON.stringify(draft)),
    [doc, draft],
  );
  useUnsavedGuard(dirty);

  function patch<K extends keyof RulesDoc>(key: K, value: RulesDoc[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  async function handleSave() {
    if (!draft || !dirty || saving) return;
    setSaving(true);
    try {
      await save(draft);
      toast.success(savedMessage);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.error("Rules changed elsewhere — reloaded the latest. Re-apply your edits.");
        reload();
      } else {
        toast.error(e instanceof ApiError ? e.message : "Couldn't save the rules. Try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading && !draft) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader label={emptyLabel} />
      </div>
    );
  }

  if (error || !draft) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
        <p className="text-sm text-muted-foreground">{error ?? "Rules are unavailable."}</p>
        <Button variant="outline" size="sm" onClick={reload}>
          Retry
        </Button>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "categories", label: "Categories" },
    { key: "apps", label: "Apps & Websites", count: draft.apps.length + draft.urls.length },
    {
      key: "lists",
      label: "Restricted sites",
      count:
        draft.exceptions.apps.length +
        draft.exceptions.urls.length +
        draft.blocked.apps.length +
        draft.blocked.urls.length,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-1 overflow-x-auto overflow-y-hidden border-b">
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors",
                active ? "-mb-px border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                    active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === "categories" && (
        <CategoriesPanel
          weights={draft.category_weights}
          onWeights={(v) => patch("category_weights", v)}
          canManage={canManage}
        />
      )}
      {activeTab === "apps" && (
        <AppsPanel
          apps={draft.apps}
          urls={draft.urls}
          onApps={(v) => patch("apps", v)}
          onUrls={(v) => patch("urls", v)}
          canManage={canManage}
          showUnclassified={showUnclassified}
        />
      )}
      {activeTab === "lists" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <ChipInput
            title="Allow list (apps)"
            description="Exempt from blocking and always allowed. Process names, e.g. zoom.exe."
            accent="positive"
            placeholder="process.exe"
            validate={looksLikeProcess}
            items={draft.exceptions.apps}
            onChange={(v) => patch("exceptions", { ...draft.exceptions, apps: v })}
            canManage={canManage}
          />
          <ChipInput
            title="Allow list (sites)"
            description="Exempt from blocking, never rated distracting. Domains."
            accent="positive"
            placeholder="domain.com"
            validate={isDomain}
            items={draft.exceptions.urls}
            onChange={(v) => patch("exceptions", { ...draft.exceptions, urls: v })}
            canManage={canManage}
          />
          <ChipInput
            title="Restricted apps"
            description="Using these during a running timer warns the employee on-screen and flags the session for review. Process names."
            accent="negative"
            placeholder="process.exe"
            validate={looksLikeProcess}
            items={draft.blocked.apps}
            onChange={(v) => patch("blocked", { ...draft.blocked, apps: v })}
            canManage={canManage}
          />
          <ChipInput
            title="Restricted sites"
            description="Visiting these during a running timer warns the employee on-screen and flags the session for review. Domains."
            accent="negative"
            placeholder="domain.com"
            validate={isDomain}
            items={draft.blocked.urls}
            onChange={(v) => patch("blocked", { ...draft.blocked, urls: v })}
            canManage={canManage}
          />
        </div>
      )}

      {canManage && (
        <SettingsSaveBar
          dirty={dirty}
          saving={saving}
          onSave={handleSave}
          onReset={() => doc && setDraft(structuredClone(doc))}
        />
      )}
    </div>
  );
}
