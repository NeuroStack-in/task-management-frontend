import type { Metadata } from "next";
import { tasks, users } from "@/lib/data";
import { buildUserMap } from "@/modules/projects/lib";
import { ProjectsView } from "@/modules/projects/components/projects-view";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return <ProjectsView tasks={tasks} userMap={buildUserMap(users)} />;
}
