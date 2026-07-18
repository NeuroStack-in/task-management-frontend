"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Copy, Download, ScrollText, Search, X } from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Loader } from "@/components/shared/loader";
import { initials } from "@/lib/format";
import { downloadBlob } from "@/lib/download";
import { AUDIT_CATEGORIES, type AuditCategory } from "@/lib/mock-audit";
import { useAudit, type AuditEntry } from "../use-audit";

const PAGE_SIZE = 20;

/** Icon + label for a server category, falling back gracefully to an unknown one. */
function categoryDef(key: string): { icon: LucideIcon; label: string } {
  const hit = AUDIT_CATEGORIES.find((c) => c.key === (key as AuditCategory));
  return hit
    ? { icon: hit.icon, label: hit.label }
    : { icon: ScrollText, label: key.charAt(0).toUpperCase() + key.slice(1) };
}

function CategoryBadge({ category }: { category: string }) {
  const { icon: Icon, label } = categoryDef(category);
  return (
    <Badge variant="secondary" className="gap-1 font-normal">
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="group/row grid grid-cols-[6.5rem_1fr] items-start gap-4 py-2.5 [&+&]:border-t [&+&]:border-border/60">
      <dt className="pt-px text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-5 py-4 [&+&]:border-t">
      <h3 className="pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
        {title}
      </h3>
      {children}
    </section>
  );
}

function CopyValue({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="min-w-0 truncate font-mono text-xs">{value}</span>
      <button
        type="button"
        aria-label={`Copy ${value}`}
        onClick={() => {
          void navigator.clipboard?.writeText(value);
          toast.success("Copied to clipboard");
        }}
        className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/row:opacity-100"
      >
        <Copy className="size-3.5" />
      </button>
    </div>
  );
}

function exportCsv(entries: AuditEntry[]) {
  const head = ["Timestamp", "Actor", "Category", "Action", "Target"];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const body = entries
    .map((e) => [e.timestamp, e.actorName, e.category, e.action, e.target ?? ""].map(esc).join(","))
    .join("\n");
  downloadBlob(
    new Blob([`${head.join(",")}\n${body}`], { type: "text/csv;charset=utf-8;" }),
    "audit-log.csv",
  );
  toast.success("Audit log exported", { description: `audit-log.csv · ${entries.length} events` });
}

