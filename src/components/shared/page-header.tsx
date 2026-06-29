"use client";

import { usePageTitle } from "@/stores/page-header.store";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  // The visible title + subtitle now live in the top navbar; publish them there.
  usePageTitle(title, description);

  // Keep an sr-only <h1> for semantics/landmarks on every page.
  const heading = <h1 className="sr-only">{title}</h1>;

  // Only actions remain in-page. With nothing to show, render no bar at all
  // (avoids a stray bordered line on title-only pages).
  if (!actions) return heading;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-end",
        className,
      )}
    >
      {heading}
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  );
}
