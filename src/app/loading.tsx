import { Loader } from "@/components/shared/loader";

/**
 * Fallback for every route that has no nearer boundary: the marketing pages,
 * the auth flow, and onboarding. Authenticated routes resolve to
 * `(app)/loading.tsx` instead, which keeps the sidebar and navbar in place.
 *
 * This one renders on a bare canvas because those routes have no shell of their
 * own. Delay-gated like the others, so a fast navigation never flashes it.
 */
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader className="wp-loading-delay" label="Loading…" />
    </div>
  );
}
