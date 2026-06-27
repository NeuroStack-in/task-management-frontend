"use client"

import { useState } from "react"
import type { LucideIcon } from "lucide-react"
import { CheckCircle2, AlertTriangle, XCircle, Download, ScrollText, Search } from "lucide-react"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { initials } from "@/lib/format"
import {
  AUDIT_CATEGORIES,
  AUDIT_CATEGORY_LABEL,
  AUDIT_EVENTS,
  AUDIT_TIMEFRAMES,
  type AuditCategory,
  type AuditEvent,
  type AuditStatus,
} from "@/lib/mock-audit"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 12

const STATUS_STYLE: Record<AuditStatus, string> = {
  success: "bg-success/12 text-success",
  warning: "bg-warning/15 text-warning",
  failed: "bg-destructive/12 text-destructive",
}
const STATUS_LABEL: Record<AuditStatus, string> = {
  success: "Success",
  warning: "Warning",
  failed: "Failed",
}

const STATUS_ICON: Record<AuditStatus, LucideIcon> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  failed: XCircle,
}

function categoryIcon(category: AuditCategory): LucideIcon {
  return (
    AUDIT_CATEGORIES.find((c) => c.key === category)?.icon ?? ScrollText
  )
}

function CategoryBadge({ category }: { category: AuditCategory }) {
  const Icon = categoryIcon(category)
  return (
    <Badge variant="secondary" className="gap-1 font-normal">
      <Icon className="size-3" />
      {AUDIT_CATEGORY_LABEL[category]}
    </Badge>
  )
}

function StatusBadge({ status }: { status: AuditStatus }) {
  const Icon = STATUS_ICON[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium",
        STATUS_STYLE[status],
      )}
    >
      <Icon className="size-3 shrink-0" />
      {STATUS_LABEL[status]}
    </span>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 py-2.5 [&+&]:border-t">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="col-span-2 min-w-0 text-sm">{children}</dd>
    </div>
  )
}

