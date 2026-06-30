import { useEffect } from "react";
import { create } from "zustand";

interface PageHeaderState {
  /** Title shown in the top navbar for the active page (null = use route fallback). */
  title: string | null;
  /** Subtitle shown beneath the title in the navbar. */
  description: string | null;
  setHeader: (h: { title: string | null; description?: string | null }) => void;
}

export const usePageHeaderStore = create<PageHeaderState>((set) => ({
  title: null,
  description: null,
  setHeader: ({ title, description }) =>
    set({ title, description: description ?? null }),
}));

/**
 * Publish the active page's title + subtitle to the top navbar. Pages call this
 * (directly, or via <PageHeader>) so the navbar can echo the page name — and the
 * real record name on dynamic detail routes. Clears on unmount.
 *
 * Pass `{ publish: false }` to opt out — used when a parent shell owns the
 * navbar title (e.g. the Settings shell pins it to "Settings" and lets each
 * sub-page render its own header in-pane). When disabled the hook touches the
 * store on neither mount nor unmount, so it never clobbers the shell's title.
 */
export function usePageTitle(
  title: string | null,
  description?: string | null,
  options?: { publish?: boolean },
) {
  const publish = options?.publish ?? true;
  const setHeader = usePageHeaderStore((s) => s.setHeader);
  useEffect(() => {
    if (!publish) return;
    setHeader({ title, description: description ?? null });
    return () => setHeader({ title: null, description: null });
  }, [title, description, publish, setHeader]);
}
