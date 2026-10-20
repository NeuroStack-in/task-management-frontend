"use client";

/**
 * A settings card's unsaved-draft guard — the leave prompt, plus the marker on the tab that holds
 * the card (UX audit 2026-10-16, XC-11 / SET-14).
 *
 * `useUnsavedGuard` already asks before leaving the page with a draft. The Organization page also
 * splits its cards across tabs, and only the Profile tab ever showed that it held unsaved edits:
 * a half-edited Working hours card on the Schedule tab was invisible from every other tab, and the
 * first sign of it was the "discard?" prompt on the way out. A card that calls this inside a
 * {@link SectionDirtyContext} also reports to its tab, so the tab carries the same dot.
 *
 * Outside the Organization page there is no provider and this is exactly `useUnsavedGuard`.
 */
import { createContext, useContext, useEffect, useId } from "react";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";

/** Told whenever one card in a section gains or loses unsaved edits; `owner` is that card's id. */
export type SectionDirtyReporter = (owner: string, dirty: boolean) => void;

export const SectionDirtyContext = createContext<SectionDirtyReporter | null>(null);

export function useCardGuard(
  dirty: boolean,
  opts: {
    /** See `useUnsavedGuard` — the draft survives leaving, so only a reload is guarded. */
    keptOnLeave?: boolean;
  } = {},
) {
  useUnsavedGuard(dirty, opts);
  const report = useContext(SectionDirtyContext);
  const owner = useId();
  // A kept draft is still unsaved, so the tab marks it even though leaving doesn't ask.
  useEffect(() => {
    report?.(owner, dirty);
  }, [report, owner, dirty]);
  useEffect(() => () => report?.(owner, false), [report, owner]);
}

/** Add or drop `owner` from a section's list of cards with unsaved edits. Pure, for the reporter. */
export function withOwner(owners: readonly string[], owner: string, dirty: boolean): string[] {
  const has = owners.includes(owner);
  if (has === dirty) return owners as string[];
  return dirty ? [...owners, owner] : owners.filter((o) => o !== owner);
}
