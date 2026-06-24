import { create } from "zustand";
import { projects as seedProjects } from "@/lib/data";
import { TODAY } from "@/modules/projects/lib";
import type { Project } from "@/modules/projects/types";

/**
 * Working copy of the project list for the session. Seeded from the static mock
 * data so the first (server + client) render matches, then mutated in-memory by
 * create / edit / delete. Kept as a singleton store so a project created or
 * edited on one page is visible on every other page during the session.
 *
 * Not persisted on purpose: the mock dataset is the source of truth on reload,
 * which keeps the demo deterministic (CLAUDE.md — no Date.now()/random in render;
 * the helpers below only run inside user-event handlers).
 */

export interface ProjectFormValues {
  name: string;
  description: string;
  department: string;
  leadUserId: string;
  managerId: string;
  /** Team members picked from the org directory. */
  memberIds: string[];
  dueDate: string;
}

interface ProjectsState {
  projects: Project[];
  getProject: (id: string) => Project | undefined;
  createProject: (values: ProjectFormValues) => Project;
  updateProject: (id: string, values: ProjectFormValues) => void;
  deleteProject: (id: string) => void;
}

const TODAY_ISO = new Date(TODAY).toISOString().slice(0, 10);
let seq = 0;

/** Derive a short uppercase project key from the name (e.g. "Atlas Migration" → "AM"). */
function deriveKey(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const base =
    words.length >= 2 ? words[0][0] + words[1][0] : (words[0] ?? "PR").slice(0, 3);
  return base.toUpperCase().slice(0, 4) || "PRJ";
}

/** Lead + manager are always part of the team; merge them with the picked members. */
function rosterOf(values: ProjectFormValues): string[] {
  return Array.from(
    new Set(
      [values.leadUserId, values.managerId, ...values.memberIds].filter(Boolean),
    ),
  );
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: seedProjects,

  getProject: (id) => get().projects.find((p) => p.id === id),

  createProject: (v) => {
    seq += 1;
    const project: Project = {
      id: `proj-local-${seq}`,
      name: v.name,
      description: v.description.trim() || undefined,
      key: deriveKey(v.name),
      status: "active",
      progress: 0,
      leadUserId: v.leadUserId,
      managerId: v.managerId || undefined,
      memberIds: rosterOf(v),
      department: v.department,
      budget: 0,
      spent: 0,
      startDate: TODAY_ISO,
      dueDate: v.dueDate,
      velocity: [6, 9, 8, 11, 10, 13, 15],
    };
    set((s) => ({ projects: [project, ...s.projects] }));
    return project;
  },

  updateProject: (id, v) =>
    set((s) => ({
      projects: s.projects.map((p) =>
        p.id === id
          ? {
              ...p,
              // key, budget, spent and status are preserved (not edited here).
              name: v.name,
              description: v.description.trim() || undefined,
              department: v.department,
              leadUserId: v.leadUserId,
              managerId: v.managerId || undefined,
              memberIds: rosterOf(v),
              dueDate: v.dueDate,
            }
          : p,
      ),
    })),

  deleteProject: (id) =>
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
}));
