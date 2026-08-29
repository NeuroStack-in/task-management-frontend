"use client";

import { Users2 } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** The value meaning "don't filter". Shared so no page invents its own sentinel. */
export const ALL_DEPARTMENTS = "all";

export interface DepartmentOption {
  /** What the page filters on — a department **id** on insights, a **name** elsewhere. */
  value: string;
  label: string;
}

/**
 * The department filter, for every page that has one.
 *
 * There were eight of these, built three different ways — a `Select` here, a `DropdownMenu` there,
 * each with its own width, its own "All departments" string and its own idea of what the value
 * means. They looked different from each other on pages users move between in one task.
 *
 * ## Why `options` and not a `departments` list
 *
 * The pages genuinely disagree about what a department *is*. Insights filters by department **id**
 * (`dept-01K…`) and has to map the id back to a name to label the trigger; attendance and employees
 * filter by the **name** itself, because that is what their rows carry. That is a real difference in
 * the data, not an inconsistency to paper over, so this takes `{value,label}` pairs and lets each
 * page say what its values mean. What it standardises is everything the user can see: the sentinel,
 * the wording, the sizing, the accessible name, and the fact that the trigger shows the *label*
 * rather than the raw value — a bug the insights copy had to fix on its own (the trigger read
 * "dept-…" for every department).
 */
export function DepartmentFilter({
  value,
  onChange,
  options,
  /**
   * `onFeature` for the teal AI cards, whose surface is `bg-feature` — the page's default input
   * colours are invisible on it, so the trigger is styled light-on-dark instead of inheriting.
   */
  tone = "default",
  className,
  ariaLabel = "Filter by department",
  allLabel = "All departments",
}: {
  value: string;
  onChange: (value: string) => void;
  options: DepartmentOption[];
  tone?: "default" | "onFeature";
  className?: string;
  ariaLabel?: string;
  allLabel?: string;
}) {
  const labelFor = (v: unknown) => {
    if (v == null || v === ALL_DEPARTMENTS) return allLabel;
    // Fall back to the raw value only when it is not an opaque id — a name is a fine label, an id
    // never is, and showing "All departments" is a better wrong answer than "dept-01K…".
    const hit = options.find((o) => o.value === String(v));
    return hit?.label ?? allLabel;
  };

  return (
    <Select value={value} onValueChange={(v) => onChange(String(v))}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn(
          "h-9 w-[11.5rem] gap-2",
          tone === "onFeature" &&
            "text-feature-foreground border-white/25 bg-white/10 hover:bg-white/15 focus-visible:ring-white/40",
          className,
        )}
      >
        {/* The icon came from the dashboard's copy and is kept for all of them: it is the fastest
            way to tell this filter apart from the status/period controls beside it, and "the same
            everywhere" has to include the affordances, not just the wording. */}
        <div className="flex min-w-0 items-center gap-2">
          <Users2
            className={cn(
              "size-4 shrink-0",
              tone === "onFeature" ? "text-feature-foreground/70" : "text-muted-foreground",
            )}
          />
          <SelectValue className="truncate whitespace-nowrap">{(v) => labelFor(v)}</SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent className="max-h-72">
        <SelectItem value={ALL_DEPARTMENTS}>{allLabel}</SelectItem>
        {options
          .filter((o) => o.value !== ALL_DEPARTMENTS)
          .map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}
