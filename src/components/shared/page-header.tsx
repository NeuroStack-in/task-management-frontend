"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePageTitle } from "@/stores/page-header.store";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * The page title + subtitle are published to the top navbar, and any page
 * actions are portalled into the navbar's action slot (#wp-page-actions) so
 * they sit on the same row as the title. The page body starts directly at its
 * content; only an sr-only <h1> stays in-page for semantics/landmarks.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  usePageTitle(title, description);

  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSlot(document.getElementById("wp-page-actions"));
  }, []);

  return (
    <>
      <h1 className="sr-only">{title}</h1>
      {actions && slot ? createPortal(actions, slot) : null}
    </>
  );
}
