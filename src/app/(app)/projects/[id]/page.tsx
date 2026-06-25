import type { Metadata } from "next";
import { projects, tasks, users } from "@/lib/data";
import { buildUserMap } from "@/modules/projects/lib";
import { ProjectDetailPage } from "@/modules/projects/components/project-detail-page";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const project = projects.find((p) => p.id === id);
  return { title: project ? project.name : "Project" };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectTasks = tasks.filter((t) => t.projectId === id);

  return (
    <ProjectDetailPage
      id={id}
      tasks={projectTasks}
      userMap={buildUserMap(users)}
    />
  );
}
