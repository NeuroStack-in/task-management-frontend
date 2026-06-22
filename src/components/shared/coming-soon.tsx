import { Construction } from "lucide-react";
import { PageHeader } from "./page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "./empty-state";

interface ComingSoonProps {
  title: string;
  description?: string;
  /** SPEC.md build phase this section is scheduled for. */
  phase?: number;
}

/**
 * Placeholder for sections not yet implemented. Keeps every route navigable
 * (PRD success metric: "100% clickable workflows") while later phases fill in
 * real screens.
 */
export function ComingSoon({ title, description, phase }: ComingSoonProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={
          phase ? <Badge variant="secondary">Phase {phase}</Badge> : undefined
        }
      />
      <EmptyState
        icon={Construction}
        title="This section is coming soon"
        description="The layout, navigation, and access control are wired up. Screens for this module land in a later build phase."
      />
    </div>
  );
}
