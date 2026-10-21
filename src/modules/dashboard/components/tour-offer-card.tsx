"use client";

import { useEffect, useState } from "react";
import { Compass } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth.store";
import { useTourStore } from "@/stores/tour.store";
import { getTour } from "@/modules/help/lib/tours";
import { useTourStepFilter } from "@/modules/help/lib/use-tour-steps";
import { usePermissions } from "@/hooks/use-permissions";

const TOUR_ID = "getting-started";

/**
 * Remembered per account, in this browser. A `wp.` key, not `wp-`: `clearWorkPulseState()` removes
 * every `wp-*` key at sign-out, which would offer the tour again at every login.
 */
const offerKey = (userId: string) => `wp.tourOffer.${userId}`;

/**
 * The product tour, offered on the dashboard until it is taken or turned down (UX audit 2026-10-16,
 * SHELL-09). It was reachable only through Help → Tutorials → Walkthroughs, so a new member never
 * learned it existed. One dismissible card; either answer is remembered for this account, and the
 * "not now" toast says where the tour lives from then on.
 */
export function TourOfferCard() {
  const userId = useAuthStore((s) => s.user?.id);
  const startTour = useTourStore((s) => s.startTour);
  const running = useTourStore((s) => s.activeTourId !== null);
  const showable = useTourStepFilter();
  // Where the tour lives afterwards — said only to someone who can open the Help Center.
  const canHelp = usePermissions().can("help:view");
  const steps = getTour(TOUR_ID)?.steps.filter(showable).length ?? 0;

  // Read after mount: storage isn't there on the server, and the first client render must match it.
  const [answered, setAnswered] = useState(true);
  useEffect(() => {
    if (!userId) return;
    try {
      setAnswered(window.localStorage.getItem(offerKey(userId)) !== null);
    } catch {
      setAnswered(true); // nowhere to remember the answer — don't offer on every visit
    }
  }, [userId]);

  if (!userId || answered || running || steps === 0) return null;

  const remember = (answer: "taken" | "declined") => {
    try {
      window.localStorage.setItem(offerKey(userId), answer);
    } catch {
      /* best effort */
    }
    setAnswered(true);
  };

  return (
    <section
      aria-labelledby="tour-offer-title"
      className="bg-feature-tint/50 flex flex-col gap-3 rounded-[1.4rem] border px-5 py-4 sm:flex-row sm:items-center"
    >
      <span className="bg-card text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
        <Compass className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="tour-offer-title" className="text-sm font-semibold">
          New to WorkPulse? Take the quick tour
        </h2>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {steps} short {steps === 1 ? "stop" : "stops"}: your dashboard and where your work lives.
          You can leave it at any point.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          size="sm"
          onClick={() => {
            remember("taken");
            startTour(TOUR_ID);
          }}
        >
          Start the tour
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            remember("declined");
            if (canHelp) toast("You can take the tour any time from Help center → Tutorials.");
          }}
        >
          Not now
        </Button>
      </div>
    </section>
  );
}
