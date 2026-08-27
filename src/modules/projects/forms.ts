/**
 * The shapes the project and task **forms** produce.
 *
 * These are the dialogs' output contract — what `ProjectFormDialog` / `TaskFormDialog` hand back,
 * and what `use-projects-data` / `use-project-detail` turn into a create/update request. They are
 * deliberately not the wire shapes (`ApiProject` / `ApiTask`) and not the read models (`Project` /
 * `Task`): a form collects ids and lets the server derive the rest.
 *
 * They used to live on the session zustand stores in `src/stores/{projects,tasks}.store.ts`. Those
 * stores held a working copy seeded from static mock JSON and were only ever imported with
 * `import type` — every consumer wanted these interfaces and none wanted the store — so the stores
 * were deleted and the interfaces moved here.
 */
import type { TaskPriority, TaskStatus } from "./types";
import type { ApiAttachment } from "./services/projects.service";

export interface ProjectFormValues {
  name: string;
  description: string;
  department: string;
  leadUserId: string;
  managerId: string;
  /** Team members picked from the org directory. */
  memberIds: string[];
  dueDate: string;
  /** Project-level, required at creation; every task inherits it (LLD §4). */
  billable: boolean;
}

export interface TaskFormValues {
  title: string;
  description: string;
  status: TaskStatus;
  /** Everyone to put on the task; empty means unassigned, which is a choice the form can make. */
  assigneeIds: string[];
  priority: TaskPriority;
  dueDate: string | null;
  estimateHours: number;
  /** Attachments in wire shape — sent straight into the create/update request body. */
  attachments: ApiAttachment[];
}
