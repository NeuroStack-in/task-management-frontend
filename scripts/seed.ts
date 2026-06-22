/**
 * Deterministic mock-data generator (SPEC.md §5, PRD §9).
 *
 * Run with `npm run seed`. Writes static JSON into src/data/. Faker is seeded
 * so regenerated data is stable across runs (important for snapshot-free demos).
 *
 * Phase 1 generates organization + users. Later phases extend this script with
 * tasks, projects, activity, screenshots, etc.
 */
import { faker } from "@faker-js/faker";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { SYSTEM_ROLES } from "../src/constants/roles";
import type { Organization, User, UserStatus } from "../src/types/user";

faker.seed(20260622);

const DATA_DIR = join(process.cwd(), "src", "data");
mkdirSync(DATA_DIR, { recursive: true });

const ORG_ID = "org-acme";

const DEPARTMENTS = [
  "Engineering",
  "Product",
  "Design",
  "Sales",
  "Marketing",
  "Customer Success",
  "Finance",
  "People Ops",
] as const;

const TEAMS_BY_DEPT: Record<string, string[]> = {
  Engineering: ["Platform", "Frontend", "Backend", "Mobile", "DevOps"],
  Product: ["Core", "Growth", "Insights"],
  Design: ["Brand", "Product Design"],
  Sales: ["Enterprise", "SMB", "Partnerships"],
  Marketing: ["Content", "Demand Gen", "Lifecycle"],
  "Customer Success": ["Onboarding", "Support", "Renewals"],
  Finance: ["Accounting", "FP&A"],
  "People Ops": ["Recruiting", "HR"],
};

const STATUS_WEIGHTS: { value: UserStatus; weight: number }[] = [
  { value: "active", weight: 70 },
  { value: "inactive", weight: 18 },
  { value: "invited", weight: 8 },
  { value: "suspended", weight: 4 },
];

function writeJson(file: string, data: unknown) {
  writeFileSync(join(DATA_DIR, file), JSON.stringify(data, null, 2) + "\n");
  const count = Array.isArray(data) ? `${data.length} records` : "object";
  console.log(`  ✓ ${file} (${count})`);
}

function generateOrganization(): Organization {
  return {
    id: ORG_ID,
    name: "Acme Corporation",
    plan: "business",
    timezone: "America/New_York",
  };
}

function generateUsers(count: number): User[] {
  const users: User[] = [];

  // First user is the Organization Owner (the demo login).
  users.push({
    id: "user-owner",
    name: "Alex Morgan",
    email: "owner@acme.test",
    avatarUrl: faker.image.avatarGitHub(),
    roleId: "role-owner",
    jobTitle: "Founder & CEO",
    department: "Product",
    team: "Core",
    status: "active",
    productivityScore: 92,
    organizationId: ORG_ID,
  });

  const nonOwnerRoles = SYSTEM_ROLES.filter((r) => r.id !== "role-owner");

  for (let i = 1; i < count; i++) {
    const department = faker.helpers.arrayElement(DEPARTMENTS);
    const team = faker.helpers.arrayElement(TEAMS_BY_DEPT[department]);
    // Weight heavily toward employees, with a sprinkling of other roles.
    const roleId = faker.helpers.weightedArrayElement([
      { value: "role-employee", weight: 70 },
      { value: "role-manager", weight: 14 },
      { value: "role-admin", weight: 6 },
      { value: "role-hr", weight: 5 },
      { value: "role-finance", weight: 5 },
    ]);
    void nonOwnerRoles;
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    users.push({
      id: `user-${i.toString().padStart(4, "0")}`,
      name: `${firstName} ${lastName}`,
      email: faker.internet
        .email({ firstName, lastName, provider: "acme.test" })
        .toLowerCase(),
      avatarUrl: faker.image.avatarGitHub(),
      roleId,
      jobTitle: faker.person.jobTitle(),
      department,
      team,
      status: faker.helpers.weightedArrayElement(STATUS_WEIGHTS),
      productivityScore: faker.number.int({ min: 38, max: 99 }),
      organizationId: ORG_ID,
    });
  }

  return users;
}

console.log("Seeding mock data...");
writeJson("organization.json", generateOrganization());
writeJson("users.json", generateUsers(120));
console.log("Done.");
