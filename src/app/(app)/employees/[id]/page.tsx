import { EmployeeProfile } from "@/modules/employees/components/employee-profile";

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EmployeeProfile id={id} />;
}
