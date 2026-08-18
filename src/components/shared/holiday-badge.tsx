import { PartyPopper } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A compact "Holiday" marker overlaid on attendance / time-tracking day surfaces.
 *
 * Purely presentational — callers decide *when* a day is a holiday (via `useOrgHolidays`) and pass
 * the holiday `name` for the tooltip. Uses the indigo `--primary` accent so it reads as an org-level
 * annotation distinct from the green/amber/red attendance-status colours. Renders nothing when there
 * is no name to show, so callers can pass `nameFor(iso)` straight through.
 */
export function HolidayBadge({
  name,
  className,
  showIcon = true,
}: {
  name: string | undefined;
  className?: string;
  showIcon?: boolean;
}) {
  if (!name) return null;
  return (
    <span
      title={`Holiday: ${name}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-primary",
        className,
      )}
    >
      {showIcon ? <PartyPopper className="size-2.5 shrink-0" /> : null}
      Holiday
    </span>
  );
}
