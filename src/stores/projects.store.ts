import { create } from "zustand";
import { projects as seedProjects, users } from "@/lib/data";
import { TODAY } from "@/modules/projects/lib";
import type { Project, ProjectStatus } from "@/modules/projects/types";

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
  key: string;
  department: string;
  status: ProjectStatus;
  leadUserId: string;
  teamSize: number;
  budget: number;
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

/** Assemble a member roster of `teamSize` people, lead first, filled deterministically. */
function buildMemberIds(leadId: string, teamSize: number): string[] {
  const size = Math.max(1, Math.round(teamSize));
  const ids = [leadId];
  for (const u of users) {
    if (ids.length >= size) break;
    if (u.id !== leadId) ids.push(u.id);
  }
  return ids;
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
      key: v.key.toUpperCase(),
      status: v.status,
      progress: 0,
      leadUserId: v.leadUserId,
      memberIds: buildMemberIds(v.leadUserId, v.teamSize),
      department: v.department,
      budget: v.budget,
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
              name: v.name,
              description: v.description.trim() || undefined,
              key: v.key.toUpperCase(),
              status: v.status,
              department: v.department,
              leadUserId: v.leadUserId,
              memberIds: buildMemberIds(v.leadUserId, v.teamSize),
              budget: v.budget,
              dueDate: v.dueDate,
            }
          : p,
      ),
    })),

  deleteProject: (id) =>
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
}));
