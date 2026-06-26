"use client"

import { useState } from "react"
import { Globe, Lock, Plus, Search, X } from "lucide-react"
import { toast } from "sonner"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { NumberStepper } from "@/components/ui/number-stepper"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/shared/page-header"
import { SettingsSaveBar } from "@/components/shared/settings-save-bar"
import { usePermissions } from "@/hooks/use-permissions"
import {
  APP_USAGE,
  CATEGORY_COLOR,
  CATEGORY_LABEL,
  SAMPLE_PEOPLE,
  URL_USAGE,
  type UsageCategory,
  type UsageItem,
} from "@/lib/mock-insights"
import { initials } from "@/lib/format"
import { cn } from "@/lib/utils"

// ──────────────────────────────────────────────────────────────────────────────
// Types & state
// ──────────────────────────────────────────────────────────────────────────────

type TabKey =
  | "categories"
  | "apps"
  | "websites"
  | "allowblock"
  | "scoring"
  | "exceptions"

interface TrackableItem extends UsageItem {
  tracked: boolean
}

const CATEGORIES = Object.keys(CATEGORY_LABEL) as UsageCategory[]

const DEFAULT_CATEGORY_DESCRIPTIONS: Record<UsageCategory, string> = {
  productive:
    "Work tools, code editors, docs, design software, and task management platforms.",
  neutral:
    "Communication tools, general browsers, calendar apps, and team utilities.",
  distracting: "Social media, video streaming, gaming sites, and entertainment apps.",
}

interface TrackingState {
  descriptions: Record<UsageCategory, string>
  apps: TrackableItem[]
  websites: TrackableItem[]
  allowList: string[]
  blockList: string[]
  weights: Record<UsageCategory, number>
  exceptionIds: string[]
}

const INITIAL_STATE: TrackingState = {
  descriptions: { ...DEFAULT_CATEGORY_DESCRIPTIONS },
  apps: APP_USAGE.map((it) => ({ ...it, tracked: true })),
  websites: URL_USAGE.map((it) => ({ ...it, tracked: true })),
  allowList: ["github.com", "notion.so", "figma.com"],
  blockList: ["youtube.com", "reddit.com", "twitter.com"],
  weights: { productive: 3, neutral: 1, distracting: 0 },
  exceptionIds: SAMPLE_PEOPLE.slice(0, 2).map((p) => p.id),
}

