import type { Metadata } from "next";
import { EmployeesView } from "@/modules/employees/components/employees-view";

export const metadata: Metadata = { title: "Employees" };

export default function EmployeesPage() {
  return <EmployeesView />;
}
