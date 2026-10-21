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
import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
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
import { Loader } from "@/components/shared/loader";
import { ApiError } from "@/lib/api";
import { isDomain } from "@/lib/validation";
import { usePermissions } from "@/hooks/use-permissions";
import { useCardGuard } from "../../lib/card-guard";
import { CardSaveFooter } from "../save-footer";
import { cn } from "@/lib/utils";
import { UnclassifiedAppsPanel } from "./unclassified-apps-panel";
import { insertRule, matchesAnyRule, shadowedBy, unshadow } from "../../lib/rule-order";
import type {
  OrgRulesState,
  RulesDoc,
  RuleCategory,
  AppRule,
  UrlRule,
} from "../../use-org-rules";

const appMatcher = (a: AppRule) => a.process_name;
const urlMatcher = (u: UrlRule) => u.domain;

/**
 * Add/overwrite one app rule, returning a new list. **Upsert, never append** — the unclassified
 * panel's list is a snapshot, so a rule may already exist by the time it's applied; appending blind
 * produced duplicate React keys and unreachable rules (matching is first-match-wins). A new rule
 * goes where it can match (`insertRule`). Process names are lowercased to match `addApp`. Folding
 * several through this in turn is how "accept all" applies a batch in one write.
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
    : insertRule(
        apps,
        { display_name: app, process_name: proc, category, tracked: true },
        appMatcher,
      );
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
  label = "Rule category",
}: {
  value: RuleCategory;
  onChange: (v: RuleCategory) => void;
  disabled?: boolean;
  /** Accessible name — per row, so a screen reader hears whose category this is. */
  label?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as RuleCategory)} disabled={disabled}>
      <SelectTrigger size="sm" className="w-36" aria-label={label}>
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
  // The four-part mix lives on the Organization page (`settings:view`); link there only for roles
  // that page opens for.
  const { can } = usePermissions();
  const canOrg = can("settings:view");
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
              {/* 0–1, the range the scorer applies: it clamps every weight into it, so the old
                  0–5 range let "productive 2, neutral 1.5" save and then score neutral time
                  exactly like productive time (QA audit 2026-10-08, WP-355). */}
              <Input
                type="number"
                min={0}
                max={1}
                step={0.05}
                aria-label={`${CATEGORY_LABEL[cat]} score weight`}
                value={weights[cat]}
                disabled={!canManage}
                onChange={(e) =>
                  onWeights({
                    ...weights,
                    [cat]: Math.min(1, Math.max(0, Number(e.target.value) || 0)),
                  })
                }
                className="w-20"
              />
            </div>
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">
        How much a minute in each category counts towards the Quality part of the productivity
        score, from 0 (not at all) to 1 (fully); distracting time typically weighs 0. On days the AI
        has scored screenshots, Quality comes from those scores instead.
      </p>
      {/* Which of the product's two "weights" controls does what (UX audit 2026-10-16, SET-07):
          these feed Quality only; the mix of the four parts is the Organization page's. */}
      <p className="text-xs text-muted-foreground">
        These don&apos;t decide how much Quality counts in the score. That mix — Utilization,
        Quality, Focus and Reliability as percentages — is set in{" "}
        {canOrg ? (
          <Link
            href="/settings/organization#policies"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Organization → Policies → Productivity score weights
          </Link>
        ) : (
          <span className="font-medium text-foreground">
            Organization → Policies → Productivity score weights
          </span>
        )}
        , and a department can have its own.
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
    onApps(
      insertRule(
        apps,
        { display_name: name, process_name: proc, category: "neutral", tracked: true },
        appMatcher,
      ),
    );
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
    onUrls(insertRule(urls, { domain: d, category: "neutral", tracked: true }, urlMatcher));
    setUrlDomain("");
  };

  // Rows keep their index in the full list: the "never matches" check and its fix work on list
  // order, not on whatever the search happens to show.
  const appShadow = useMemo(() => shadowedBy(apps, appMatcher), [apps]);
  const urlShadow = useMemo(() => shadowedBy(urls, urlMatcher), [urls]);
  const shownApps = apps
    .map((a, index) => ({ a, index }))
    .filter(({ a }) => a.display_name.toLowerCase().includes(q) || a.process_name.includes(q));
  const shownUrls = urls
    .map((u, index) => ({ u, index }))
    .filter(({ u }) => u.domain.includes(q));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Apps &amp; websites</CardTitle>
        <CardDescription>
          Classify each application by its process name, and choose whether the agents track it.
          Names match case-insensitively, anywhere in the name, and the first matching rule in the
          list wins.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="relative sm:w-72">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search apps or domains…"
            aria-label="Search apps or domains"
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
            // Whether a reported app is handled is read off the draft itself, so discarding the
            // draft (Reset, a 409 reload) brings its rows back (WP-538).
            isClassified={(app) => matchesAnyRule(app, apps, urls)}
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
              <Input placeholder="Display name (Slack)" aria-label="App display name" value={appName} onChange={(e) => setAppName(e.target.value)} />
              <Input placeholder="Process (slack.exe)" aria-label="App process name" value={appProc} onChange={(e) => setAppProc(e.target.value)} />
              <Button size="sm" variant="outline" onClick={addApp} className="shrink-0">
                <Plus className="size-4" /> Add app
              </Button>
            </div>
          )}
          <RuleTable
            rows={shownApps.map(({ a, index }) => ({ key: a.process_name, index, label: a.display_name, sub: a.process_name, category: a.category, tracked: a.tracked, shadowedBy: appShadow[index] }))}
            empty={apps.length === 0 ? "No app rules yet." : "No matches."}
            canManage={canManage}
            onCategory={(key, c) => onApps(apps.map((a) => (a.process_name === key ? { ...a, category: c } : a)))}
            onTracked={(key) => onApps(apps.map((a) => (a.process_name === key ? { ...a, tracked: !a.tracked } : a)))}
            onRemove={(key) => onApps(apps.filter((a) => a.process_name !== key))}
            onUnshadow={(index) => onApps(unshadow(apps, index, appMatcher))}
          />
        </div>

        {/* Websites */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Websites</p>
          {/* Said plainly: both agents record the focused app and its window title, never the page
              address, so these rows change nothing they record (QA audit 2026-10-08, WP-343). */}
          <p className="text-xs text-muted-foreground">
            Not applied by the agents yet: they record which app is in use, not the address of the
            page, so a website&apos;s category and Tracked switch don&apos;t change tracked time.
            Browser time is classified by the browser&apos;s own app rule.
          </p>
          {canManage && (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="domain.com"
                  aria-label="Website domain"
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
            rows={shownUrls.map(({ u, index }) => ({ key: u.domain, index, label: u.domain, sub: null, category: u.category, tracked: u.tracked, shadowedBy: urlShadow[index] }))}
            empty={urls.length === 0 ? "No website rules yet." : "No matches."}
            canManage={canManage}
            onCategory={(key, c) => onUrls(urls.map((u) => (u.domain === key ? { ...u, category: c } : u)))}
            onTracked={(key) => onUrls(urls.map((u) => (u.domain === key ? { ...u, tracked: !u.tracked } : u)))}
            onRemove={(key) => onUrls(urls.filter((u) => u.domain !== key))}
            onUnshadow={(index) => onUrls(unshadow(urls, index, urlMatcher))}
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface RuleRow {
  key: string;
  /** Position in the full list — what the "never matches" fix reorders by. */
  index: number;
  label: string;
  sub: string | null;
  category: RuleCategory;
  tracked: boolean;
  /** The earlier rule that always matches first, so this one never fires; `null` if reachable. */
  shadowedBy: string | null;
}

function RuleTable({
  rows,
  empty,
  canManage,
  onCategory,
  onTracked,
  onRemove,
  onUnshadow,
}: {
  rows: RuleRow[];
  empty: string;
  canManage: boolean;
  onCategory: (key: string, c: RuleCategory) => void;
  onTracked: (key: string) => void;
  onRemove: (key: string) => void;
  /** Move the rule at this list index above the rule that shadows it. */
  onUnshadow: (index: number) => void;
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
                  {/* First match wins, so a rule below a more general one can never fire — say so,
                      and offer the fix, instead of showing it as active (WP-342). */}
                  {r.shadowedBy ? (
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-warning">
                      <span>Never matches — “{r.shadowedBy}” above it matches first.</span>
                      {canManage ? (
                        <button
                          type="button"
                          className="font-medium underline underline-offset-2 hover:no-underline"
                          onClick={() => onUnshadow(r.index)}
                        >
                          Move it above
                        </button>
                      ) : null}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <CategorySelect
                    value={r.category}
                    onChange={(c) => onCategory(r.key, c)}
                    disabled={!canManage}
                    label={`Category for ${r.label}`}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Switch
                    size="sm"
                    checked={r.tracked}
                    disabled={!canManage}
                    onCheckedChange={() => onTracked(r.key)}
                    aria-label={`Track ${r.label}`}
                  />
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
              aria-label={`New entry for ${title}`}
              className="text-sm"
            />
            <Button size="sm" variant="outline" onClick={add} aria-label={`Add to ${title}`}>
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
  showCategories = true,
  savedMessage = "Tracking rules saved",
  emptyLabel = "Loading tracking rules…",
  onDirtyChange,
}: {
  rules: OrgRulesState;
  canManage: boolean;
  /** Show the org-only "unclassified apps" gap panel. Off for department scope. */
  showUnclassified?: boolean;
  /**
   * Show the category score weights. Off for department scope: the scorer reads them from the org
   * document only, so a department's copy was saved, shown and never used (WP-355).
   */
  showCategories?: boolean;
  /** Toast shown on a successful save. */
  savedMessage?: string;
  /** Loader label while the doc first loads. */
  emptyLabel?: string;
  /** Told whenever the draft gains or loses unsaved edits (e.g. to confirm before a dialog closes). */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { doc, loading, error, reload, save } = rules;
  const tabIds = useId();

  const [draft, setDraft] = useState<RulesDoc | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>(showCategories ? "categories" : "apps");

  // Seed the working draft whenever the server doc (re)loads.
  useEffect(() => {
    if (doc) setDraft(structuredClone(doc));
  }, [doc]);

  const dirty = useMemo(
    () => Boolean(doc && draft && JSON.stringify(doc) !== JSON.stringify(draft)),
    [doc, draft],
  );
  useCardGuard(dirty);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

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
    ...(showCategories ? [{ key: "categories" as const, label: "Categories" }] : []),
    { key: "apps", label: "Apps & websites", count: draft.apps.length + draft.urls.length },
    {
      key: "lists",
      // Holds the not-tracked lists and the app lists too, not just restricted sites.
      label: "Not tracked & restricted",
      count:
        draft.exceptions.apps.length +
        draft.exceptions.urls.length +
        draft.blocked.apps.length +
        draft.blocked.urls.length,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Real tabs to assistive tech: the underline colour was the only sign of which was open
          (WP-537). */}
      <div
        role="tablist"
        aria-label="Rule sections"
        className="flex gap-1 overflow-x-auto overflow-y-hidden border-b"
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`${tabIds}-tab-${tab.key}`}
              aria-selected={active}
              aria-controls={`${tabIds}-panel`}
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

      <div
        role="tabpanel"
        id={`${tabIds}-panel`}
        aria-labelledby={`${tabIds}-tab-${activeTab}`}
      >
      {activeTab === "categories" && showCategories && (
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
          {/* Named for what the agents actually do with `exceptions`: a privacy carve-out. While a
              listed app or site is focused nothing is recorded — no activity, no screenshot — and it
              is not exempt from the restricted lists. "Allow list … always allowed" read as "never
              penalised", so admins added Slack and Zoom and their time vanished (WP-099). */}
          <ChipInput
            title="Not tracked (apps)"
            description="Privacy exceptions: while one of these is focused, no activity or screenshot is recorded. Doesn't override the restricted list. Process names, e.g. 1password.exe."
            accent="positive"
            placeholder="process.exe"
            validate={looksLikeProcess}
            items={draft.exceptions.apps}
            onChange={(v) => patch("exceptions", { ...draft.exceptions, apps: v })}
            canManage={canManage}
          />
          {/* The site lists are matched against the window title: neither agent can read a page's
              address (WP-343). */}
          <ChipInput
            title="Not tracked (sites)"
            description="Privacy exceptions: while one of these is open, no activity or screenshot is recorded. Matched against the window title, since the agents can't read page addresses yet. Doesn't override the restricted list. Domains."
            accent="positive"
            placeholder="domain.com"
            validate={isDomain}
            items={draft.exceptions.urls}
            onChange={(v) => patch("exceptions", { ...draft.exceptions, urls: v })}
            canManage={canManage}
          />
          <ChipInput
            title="Restricted apps"
            description="Using one during a running timer warns the employee on-screen and flags it for review; the background service, which has no timer, flags it without a warning. Process names."
            accent="negative"
            placeholder="process.exe"
            validate={looksLikeProcess}
            items={draft.blocked.apps}
            onChange={(v) => patch("blocked", { ...draft.blocked, apps: v })}
            canManage={canManage}
          />
          <ChipInput
            title="Restricted sites"
            description="Visiting one during a running timer warns the employee on-screen and flags it for review; the background service, which has no timer, flags it without a warning. Matched against the window title, since the agents can't read page addresses yet. Domains."
            accent="negative"
            placeholder="domain.com"
            validate={isDomain}
            items={draft.blocked.urls}
            onChange={(v) => patch("blocked", { ...draft.blocked, urls: v })}
            canManage={canManage}
          />
        </div>
      )}
      </div>

      {/* One document across all three tabs, so one Save for all of them — pinned to the bottom
          of the pane so it stays in sight of whichever tab was edited (UX audit XC-11). */}
      <CardSaveFooter
        dirty={canManage && dirty}
        saving={saving}
        onSave={() => void handleSave()}
        onCancel={() => doc && setDraft(structuredClone(doc))}
        saveLabel="Save rules"
        hint="Saves every tab here together."
        sticky
        className="mx-0 rounded-lg border bg-card px-4 py-3 shadow-sm"
      />
    </div>
  );
}
