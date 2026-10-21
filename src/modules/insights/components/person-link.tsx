"use client";

import Link from "next/link";
import { Camera } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { EMP_PARAM } from "../lib/employee-scope";
import { DATE_PARAM } from "../lib/url-params";

/** `?date=` opens that day on every Analytics tab (see `lib/url-params`, UX audit MON-13). */
export { DATE_PARAM };

/** That person's Activity view — the hub scoped to them (`?emp=`). */
export function personActivityHref(userId: string): string {
  return `/insights/activity?${EMP_PARAM}=${encodeURIComponent(userId)}`;
}

/** That person's captures for one day. */
export function personScreenshotsHref(userId: string, date: string): string {
  const q = new URLSearchParams({ [EMP_PARAM]: userId, [DATE_PARAM]: date });
  return `/insights/screenshots?${q.toString()}`;
}

/** The one date notation (UX audit XC-06 / MON-23). */
function shortDay(iso: string): string {
  return formatDate(iso);
}

/**
 * A named person who can be opened: the name links to their Activity, and — when there is a day to
 * show — a camera links to their screenshots for that day (UX audit 2026-10-16, MON-04).
 *
 * Every named person on the AI cards used to be plain text, so "Needs attention: Asha · 48" was a
 * dead end. Each link appears only for a viewer whose role can open it; without an id the name
 * stays text — a link must go to the right person or nowhere.
 */
export function PersonLink({
  userId,
  name,
  date,
  tone = "default",
  className,
}: {
  /** `null` when the name couldn't be resolved to exactly one person. */
  userId: string | null;
  name: string;
  /** The day the context is about; omit for a range (there is no one day of screenshots to open). */
  date?: string;
  /** `onFeature` for the indigo AI cards. */
  tone?: "default" | "onFeature";
  className?: string;
}) {
  const { can } = usePermissions();
  const linkClass =
    tone === "onFeature"
      ? "underline decoration-white/40 underline-offset-4 hover:decoration-white"
      : "text-foreground underline decoration-muted-foreground/40 underline-offset-4 hover:text-primary hover:decoration-primary";

  if (!userId) return <span className={className}>{name}</span>;

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      {can("activity:view") ? (
        <Link href={personActivityHref(userId)} className={cn("truncate", linkClass)}>
          {name}
        </Link>
      ) : (
        <span className="truncate">{name}</span>
      )}
      {date && can("screenshots:view") ? (
        <Link
          href={personScreenshotsHref(userId, date)}
          aria-label={`${name}'s screenshots on ${shortDay(date)}`}
          title={`Screenshots on ${shortDay(date)}`}
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-md transition-colors",
            tone === "onFeature"
              ? "text-feature-foreground/85 hover:bg-white/15"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Camera className="size-3.5" aria-hidden="true" />
        </Link>
      ) : null}
    </span>
  );
}