function cloneState(s: TrackingState): TrackingState {
  return {
    descriptions: { ...s.descriptions },
    apps: s.apps.map((a) => ({ ...a })),
    websites: s.websites.map((w) => ({ ...w })),
    allowList: [...s.allowList],
    blockList: [...s.blockList],
    weights: { ...s.weights },
    exceptionIds: [...s.exceptionIds],
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Small shared bits
// ──────────────────────────────────────────────────────────────────────────────

function CategoryDot({ category }: { category: UsageCategory }) {
  return (
    <span
      className="inline-block size-2.5 shrink-0 rounded-full"
      style={{ background: CATEGORY_COLOR[category] }}
    />
  )
}

function CategorySelect({
  value,
  onChange,
  disabled,
}: {
  value: UsageCategory
  onChange: (v: UsageCategory) => void
  disabled?: boolean
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as UsageCategory)}
      disabled={disabled}
    >
      <SelectTrigger size="sm" className="w-40">
        <SelectValue>
          {(v) => (
            <span className="flex items-center gap-2">
              <CategoryDot category={v as UsageCategory} />
              {CATEGORY_LABEL[v as UsageCategory] ?? "Select"}
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
  )
}

/** Deterministic monogram avatar — fallback when a real logo can't load. */
function Monogram({ name }: { name: string }) {
  const hue = [...name].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 360
  return (
    <span
      className="flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-white"
      style={{ backgroundColor: `hsl(${hue} 42% 45%)` }}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

// Map app names to the domain whose favicon we show. Website rows already use
// their own domain.
const DOMAIN_BY_NAME: Record<string, string> = {
  "VS Code": "code.visualstudio.com",
  "Chrome — Docs": "docs.google.com",
  Figma: "figma.com",
  Slack: "slack.com",
  Zoom: "zoom.us",
  YouTube: "youtube.com",
  "Twitter / X": "x.com",
}

function domainFor(name: string): string | null {
  if (DOMAIN_BY_NAME[name]) return DOMAIN_BY_NAME[name]
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(name.trim()))
    return name.trim().toLowerCase()
  return null
}

/** Real favicon/logo for an app or domain, with a monogram fallback. */
function LogoIcon({ name }: { name: string }) {
  const [failed, setFailed] = useState(false)
  const domain = domainFor(name)
  if (!domain || failed) return <Monogram name={name} />
  return (
    <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://www.google.com/s2/favicons?sz=64&domain=${domain}`}
        alt=""
        className="size-5 object-contain"
        onError={() => setFailed(true)}
      />
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Categories panel
// ──────────────────────────────────────────────────────────────────────────────

function CategoriesPanel({
  descriptions,
  onChange,
  canManage,
}: {
  descriptions: Record<UsageCategory, string>
  onChange: (next: Record<UsageCategory, string>) => void
  canManage: boolean
}) {
  return (
    <div className="space-y-4">
      {CATEGORIES.map((cat) => (
        <div
          key={cat}
          className="flex items-stretch overflow-hidden rounded-lg border border-border bg-card"
        >
          <span
            className="w-1.5 shrink-0"
            style={{ backgroundColor: CATEGORY_COLOR[cat] }}
          />
          <div className="flex-1 space-y-2 p-5">
            <div className="flex items-center gap-2">
              <CategoryDot category={cat} />
              <p className="text-sm font-medium">{CATEGORY_LABEL[cat]}</p>
            </div>
            {canManage ? (
              <Input
                value={descriptions[cat]}
                onChange={(e) =>
                  onChange({ ...descriptions, [cat]: e.target.value })
                }
                className="text-sm"
              />
            ) : (
              <p className="text-xs text-muted-foreground">{descriptions[cat]}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Applications / Websites panel
// ──────────────────────────────────────────────────────────────────────────────

function ItemsPanel({
  title,
  nameLabel,
  items,
  onChange,
  canManage,
}: {
  title: string
  nameLabel: string
  items: TrackableItem[]
  onChange: (next: TrackableItem[]) => void
  canManage: boolean
}) {
  const [query, setQuery] = useState("")
  const filtered = items.filter((it) =>
    it.name.toLowerCase().includes(query.toLowerCase()),
  )

  function updateItem(name: string, patch: Partial<TrackableItem>) {
    onChange(items.map((it) => (it.name === name ? { ...it, ...patch } : it)))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Classify each {nameLabel.toLowerCase()} and choose whether it&apos;s tracked.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={`Search ${nameLabel.toLowerCase()}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full caption-bottom text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>{nameLabel}</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Time</TableHead>
                <TableHead className="text-right">Tracked</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No matches for “{query}”.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow
                    key={item.name}
                    className={cn(!item.tracked && "opacity-50")}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <LogoIcon name={item.name} />
                        <span className="font-medium">{item.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <CategorySelect
                        value={item.category}
                        onChange={(v) => updateItem(item.name, { category: v })}
                        disabled={!canManage}
                      />
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {item.minutes}m
                    </TableCell>
                    <TableCell className="text-right">
                      <Switch
                        size="sm"
                        checked={item.tracked}
                        disabled={!canManage}
                        onCheckedChange={() =>
                          updateItem(item.name, { tracked: !item.tracked })
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Allow / Block panel
// ──────────────────────────────────────────────────────────────────────────────

function ChipList({
  items,
  onRemove,
  canManage,
}: {
  items: string[]
  onRemove: (item: string) => void
  canManage: boolean
}) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">No entries yet.</p>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <div
          key={item}
          className="flex items-center gap-1.5 rounded-sm border border-border bg-muted px-2.5 py-1 text-xs"
        >
          {item}
          {canManage && (
            <button
              onClick={() => onRemove(item)}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label={`Remove ${item}`}
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function DomainListCard({
  title,
  description,
  accent,
  items,
  onChange,
  canManage,
}: {
  title: string
  description: string
  accent: "positive" | "negative"
  items: string[]
  onChange: (next: string[]) => void
  canManage: boolean
}) {
  const [input, setInput] = useState("")

  function add() {
    const val = input.trim().toLowerCase()
    if (!val) return
    if (!val.includes(".")) {
      toast.error("Enter a valid domain, e.g. example.com")
      return
    }
    if (!items.includes(val)) onChange([...items, val])
    setInput("")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span
            className={cn(
              "size-2 rounded-full",
              accent === "positive" ? "bg-positive" : "bg-negative",
            )}
          />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Globe className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="domain.com"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && add()}
                className="pl-9 text-sm"
              />
            </div>
            <Button size="sm" variant="outline" onClick={add}>
              <Plus className="size-4" />
            </Button>
          </div>
        )}
        <ChipList
          items={items}
          onRemove={(d) => onChange(items.filter((i) => i !== d))}
          canManage={canManage}
        />
      </CardContent>
    </Card>
  )
}

function AllowBlockPanel({
  allowList,
  blockList,
  onAllow,
  onBlock,
  canManage,
}: {
  allowList: string[]
  blockList: string[]
  onAllow: (next: string[]) => void
  onBlock: (next: string[]) => void
  canManage: boolean
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <DomainListCard
        title="Allow List"
        description="Domains always rated productive, regardless of category rules."
        accent="positive"
        items={allowList}
        onChange={onAllow}
        canManage={canManage}
      />
      <DomainListCard
        title="Block List"
        description="Domains always rated distracting and flagged in anomaly reports."
        accent="negative"
        items={blockList}
        onChange={onBlock}
        canManage={canManage}
      />
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Scoring panel
// ──────────────────────────────────────────────────────────────────────────────

const WEIGHT_DESCRIPTIONS: Record<UsageCategory, string> = {
  productive: "Productive — boosts the score (higher = stronger lift)",
  neutral: "Neutral — moderate positive contribution",
  distracting: "Distracting — no contribution; higher values penalise the score",
}

function ScoringPanel({
  weights,
  onChange,
  canManage,
}: {
  weights: Record<UsageCategory, number>
  onChange: (next: Record<UsageCategory, number>) => void
  canManage: boolean
}) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Category Weights</CardTitle>
          <CardDescription>
            Adjust how each category contributes to the productivity score (0 = no
            impact, 5 = maximum).
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {CATEGORIES.map((cat) => (
            <div key={cat} className="flex items-center gap-4 py-4">
              <CategoryDot category={cat} />
              <p className="min-w-0 flex-1 text-sm">{WEIGHT_DESCRIPTIONS[cat]}</p>
              <NumberStepper
                value={weights[cat]}
                min={0}
                max={5}
                valueWidthClassName="w-10"
                disabled={!canManage}
                onChange={(v) => onChange({ ...weights, [cat]: v })}
              />
            </div>
          ))}
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Score = (productive minutes × weight + neutral minutes × weight) ÷ total
        tracked minutes × 100. Distracting time does not contribute to the numerator.
      </p>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Exceptions panel
// ──────────────────────────────────────────────────────────────────────────────

function ExceptionsPanel({
  exceptionIds,
  onChange,
  canManage,
}: {
  exceptionIds: string[]
  onChange: (next: string[]) => void
  canManage: boolean
}) {
  const excluded = SAMPLE_PEOPLE.filter((p) => exceptionIds.includes(p.id))
  const available = SAMPLE_PEOPLE.filter((p) => !exceptionIds.includes(p.id))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Monitoring Exceptions</CardTitle>
        <CardDescription>
          Users listed here are excluded from activity monitoring, screenshots, and
          anomaly detection.
        </CardDescription>
        {canManage && available.length > 0 && (
          <CardAction>
            <Select
              value=""
              onValueChange={(v) => v && onChange([...exceptionIds, v as string])}
            >
              <SelectTrigger size="sm" className="w-44">
                <SelectValue placeholder="Add exception…" />
              </SelectTrigger>
              <SelectContent>
                {available.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="divide-y p-0">
        {excluded.length === 0 && (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            No exceptions configured.
          </p>
        )}
        {excluded.map((person) => (
          <div key={person.id} className="flex items-center gap-3 px-6 py-3">
            <Avatar className="size-8">
              <AvatarImage src={person.avatarUrl} alt={person.name} />
              <AvatarFallback className="text-xs">
                {initials(person.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{person.name}</p>
              <p className="text-xs text-muted-foreground">{person.jobTitle}</p>
            </div>
            {canManage && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onChange(exceptionIds.filter((id) => id !== person.id))}
                aria-label={`Remove ${person.name}`}
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Root export
// ──────────────────────────────────────────────────────────────────────────────

export function TrackingRulesTab() {
  const { can } = usePermissions()
  const canManage = can("settings:manage")
  const [activeTab, setActiveTab] = useState<TabKey>("categories")

  const [saved, setSaved] = useState<TrackingState>(() => cloneState(INITIAL_STATE))
  const [draft, setDraft] = useState<TrackingState>(() => cloneState(INITIAL_STATE))
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)

  function patch<K extends keyof TrackingState>(key: K, value: TrackingState[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  function handleSave() {
    if (!dirty || saving) return
    const next = draft
    setSaving(true)
    // Simulated persistence latency (Phase 1 is frontend-only).
    setTimeout(() => {
      setSaved(cloneState(next))
      setSaving(false)
      toast.success("Application & URL rules saved")
    }, 500)
  }

  function handleReset() {
    setDraft(cloneState(saved))
  }

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "categories", label: "Categories" },
    { key: "apps", label: "Applications", count: draft.apps.length },
    { key: "websites", label: "Websites / URLs", count: draft.websites.length },
    {
      key: "allowblock",
      label: "Allow / Block",
      count: draft.allowList.length + draft.blockList.length,
    },
    { key: "scoring", label: "Scoring Rules" },
    { key: "exceptions", label: "Exceptions", count: draft.exceptionIds.length },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Application & URL Rules"
        description="Classify apps and websites, manage allow/block lists, and configure productivity scoring."
      />

      {!canManage && (
        <div className="flex items-center gap-2.5 rounded-md border border-border bg-muted px-5 py-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0" />
          You can view these settings, but saving requires the{" "}
          <span className="font-medium text-foreground">Manage Settings</span>{" "}
          permission.
        </div>
      )}

      <div className="max-w-4xl space-y-6">
        {/* Tab bar */}
        <div className="flex gap-1 overflow-x-auto overflow-y-hidden border-b">
          {tabs.map((tab) => {
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "-mb-px border-b-2 border-primary text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                      active
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Active panel */}
        {activeTab === "categories" && (
          <CategoriesPanel
            descriptions={draft.descriptions}
            onChange={(v) => patch("descriptions", v)}
            canManage={canManage}
          />
        )}
        {activeTab === "apps" && (
          <ItemsPanel
            title="Applications"
            nameLabel="Application"
            items={draft.apps}
            onChange={(v) => patch("apps", v)}
            canManage={canManage}
          />
        )}
        {activeTab === "websites" && (
          <ItemsPanel
            title="Websites & URLs"
            nameLabel="Domain / URL"
            items={draft.websites}
            onChange={(v) => patch("websites", v)}
            canManage={canManage}
          />
        )}
        {activeTab === "allowblock" && (
          <AllowBlockPanel
            allowList={draft.allowList}
            blockList={draft.blockList}
            onAllow={(v) => patch("allowList", v)}
            onBlock={(v) => patch("blockList", v)}
            canManage={canManage}
          />
        )}
        {activeTab === "scoring" && (
          <ScoringPanel
            weights={draft.weights}
            onChange={(v) => patch("weights", v)}
            canManage={canManage}
          />
        )}
        {activeTab === "exceptions" && (
          <ExceptionsPanel
            exceptionIds={draft.exceptionIds}
            onChange={(v) => patch("exceptionIds", v)}
            canManage={canManage}
          />
        )}

        {canManage && (
          <SettingsSaveBar
            dirty={dirty}
            saving={saving}
            onSave={handleSave}
            onReset={handleReset}
          />
        )}
      </div>
    </div>
  )
}
