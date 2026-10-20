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
import type { ProjectStatus, TaskPriority, TaskStatus } from "./types";
import type { ApiAttachment } from "./services/projects.service";

export interface ProjectFormValues {
  name: string;
  description: string;
  /** Owning department label; `""` = none (the server treats it as optional). */
  department: string;
  leadUserId: string;
  managerId: string;
  /**
   * Team members picked from the org directory. The form always includes its manager and lead
   * (`teamWithRoles`) — both are on the team by construction (UX audit PROJ-08).
   */
  memberIds: string[];
  /**
   * `YYYY-MM-DD`. Chosen at creation (it used to be today, silently), and movable in an edit — the
   * PATCH takes `start_date`, sent only when it changed (UX audit PROJ-09).
   */
  startDate: string;
  /** `YYYY-MM-DD`, or `""` for no end date — optional, as on the server (UX audit PROJ-09). */
  dueDate: string;
  /** Project-level, required at creation; every task inherits it (LLD §4). */
  billable: boolean;
  /** Edit only — a new project is always created active. */
  status?: ProjectStatus;
  /** Edit only — the short badge key; a new project's is derived from its name. */
  key?: string;
}

export interface TaskFormValues {
  title: string;
  description: string;
  status: TaskStatus;
  /** Everyone to put on the task. **At least one** — empty is refused by the form and the server
   *  (owner decision, 2026-09-01); unassigned is no longer a state a task can be created in. */
  assigneeIds: string[];
  priority: TaskPriority;
  dueDate: string | null;
  /** `null` = no estimate. */
  estimateHours: number | null;
  /** Attachments in wire shape — sent straight into the create/update request body. */
  attachments: ApiAttachment[];
}
