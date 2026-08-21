/**
 * Typed accessors over the static mock datasets in src/data/.
 *
 * This is the single import point for raw mock JSON. Module services build on
 * top of these — components must never import the JSON directly (SPEC.md §5).
 */
import usersJson from "@/data/users.json";
import organizationJson from "@/data/organization.json";
import projectsJson from "@/data/projects.json";
import tasksJson from "@/data/tasks.json";
import type { Organization, User } from "@/types/user";
import type { Project, Task } from "@/modules/projects/types";

export const users = usersJson as User[];
export const organization = organizationJson as Organization;
// "archived" was retired as a project status; coerce any legacy archived
// records in the seed data to "completed" so nothing references it.
export const projects: Project[] = (projectsJson as Project[]).map((p) =>
  (p.status as string) === "archived" ? { ...p, status: "completed" } : p,
);
/**
 * The seed rows predate several `Task` fields and store a single `assigneeId`, so they are
 * normalised on load rather than cast.
 *
 * This used to be a bare `as Task[]`, which type-checked while quietly claiming the JSON had a
 * `description` and an `attachments` array it never had. Widening `Task` to a list of assignees is
 * what surfaced it; filling the gaps here is cheaper and more honest than regenerating the fixture.
 */
type SeedTask = Omit<Task, "description" | "assignees" | "attachments"> & {
  description?: string;
  assigneeId?: string | null;
  attachments?: Task["attachments"];
};

export const tasks: Task[] = (tasksJson as SeedTask[]).map((t) => ({
  ...t,
  description: t.description ?? "",
  assignees: t.assigneeId
    ? [{ userId: t.assigneeId, assignedBy: "", assignedAt: 0 }]
    : [],
  attachments: t.attachments ?? [],
}));

/** Simulates network latency for mock services. */
export function delay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
