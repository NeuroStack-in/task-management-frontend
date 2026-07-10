"use client"

import { useState } from "react"
import type { LucideIcon } from "lucide-react"
import { Copy, Download, ScrollText, Search, X } from "lucide-react"
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
  SheetClose,
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
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_STYLE[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="group/row grid grid-cols-[6.5rem_1fr] items-start gap-4 py-2.5 [&+&]:border-t [&+&]:border-border/60">
      <dt className="pt-px text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  )
}

/** Hand the whole record to the clipboard — what an auditor actually wants to
 *  paste into a ticket, rather than re-typing seven fields. */
function copyEventJson(event: AuditEvent) {
  void navigator.clipboard?.writeText(JSON.stringify(event, null, 2))
  toast.success("Event copied as JSON")
}

/** Grouping for the detail sheet — an uppercase eyebrow over a set of rows,
 *  matching the sidebar's group headings so the app reads as one system. */
function DetailSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="px-5 py-4 [&+&]:border-t">
      <h3 className="pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
        {title}
      </h3>
      {children}
    </section>
  )
}

/** A value with a copy affordance that stays out of the way until you hover the
 *  row it belongs to (or tab to it). Machine-readable values only — IDs, IPs. */
function CopyValue({ value, mono }: { value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <span className={cn("min-w-0 truncate", mono && "font-mono text-xs")}>
        {value}
      </span>
      <button
        type="button"
        aria-label={`Copy ${value}`}
        onClick={() => {
          void navigator.clipboard?.writeText(value)
          toast.success("Copied to clipboard")
        }}
        className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity duration-micro hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/row:opacity-100"
      >
        <Copy className="size-3.5" />
      </button>
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

  // Capitalised so it can be used as a JSX tag. `categoryIcon` always resolves,
  // falling back to ScrollText, so this is only null when nothing is selected —
  // and the sheet body doesn't render then.
  const SelectedIcon = selected ? categoryIcon(selected.category) : ScrollText

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
    <div className="space-y-5 pt-1">
      <PageHeader
        title="Audit Logs"
        description="A complete record of user actions, permission changes, and login events across WorkPulse."
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

        <Button
          variant="outline"
          className="w-full gap-1.5 sm:w-auto"
          onClick={() => toast.success("Audit log exported (CSV)")}
        >
          <Download className="size-4" /> Download CSV
        </Button>
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
        <div className="rounded-[1.4rem] bg-card py-10 shadow-soft">
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
        <div className="overflow-hidden rounded-[1.4rem] bg-card shadow-soft">
          <table className="w-full caption-bottom text-sm">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="hidden py-3 pl-6 lg:table-cell">
                  Time
                </TableHead>
                <TableHead className="py-3 pl-6 lg:pl-2">User</TableHead>
                <TableHead className="py-3">Action</TableHead>
                <TableHead className="hidden py-3 md:table-cell">Category</TableHead>
                <TableHead className="hidden py-3 xl:table-cell">Target</TableHead>
                <TableHead className="py-3 pr-6 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((e) => (
                <TableRow
                  key={e.id}
                  onClick={() => setSelected(e)}
                  className="cursor-pointer"
                >
                  <TableCell className="hidden py-3 pl-6 tabular-nums text-muted-foreground lg:table-cell">
                    {e.timestamp}
                  </TableCell>
                  <TableCell className="py-3 pl-6 lg:pl-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-7">
                        <AvatarFallback className="text-[10px]">
                          {initials(e.actorName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{e.actorName}</span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <p className="font-medium">{e.action}</p>
                    <p className="text-xs text-muted-foreground lg:hidden">
                      {e.timestamp}
                    </p>
                  </TableCell>
                  <TableCell className="hidden py-3 md:table-cell">
                    <CategoryBadge category={e.category} />
                  </TableCell>
                  <TableCell className="hidden max-w-[220px] truncate py-3 text-muted-foreground xl:table-cell">
                    {e.target}
                  </TableCell>
                  <TableCell className="py-3 pr-6 text-right">
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
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full gap-0 p-0 data-[side=right]:sm:max-w-lg"
        >
          {selected && (
            <div className="flex h-full min-h-0 flex-col">
              {/* Header — identity of the event: what happened, to what, when */}
              <SheetHeader className="gap-3 border-b bg-muted/40 p-5">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-primary">
                    <SelectedIcon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-left text-base leading-snug">
                      {selected.action}
                    </SheetTitle>
                    <SheetDescription className="mt-0.5 truncate text-left font-mono text-xs">
                      {selected.id}
                    </SheetDescription>
                  </div>
                  <SheetClose
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="-mr-1.5 -mt-1.5 shrink-0"
                      />
                    }
                  >
                    <X className="size-4" />
                    <span className="sr-only">Close</span>
                  </SheetClose>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <CategoryBadge category={selected.category} />
                  <StatusBadge status={selected.status} />
                  <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                    {selected.timestamp}
                  </span>
                </div>
              </SheetHeader>

              {/* Body — the sheet itself never scrolls; only this pane does, so
                  the header and footer stay pinned. */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                <DetailSection title="Performed by">
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
                    <Avatar className="size-9 shrink-0">
                      <AvatarFallback className="text-xs">
                        {initials(selected.actorName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {selected.actorName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {selected.actorEmail}
                      </p>
                    </div>
                  </div>
                </DetailSection>

                <DetailSection title="Event">
                  <dl>
                    <DetailRow label="Category">
                      {AUDIT_CATEGORY_LABEL[selected.category]}
                    </DetailRow>
                    <DetailRow label="Target">{selected.target}</DetailRow>
                    <DetailRow label="Outcome">
                      <StatusBadge status={selected.status} />
                    </DetailRow>
                  </dl>
                </DetailSection>

                <DetailSection title="Origin">
                  <dl>
                    <DetailRow label="IP address">
                      <CopyValue value={selected.ip} mono />
                    </DetailRow>
                    <DetailRow label="Device">{selected.device}</DetailRow>
                    <DetailRow label="Timestamp">
                      <span className="tabular-nums">{selected.timestamp}</span>
                    </DetailRow>
                    <DetailRow label="Event ID">
                      <CopyValue value={selected.id} mono />
                    </DetailRow>
                  </dl>
                </DetailSection>
              </div>

              <div className="border-t bg-muted/40 p-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5"
                  onClick={() => copyEventJson(selected)}
                >
                  <Copy className="size-3.5" />
                  Copy event as JSON
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
