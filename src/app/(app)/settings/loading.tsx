import { Loader } from "@/components/shared/loader";

/**
 * Settings is also a redirect hop (/settings → /settings/profile). This boundary
 * lives inside the two-pane shell, so the section rail stays visible and only the
 * content pane spins while the target section loads.
 */
export default function Loading() {
  return (
    <Loader className="wp-loading-delay min-h-[45vh]" label="Loading…" />
  );
}
