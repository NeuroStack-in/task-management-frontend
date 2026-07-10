import { Loader } from "@/components/shared/loader";

/**
 * Route-level fallback for every authenticated page.
 *
 * Without a `loading.tsx` the App Router has no Suspense boundary here, so a
 * segment whose payload isn't prefetched yet lands on an empty main area with no
 * feedback — the "sometimes it's just blank" symptom. Whether you saw it came
 * down to whether the sidebar `<Link>` had prefetched that route yet.
 *
 * The spinner is delay-gated (see `.wp-loading-delay`), so a fast, prefetched
 * navigation resolves before it ever becomes visible.
 */
export default function Loading() {
  return (
    <Loader
      className="wp-loading-delay min-h-[60vh]"
      label="Loading…"
    />
  );
}
