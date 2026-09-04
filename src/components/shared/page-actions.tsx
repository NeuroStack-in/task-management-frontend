"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Portal page-level actions into the top-navbar's action slot — the **same fixed spot** `PageHeader`
 * uses (`#wp-page-actions`, rendered in `top-navbar.tsx`).
 *
 * `PageHeader` already places its `actions` there for pages that publish a title through it. This is
 * the companion for the pages that don't: a page whose primary data lives in a **tab**, a child
 * component, or a **custom in-page header** that doesn't own the PageHeader. Wrapping that page's
 * Refresh button (or any page-level action) in `<PageActions>` lifts it out of the page body and into
 * the one consistent position the rest of the app already uses — instead of it sitting somewhere
 * different on every screen.
 *
 * It renders nothing inline. Only the mounted page/tab contributes, so navigating or switching tabs
 * swaps the slot's contents cleanly, and the slot is `empty:hidden` so it shows only when filled.
 * Client-only (the portal target is looked up after mount), matching `PageHeader`'s own pattern.
 */
export function PageActions({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setSlot(document.getElementById("wp-page-actions"));
  }, []);
  return slot ? createPortal(children, slot) : null;
}