export function AuditLogs() {
  const { entries, loading, error, reload } = useAudit();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  // Category options come from what's actually in the log, not a fixed list — so the filter never
  // offers a category with zero events.
  const categories = useMemo(
    () => [...new Set(entries.map((e) => e.category))].sort(),
    [entries],
  );

  const hasFilters = search !== "" || category !== "all";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (category !== "all" && e.category !== category) return false;
      if (q) {
        const hay = `${e.actorName} ${e.action} ${e.target ?? ""} ${e.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, search, category]);

  const shown = filtered.slice(0, visible);
  const SelectedIcon = selected ? categoryDef(selected.category).icon : ScrollText;

  function clearFilters() {
    setSearch("");
    setCategory("all");
    setVisible(PAGE_SIZE);
  }

  if (loading && entries.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader label="Loading audit log…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-5 pt-1">
        <PageHeader title="Audit Logs" description="A record of actions across your organization." />
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pt-1">
      <PageHeader
        title="Audit Logs"
        description="A record of user actions, permission changes, and settings updates across WorkPulse."
      />

      {/* Filter toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:min-w-[220px] sm:flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by user, action, or target…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisible(PAGE_SIZE);
            }}
            className="pl-9"
          />
        </div>

        <Select
          value={category}
          onValueChange={(v) => {
            setCategory(v as string);
            setVisible(PAGE_SIZE);
          }}
        >
          <SelectTrigger className="w-full sm:w-56">
            <span className="truncate">
              <span className="text-muted-foreground">Category:</span>{" "}
              {category === "all" ? "All" : categoryDef(category).label}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {categoryDef(c).label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          className="w-full gap-1.5 sm:w-auto"
          disabled={filtered.length === 0}
          onClick={() => exportCsv(filtered)}
        >
          <Download className="size-4" /> Download CSV
        </Button>
      </div>

      {/* Result count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing <span className="font-medium text-foreground">{shown.length}</span> of{" "}
          {filtered.length} events
        </span>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {/* Log table */}
      {filtered.length === 0 ? (
        <div className="rounded-[1.4rem] bg-card py-10 shadow-soft">
          <EmptyState
            icon={Search}
            title={entries.length === 0 ? "No audit events yet" : "No matching events"}
            description={
              entries.length === 0
                ? "Actions across the org will be recorded here."
                : "Try a different search term or adjust the filters."
            }
            action={
              hasFilters ? (
                <Button size="sm" variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-[1.4rem] bg-card shadow-soft">
          <table className="w-full caption-bottom text-sm">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="hidden py-3 pl-6 lg:table-cell">Time</TableHead>
                <TableHead className="py-3 pl-6 lg:pl-2">User</TableHead>
                <TableHead className="py-3">Action</TableHead>
                <TableHead className="hidden py-3 md:table-cell">Category</TableHead>
                <TableHead className="hidden py-3 pr-6 xl:table-cell">Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((e) => (
                <TableRow key={e.key} onClick={() => setSelected(e)} className="cursor-pointer">
                  <td className="hidden py-3 pl-6 tabular-nums text-muted-foreground lg:table-cell">
                    {e.timestamp}
                  </td>
                  <td className="py-3 pl-6 lg:pl-2">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-7">
                        <AvatarFallback className="text-[10px]">
                          {initials(e.actorName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{e.actorName}</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <p className="font-medium">{e.action}</p>
                    <p className="text-xs text-muted-foreground lg:hidden">{e.timestamp}</p>
                  </td>
                  <td className="hidden py-3 md:table-cell">
                    <CategoryBadge category={e.category} />
                  </td>
                  <td className="hidden max-w-[220px] truncate py-3 pr-6 text-muted-foreground xl:table-cell">
                    {e.target ?? "—"}
                  </td>
                </TableRow>
              ))}
            </TableBody>
          </table>
        </div>
      )}

      {/* Load more */}
      {shown.length < filtered.length && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            Load more events
          </Button>
        </div>
      )}

      {/* Detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full gap-0 p-0 data-[side=right]:sm:max-w-lg"
        >
          {selected && (
            <div className="flex h-full min-h-0 flex-col">
              <SheetHeader className="gap-3 border-b bg-muted/40 p-5">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-primary">
                    <SelectedIcon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="text-left text-base leading-snug">
                      {selected.action}
                    </SheetTitle>
                    <SheetDescription className="mt-0.5 truncate text-left text-xs">
                      {selected.timestamp}
                    </SheetDescription>
                  </div>
                  <SheetClose
                    render={<Button variant="ghost" size="icon-sm" className="-mr-1.5 -mt-1.5 shrink-0" />}
                  >
                    <X className="size-4" />
                    <span className="sr-only">Close</span>
                  </SheetClose>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <CategoryBadge category={selected.category} />
                </div>
              </SheetHeader>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <DetailSection title="Performed by">
                  <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
                    <Avatar className="size-9 shrink-0">
                      <AvatarFallback className="text-xs">
                        {initials(selected.actorName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{selected.actorName}</p>
                      <p className="truncate font-mono text-xs text-muted-foreground">
                        {selected.actorId}
                      </p>
                    </div>
                  </div>
                </DetailSection>

                <DetailSection title="Event">
                  <dl>
                    <DetailRow label="Category">{categoryDef(selected.category).label}</DetailRow>
                    <DetailRow label="Action">{selected.action}</DetailRow>
                    <DetailRow label="Target">{selected.target ?? "—"}</DetailRow>
                    <DetailRow label="Timestamp">
                      <span className="tabular-nums">{selected.timestamp}</span>
                    </DetailRow>
                    <DetailRow label="Actor id">
                      <CopyValue value={selected.actorId} />
                    </DetailRow>
                  </dl>
                </DetailSection>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
