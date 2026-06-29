"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Portals its children into the top navbar's action slot (#wp-page-actions),
 * so a page with a custom header (not <PageHeader>) can still place its actions
 * up in the navbar on the same row as the title.
 */
export function NavbarActions({ children }: { children: React.ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSlot(document.getElementById("wp-page-actions"));
  }, []);
  return slot ? createPortal(children, slot) : null;
}