export function AuditLogs() {
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<string>("all")
  const [status, setStatus] = useState<string>("all")
  const [timeframe, setTimeframe] = useState<string>("all")
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [selected, setSelected] = useState<AuditEvent | null>(null)

  const hasFilters =
    search !== "" ||
    category !== "all" ||
    status !== "all" ||
    timeframe !== "all"

  const filtered = AUDIT_EVENTS.filter((e) => {
    if (category !== "all" && e.category !== category) return false
    if (status !== "all" && e.status !== status) return false
    if (timeframe !== "all") {
      const tf = AUDIT_TIMEFRAMES.find((t) => t.value === timeframe)
      if (tf && e.timestamp.slice(0, 10) < tf.cutoff) return false
    }
    if (search) {
      const q = search.toLowerCase()
      const hay =
        `${e.actorName} ${e.actorEmail} ${e.action} ${e.target} ${e.ip}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  const shown = filtered.slice(0, visible)

  function clearFilters() {
    setSearch("")
    setCategory("all")
    setStatus("all")
    setTimeframe("all")
    setVisible(PAGE_SIZE)
  }

  return (
    <div className="space-y-4 pt-1">
      <PageHeader
        title="Audit Logs"
        description="A complete record of user actions, permission changes, and login events across WorkPulse."
        actions={
          <Button
            variant="outline"
            onClick={() => toast.success("Audit log exported (CSV)")}
          >
            <Download className="size-4" /> Export
          </Button>
        }
      />

      {/* ── Filter toolbar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:min-w-[220px] sm:flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by user, action, target, or IP…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setVisible(PAGE_SIZE)
            }}
            className="pl-9"
          />
        </div>

        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v as string)
            setVisible(PAGE_SIZE)
          }}
        >
          <SelectTrigger className="w-full sm:w-56">
            <span className="truncate">
              <span className="text-muted-foreground">Category:</span>{" "}
              {category === "all"
                ? "All"
                : AUDIT_CATEGORY_LABEL[category as AuditCategory]}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {AUDIT_CATEGORIES.map((c) => (
              <SelectItem key={c.key} value={c.key}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as string)
            setVisible(PAGE_SIZE)
          }}
        >
          <SelectTrigger className="w-full sm:w-40">
            <span className="truncate">
              <span className="text-muted-foreground">Status:</span>{" "}
              {status === "all" ? "All" : STATUS_LABEL[status as AuditStatus]}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={timeframe}
          onValueChange={(v) => {
            setTimeframe(v as string)
            setVisible(PAGE_SIZE)
          }}
        >
          <SelectTrigger className="w-full sm:w-44">
            <span className="truncate">
              <span className="text-muted-foreground">Date:</span>{" "}
              {AUDIT_TIMEFRAMES.find((t) => t.value === timeframe)?.label ??
                "All time"}
            </span>
          </SelectTrigger>
          <SelectContent>
            {AUDIT_TIMEFRAMES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Result count ── */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing <span className="font-medium text-foreground">{shown.length}</span>{" "}
          of {filtered.length} events
        </span>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {/* ── Log table ── */}
      {filtered.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-10">
          <EmptyState
            icon={Search}
            title="No matching events"
            description="Try a different search term or adjust the filters."
            action={
              <Button size="sm" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full caption-bottom text-sm">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="hidden py-2.5 pl-5 lg:table-cell">
                  Time
                </TableHead>
                <TableHead className="py-2.5 pl-5 lg:pl-2">Actor</TableHead>
                <TableHead className="py-2.5">Action</TableHead>
                <TableHead className="hidden py-2.5 md:table-cell">Category</TableHead>
                <TableHead className="hidden py-2.5 xl:table-cell">Target</TableHead>
                <TableHead className="py-2.5 pr-5 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((e) => (
                <TableRow
                  key={e.id}
                  tabIndex={0}
                  onClick={() => setSelected(e)}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter" || ev.key === " ") {
                      ev.preventDefault()
                      setSelected(e)
                    }
                  }}
                  className="cursor-pointer transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40"
                >
                  <TableCell className="hidden py-2.5 pl-5 tabular-nums text-muted-foreground lg:table-cell">
                    {e.timestamp}
                  </TableCell>
                  <TableCell className="py-2.5 pl-5 lg:pl-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="size-6">
                        <AvatarFallback className="text-[9px]">
                          {initials(e.actorName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{e.actorName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <p className="font-medium">{e.action}</p>
                    <p className="text-xs text-muted-foreground lg:hidden">
                      {e.timestamp}
                    </p>
                  </TableCell>
                  <TableCell className="hidden py-2.5 md:table-cell">
                    <CategoryBadge category={e.category} />
                  </TableCell>
                  <TableCell className="hidden max-w-[220px] truncate py-2.5 text-muted-foreground xl:table-cell">
                    {e.target}
                  </TableCell>
                  <TableCell className="py-2.5 pr-5 text-right">
                    <StatusBadge status={e.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </table>
        </div>
      )}

      {/* ── Load more ── */}
      {shown.length < filtered.length && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
          >
            Load more events
          </Button>
        </div>
      )}

      {/* ── Detail sheet ── */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <SheetHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CategoryBadge category={selected.category} />
                  <StatusBadge status={selected.status} />
                </div>
                <SheetTitle className="text-left text-base leading-snug">
                  {selected.action}
                </SheetTitle>
                <SheetDescription className="text-left">
                  {selected.timestamp}
                </SheetDescription>
              </SheetHeader>
              <dl className="px-4 pb-8">
                <DetailRow label="Event ID">
                  <span className="font-mono text-xs">{selected.id}</span>
                </DetailRow>
                <DetailRow label="Actor">
                  <div className="flex items-center gap-2">
                    <Avatar className="size-6">
                      <AvatarFallback className="text-[9px]">
                        {initials(selected.actorName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-medium">{selected.actorName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {selected.actorEmail}
                      </p>
                    </div>
                  </div>
                </DetailRow>
                <DetailRow label="Category">
                  {AUDIT_CATEGORY_LABEL[selected.category]}
                </DetailRow>
                <DetailRow label="Target">{selected.target}</DetailRow>
                <DetailRow label="IP address">
                  <span className="font-mono text-xs">{selected.ip}</span>
                </DetailRow>
                <DetailRow label="Device">{selected.device}</DetailRow>
              </dl>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
