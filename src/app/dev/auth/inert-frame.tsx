"use client";

import { useCallback } from "react";

/**
 * A preview region nothing can reach: `inert` takes it out of focus, keyboard and pointer alike.
 *
 * The gallery's frames relied on `aria-hidden` + `pointer-events: none`, which stop the mouse but
 * not the keyboard — tab into a preview, press Enter, and the real component did its real work: a
 * Cognito sign-in, a reset email, or an org / invite / tracking-policy write against the shared dev
 * stack (QA audit 2026-10-08, WP-388). Set through the DOM because React 18's types don't know the
 * attribute.
 */
export function InertFrame({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useCallback((el: HTMLDivElement | null) => {
    el?.setAttribute("inert", "");
  }, []);
  return (
    <div ref={ref} aria-hidden className={className}>
      {children}
    </div>
  );
}
