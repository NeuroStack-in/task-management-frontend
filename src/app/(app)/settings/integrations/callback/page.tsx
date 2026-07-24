import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader } from "@/components/shared/loader";
import { IntegrationsCallback } from "@/modules/integrations/components/integrations-callback";

export const metadata: Metadata = { title: "Connecting · Integrations" };

// `useSearchParams` needs a Suspense boundary to avoid opting the whole route into
// client-side rendering at build time (Next 15 App Router).
export default function Page() {
  return (
    <Suspense fallback={<Loader label="Finishing the connection…" />}>
      <IntegrationsCallback />
    </Suspense>
  );
}
