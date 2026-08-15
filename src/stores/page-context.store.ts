import { useEffect, useMemo } from "react";
import { create } from "zustand";

/** One labelled thing the page is showing — a filter, or a figure already on screen. */
export interface PageFact {
  label: string;
  value: string;
}

/**
 * Caps mirroring `assistant::…::dto` (`MAX_PAGE_FACTS`, `MAX_FACT_*_CHARS`). Enforced here as well
 * as server-side so a page author sees the truncation in dev rather than silently losing facts in
 * the prompt.
 */
export const MAX_PAGE_FACTS = 12;
const MAX_FACT_LABEL_CHARS = 40;
const MAX_FACT_VALUE_CHARS = 80;

interface PageContextState {
  /** `YYYY-MM-DD` the active page is showing, when it is date-scoped. */
  date: string | null;
  /** What the page currently displays: its filters, and the figures the user can already see. */
  facts: PageFact[];
  setContext: (c: { date?: string | null; facts?: PageFact[] }) => void;
  clear: () => void;
}

/**
 * What the active page is currently showing, published for the assistant panel.
 *
 * **Why this exists.** The panel already sent the page's *identity* — path, title, description —
 * but nothing about its *state*. Two bugs followed directly:
 *
 * 1. **The wrong day.** Every date-keyed tool on the server defaults to today (UTC). A user on
 *    Analytics with Aug 14 selected asked which screenshot needed review and was answered for
 *    Aug 15: "no screenshots were captured today". Correct, about a day they weren't looking at.
 * 2. **Unanswerable on-screen figures.** The hero metric "1 Needs review" is computed in the
 *    browser from rows already fetched. That number exists in this tab and nowhere else, so the
 *    assistant could neither confirm nor explain it — it just denied it.
 *
 * The server treats everything here as an unverified hint: it never grants access, and a figure
 * must be confirmed by a real tool call before the reply asserts it.
 */
export const usePageContextStore = create<PageContextState>((set) => ({
  date: null,
  facts: [],
  setContext: ({ date, facts }) =>
    set({ date: date ?? null, facts: (facts ?? []).slice(0, MAX_PAGE_FACTS) }),
  clear: () => set({ date: null, facts: [] }),
}));

/**
 * Publish what this page is showing to the assistant. Clears on unmount, so a stale date from a
 * page the user has left can never be attached to a question about another one.
 *
 * Pass only what is genuinely on screen. A fact the user cannot see is worse than no fact: it
 * invites the model to explain something they never asked about.
 *
 * ```tsx
 * useAssistantPageContext({
 *   date: "2026-08-14",
 *   facts: [
 *     { label: "Tab", value: "Screenshots" },
 *     { label: "Needs review", value: "1" },
 *   ],
 * });
 * ```
 */
export function useAssistantPageContext(ctx: {
  date?: string | null;
  facts?: PageFact[];
}) {
  const setContext = usePageContextStore((s) => s.setContext);
  const clear = usePageContextStore((s) => s.clear);

  // Facts are rebuilt inline by most callers, so a new array identity arrives on every render.
  // Serialising is what keeps this effect from firing in a loop.
  const date = ctx.date ?? null;
  const serialized = JSON.stringify(
    (ctx.facts ?? [])
      .filter((f) => f.label.trim() !== "" && f.value.trim() !== "")
      .slice(0, MAX_PAGE_FACTS)
      .map((f) => ({
        label: f.label.slice(0, MAX_FACT_LABEL_CHARS),
        value: f.value.slice(0, MAX_FACT_VALUE_CHARS),
      })),
  );

  useEffect(() => {
    setContext({ date, facts: JSON.parse(serialized) as PageFact[] });
    return () => clear();
  }, [date, serialized, setContext, clear]);
}

/** The published context, for the chat panel to attach to its next request. */
export function usePublishedPageContext() {
  const date = usePageContextStore((s) => s.date);
  const facts = usePageContextStore((s) => s.facts);
  return useMemo(() => ({ date, facts }), [date, facts]);
}
