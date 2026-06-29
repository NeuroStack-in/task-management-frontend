import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TablePaginationProps {
  /** Current page, 0-based. */
  page: number;
  /** Total number of pages (>= 1). */
  pageCount: number;
  /** Total row count across all pages — drives the "Showing a–b of n" label. */
  total: number;
  /** Rows per page. */
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/**
 * The single pagination control for every data table (SPEC §5 — UX consistency).
 * Page-based: "Showing a–b of n" + Prev / page x of y / Next. Replaces the
 * hand-rolled per-table copies (Employees, Attendance, Payroll, …) so paginated
 * tables behave and read identically everywhere.
 */
export function TablePagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  className,
}: TablePaginationProps) {
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, total);

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-4 gap-y-2",
        className,
      )}
    >
      <span className="text-sm text-muted-foreground">
        {total === 0 ? "No results" : `Showing ${from}–${to} of ${total}`}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 0}
          onClick={() => onPageChange(Math.max(0, page - 1))}
        >
          <ChevronLeft className="size-4" /> Prev
        </Button>
        <span className="text-sm tabular-nums text-muted-foreground">
          {Math.min(page + 1, pageCount)} / {pageCount}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pageCount - 1}
          onClick={() => onPageChange(Math.min(pageCount - 1, page + 1))}
        >
          Next <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
