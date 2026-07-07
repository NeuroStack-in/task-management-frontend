import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Status a newly created account can start in. */
export type NewEmployeeStatus = "active" | "invited";

export interface CreateEmployeeInput {
  name: string;
  email: string;
  jobTitle: string;
  department: string;
  team: string;
  roleId: string;
  roleName: string;
  status: NewEmployeeStatus;
}

/**
 * A runtime-created employee account. Shape is row-compatible with the
 * Employees table (EmployeeRow) so the view can merge these straight in.
 */
export interface StoredEmployee {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  roleName: string;
  jobTitle: string;
  department: string;
  team: string;
  status: "active" | "invited";
  productivityScore: number;
}

interface EmployeesState {
  /** Accounts created in-app. Seed users live in users.json (lib/data). */
  customEmployees: StoredEmployee[];
  /**
   * Department/team reassignments applied on top of any employee (seed or
   * custom) by id. Lets a member be moved between teams without a real backend.
   */
  assignments: Record<string, { department: string; team: string }>;
  createEmployee: (input: CreateEmployeeInput) => StoredEmployee;
  removeEmployee: (id: string) => void;
  reassignEmployee: (id: string, department: string, team: string) => void;
}

let employeeCounter = 0;
function nextEmployeeId(): string {
  employeeCounter += 1;
  return `usr-${Date.now().toString(36)}-${employeeCounter}`;
}

export const useEmployeesStore = create<EmployeesState>()(
  persist(
    (set) => ({
      customEmployees: [],
      assignments: {},

      createEmployee: (input) => {
        const employee: StoredEmployee = {
          id: nextEmployeeId(),
          name: input.name,
          email: input.email,
          jobTitle: input.jobTitle,
          department: input.department,
          team: input.team,
          roleName: input.roleName,
          status: input.status,
          // Invited accounts haven't logged activity yet.
          productivityScore: input.status === "active" ? 72 : 0,
        };
        set((s) => ({ customEmployees: [employee, ...s.customEmployees] }));
        return employee;
      },

      removeEmployee: (id) =>
        set((s) => ({
          customEmployees: s.customEmployees.filter((e) => e.id !== id),
        })),

      reassignEmployee: (id, department, team) =>
        set((s) => ({
          assignments: { ...s.assignments, [id]: { department, team } },
          // Keep in-store (custom) employees directly in sync too.
          customEmployees: s.customEmployees.map((e) =>
            e.id === id ? { ...e, department, team } : e,
          ),
        })),
    }),
    { name: "wp-employees" },
  ),
);
