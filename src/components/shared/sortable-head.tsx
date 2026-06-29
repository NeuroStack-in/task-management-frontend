import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";

interface SortableHeadProps<T extends string> {
  /** This column's sort key. */
  col: T;
  /** The currently-active sort key. */
  active: T;
  dir: SortDir;
  onSort: (col: T) => void;
  align?: "right";
  className?: string;
  children: React.ReactNode;
}

/**
 * One sortable table-header cell for every data table (SPEC §5 — UX consistency).
 * Renders the <TableHead> with `aria-sort` and a single shared sort affordance
 * (up / down when active, neutral arrows otherwise), replacing the divergent
 * per-table SortHead / SortIcon helpers.
 */
export function SortableHead<T extends string>({
  col,
  active,
  dir,
  onSort,
  align,
  className,
  children,
}: SortableHeadProps<T>) {
  const isActive = active === col;
  return (
    <TableHead
      className={cn(align === "right" && "text-right", className)}
      aria-sort={
        isActive ? (dir === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSort(col)}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1 rounded-sm font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          align === "right" && "flex-row-reverse",
          isActive && "text-foreground",
        )}
      >
        {children}
        {isActive ? (
          dir === "asc" ? (
            <ArrowUp className="size-3.5" />
          ) : (
            <ArrowDown className="size-3.5" />
          )
        ) : (
          <ArrowUpDown className="size-3.5 text-muted-foreground/50" />
        )}
      </button>
    </TableHead>
  );
}
