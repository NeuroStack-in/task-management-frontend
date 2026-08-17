import { create } from "zustand";
import { tasks as seedTasks } from "@/lib/data";
import type { Task, TaskPriority, TaskStatus } from "@/modules/projects/types";
import type { ApiAttachment } from "@/modules/projects/services/projects.service";

/**
 * Session working copy of tasks, seeded from the static mock data. Lets the
 * project detail page add and edit tasks in-memory (consistent across the
 * session). Not persisted — the mock dataset is the source of truth on reload.
 */

export interface TaskFormValues {
  title: string;
  description: string;
  status: TaskStatus;
  assigneeId: string | null;
  priority: TaskPriority;
  dueDate: string | null;
  estimateHours: number;
  /** Attachments in wire shape — sent straight into the create/update request body. */
  attachments: ApiAttachment[];
}

interface TasksState {
  tasks: Task[];
  createTask: (projectId: string, values: TaskFormValues) => Task;
  updateTask: (id: string, values: TaskFormValues) => void;
  /** Move a task to a different status column (kanban drag-and-drop). */
  moveTask: (id: string, status: TaskStatus) => void;
}

let seq = 0;

export const useTasksStore = create<TasksState>((set) => ({
  tasks: seedTasks,

  createTask: (projectId, v) => {
    seq += 1;
    const task: Task = {
      id: `task-local-${seq}`,
      projectId,
      title: v.title,
      description: v.description,
      status: v.status,
      assigneeId: v.assigneeId,
      priority: v.priority,
      dueDate: v.dueDate,
      estimateHours: v.estimateHours,
      attachments: v.attachments.map((a) => ({
        id: a.id,
        filename: a.filename,
        contentType: a.content_type,
        size: a.size,
      })),
    };
    set((s) => ({ tasks: [task, ...s.tasks] }));
    return task;
  },

  updateTask: (id, v) =>
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              title: v.title,
              status: v.status,
              assigneeId: v.assigneeId,
              priority: v.priority,
              dueDate: v.dueDate,
              estimateHours: v.estimateHours,
            }
          : t,
      ),
    })),

  moveTask: (id, status) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, status } : t)),
    })),
}));
