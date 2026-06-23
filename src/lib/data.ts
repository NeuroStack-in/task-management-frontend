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
export const projects = projectsJson as Project[];
export const tasks = tasksJson as Task[];

/** Simulates network latency for mock services. */
export function delay<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
