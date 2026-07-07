import type { Metadata } from "next";
import { LocationsView } from "@/modules/locations/components/locations-board";

export const metadata: Metadata = { title: "Locations · Analytics" };

export default function Page() {
  return <LocationsView />;
}
