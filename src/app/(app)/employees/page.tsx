import type { Metadata } from "next";
import { users } from "@/lib/data";
import { SYSTEM_ROLES } from "@/constants/roles";
import {
  EmployeesView,
  type EmployeeRow,
} from "@/modules/employees/components/employees-view";

export const metadata: Metadata = { title: "Employees" };

const ROLE_NAME = new Map(SYSTEM_ROLES.map((r) => [r.id, r.name]));

export default function EmployeesPage() {
  const employees: EmployeeRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatarUrl,
    roleName: ROLE_NAME.get(u.roleId) ?? "Member",
    jobTitle: u.jobTitle,
    department: u.department,
    team: u.team,
    status: u.status,
    productivityScore: u.productivityScore,
  }));

  const departments = [...new Set(users.map((u) => u.department))].sort();
  const stats = {
    total: users.length,
    active: users.filter((u) => u.status === "active").length,
    avgProductivity: Math.round(
      users.reduce((s, u) => s + u.productivityScore, 0) / users.length,
    ),
    departments: departments.length,
  };

  return (
    <EmployeesView employees={employees} departments={departments} stats={stats} />
  );
}
