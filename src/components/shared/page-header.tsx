"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePageTitle } from "@/stores/page-header.store";
import { cn } from "@/lib/utils";

/**
 * Set to `true` by a shell that owns the top-navbar title (the Settings shell —
 * see settings/layout.tsx). When a PageHeader renders inside such a shell it
 * shows its title/description **in-pane** at the top of the content area and
 * does NOT publish to the navbar, so the navbar stays pinned at "Settings" for
 * every sub-section. Outside the shell (default `false`) the header publishes
 * to the navbar and keeps only an sr-only <h1> in-page.
 */
export const InPaneHeaderContext = createContext(false);

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * The page title + subtitle are published to the top navbar, and any page
 * actions are portalled into the navbar's action slot so they sit on the same
 * row as the title — the page body starts directly at its content. Only an
 * sr-only <h1> stays in-page for semantics/landmarks.
 *
 * Inside a shell that opts into {@link InPaneHeaderContext}, the title/subtitle
 * render visibly in-pane instead and the navbar title is left to the shell.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  const inPane = useContext(InPaneHeaderContext);
  // Don't publish to the navbar when a shell owns the title (we render in-pane).
  usePageTitle(inPane ? null : title, inPane ? null : description, {
    publish: !inPane,
  });

  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSlot(document.getElementById("wp-page-actions"));
  }, []);

  return (
    <>
      {inPane ? (
        <div className={cn("flex flex-col gap-1", className)}>
          <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="text-sm text-muted-foreground sm:text-base">
              {description}
            </p>
          ) : null}
        </div>
      ) : (
        <h1 className="sr-only">{title}</h1>
      )}
      {actions && slot ? createPortal(actions, slot) : null}
    </>
  );
}
