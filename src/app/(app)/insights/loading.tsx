import { Loader } from "@/components/shared/loader";

/**
 * Analytics is reached via a redirect hop: /insights resolves the first tab the
 * role can see, then navigates again. This boundary sits *inside* the Insights
 * layout, so the header and tab bar stay put and only the tab body spins —
 * rather than the whole page blanking through the second hop.
 *
 * The tabs pull in recharts, which is the heaviest chunk in the app, so this is
 * the route most likely to actually show the spinner.
 */
export default function Loading() {
  return (
    <Loader className="wp-loading-delay min-h-[45vh]" label="Loading analytics…" />
  );
}
