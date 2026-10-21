import type { Metadata } from "next";
import { EmployeeProfile } from "@/modules/employees/components/employee-profile";

// Static fallback — the name isn't known server-side (the profile loads client-side with the
// caller's token). Once it loads, the profile puts the person's name in the browser tab
// (UX audit 2026-10-16, PEOPLE-19); until then the tab says what kind of page this is rather
// than the app's generic title.
export const metadata: Metadata = { title: "Employee" };

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EmployeeProfile id={id} />;
}
