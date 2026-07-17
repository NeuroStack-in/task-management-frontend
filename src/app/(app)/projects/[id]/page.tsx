import type { Metadata } from "next";
import { ProjectDetailPage } from "@/modules/projects/components/project-detail-page";

// Static title — the project name isn't known server-side (the detail loads client-side with the
// caller's token). The client sets the document title-context via the page heading.
export const metadata: Metadata = { title: "Project" };

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProjectDetailPage id={id} />;
}
