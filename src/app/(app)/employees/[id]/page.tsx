import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { projects, tasks, users } from "@/lib/data";
import { SYSTEM_ROLES } from "@/constants/roles";
import {
  EmployeeProfile,
  type ActiveProjectItem,
  type EmployeeProfileData,
} from "@/modules/employees/components/employee-profile";

const ROLE_NAME = new Map(SYSTEM_ROLES.map((r) => [r.id, r.name]));
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const COUNTRIES = [
  "United States", "United Kingdom", "Canada", "Germany", "Australia", "India",
];
const CITIES = [
  "New York, NY", "San Francisco, CA", "Austin, TX",
  "London, UK", "Berlin, DE", "Toronto, ON",
];
const STREETS = [
  "Apple Street", "Maple Avenue", "Oak Lane", "Cedar Road",
  "Birch Boulevard", "Pine Court", "Elm Way", "Willow Drive",
];

/** Deterministic per-id seed (no Date.now()/random — stable across renders). */
function seedOf(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function buildProfile(id: string): EmployeeProfileData | null {
  const u = users.find((x) => x.id === id);
  if (!u) return null;
  const seed = seedOf(u.id);

  // Synthesized (mock) personal/contact details, deterministic per user.
  const phone = `(${500 + (seed % 400)}) 555-${String(1000 + (seed % 9000))}`;
  const dob = `${MONTHS[seed % 12]} ${1 + (seed % 28)}, ${1985 + (seed % 14)}`;
  const hireDate = `${MONTHS[(seed >> 2) % 12]} ${1 + ((seed >> 3) % 28)}, ${2019 + (seed % 6)}`;
  const country = COUNTRIES[seed % COUNTRIES.length];
  const cityState = CITIES[seed % CITIES.length];
  const address = `${100 + (seed % 900)} ${STREETS[seed % STREETS.length]}, Suite ${1 + (seed % 40)}`;
  const postcode = String(10000 + (seed % 89999));
  const empCode = `#EMP${100000 + (seed % 899999)}`;

  // Real active projects (the seed data the user belongs to).
  const memberProjects = projects.filter((p) => p.memberIds.includes(u.id));
  const activeProjects: ActiveProjectItem[] = memberProjects
    .filter((p) => p.status === "active" || p.status === "on_hold")
    .map((p) => ({
      id: p.id,
      name: p.name,
      key: p.key,
      progress: p.progress,
      tasks: tasks.filter((t) => t.projectId === p.id).length,
      teammates: p.memberIds.length,
    }))
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 6);

  const totalTasks = activeProjects.reduce((s, p) => s + p.tasks, 0);
  const avgCompletion = activeProjects.length
    ? Math.round(
        activeProjects.reduce((s, p) => s + p.progress, 0) /
          activeProjects.length,
      )
    : 0;

  // KPI: avg productive hours/day over 6 months, derived from the score.
  const base = (u.productivityScore / 100) * 8;
  const shape = [0.32, 0.62, 0.55, 0.78, 0.7, 0.95];
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const current = shape.map((f, i) =>
    round1(Math.min(8, base * f + ((seed >> i) % 6) / 10)),
  );
  const previous = shape.map((f, i) =>
    round1(Math.min(8, base * f * 0.82 + ((seed >> (i + 1)) % 5) / 10)),
  );

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    avatarUrl: u.avatarUrl,
    jobTitle: u.jobTitle,
    department: u.department,
    team: u.team,
    roleName: ROLE_NAME.get(u.roleId) ?? "Member",
    status: u.status,
    productivityScore: u.productivityScore,
    empCode,
    phone,
    dob,
    hireDate,
    country,
    cityState,
    address,
    postcode,
    activeProjects,
    kpi: { months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"], current, previous },
    totalTasks,
    avgCompletion,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const u = users.find((x) => x.id === id);
  return { title: u ? u.name : "Employee" };
}

export default async function EmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = buildProfile(id);

  if (!data) {
    return (
      <EmptyState
        icon={Users}
        title="Employee not found"
        description="This person may have left the organization or the link is out of date."
        action={
          <Button render={<Link href="/employees" />} nativeButton={false}>
            Back to employees
          </Button>
        }
      />
    );
  }

  return <EmployeeProfile data={data} />;
}
