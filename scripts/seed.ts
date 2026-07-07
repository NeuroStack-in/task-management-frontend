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
import type {
  Project,
  ProjectStatus,
  Task,
  TaskPriority,
  TaskStatus,
} from "../src/modules/projects/types";

faker.seed(20260622);

const DATA_DIR = join(process.cwd(), "src", "data");
mkdirSync(DATA_DIR, { recursive: true });

const ORG_ID = "org-acme";

/**
 * A fixed Employee account for the demo login (email: employee@acme.test, any
 * password). Added to users.json only — kept out of the project/task pools so it
 * doesn't shift the deterministic faker selections for the rest of the data.
 */
const DEMO_EMPLOYEE: User = {
  id: "user-employee",
  name: "Sam Rivera",
  email: "employee@acme.test",
  roleId: "role-employee",
  jobTitle: "Product Designer",
  department: "Design",
  team: "Product Design",
  status: "active",
  productivityScore: 78,
  organizationId: ORG_ID,
};

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
    // No photo → shows the WorkPulse branded default avatar. Users only get an
    // image once they actually upload one (see the ~30% minority below).
    avatarUrl: undefined,
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
      // Only a minority have uploaded a real photo; everyone else falls through
      // to the WorkPulse branded default avatar (AvatarFallback).
      avatarUrl: faker.datatype.boolean({ probability: 0.3 })
        ? faker.image.personPortrait()
        : undefined,
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

/* ------------------------------------------------------------------ */
/* Projects & Tasks (SPEC §7). Dates are anchored to a fixed reference  */
/* so faker.date stays deterministic across runs.                       */
/* ------------------------------------------------------------------ */

const NOW = new Date("2026-06-23T00:00:00Z").getTime();
const DAY = 86_400_000;

/** Whole-day ISO offset from the fixed anchor — deterministic. */
function isoFromOffsetDays(days: number): string {
  return new Date(NOW + days * DAY).toISOString().slice(0, 10);
}

const PROJECT_ADJ = [
  "Atlas", "Orbit", "Beacon", "Nova", "Helix", "Summit", "Vertex", "Quantum",
  "Pulse", "Horizon", "Cobalt", "Cascade", "Lumen", "Falcon", "Aurora",
  "Mosaic", "Pioneer", "Catalyst", "Zenith", "Harbor", "Tessera", "Meridian",
] as const;

const PROJECT_NOUN = [
  "Migration", "Redesign", "Platform", "Launch", "Revamp", "Pipeline",
  "Initiative", "Rollout", "Overhaul", "Program", "Refresh", "Expansion",
  "Integration", "Onboarding", "Modernization",
] as const;

const TASK_VERB = [
  "Implement", "Refactor", "Design", "Fix", "Investigate", "Document",
  "Optimize", "Migrate", "Review", "Test", "Polish", "Wire up", "Audit",
  "Ship", "Spec out", "Triage",
] as const;

const PROJECT_STATUS_WEIGHTS: { value: ProjectStatus; weight: number }[] = [
  { value: "active", weight: 58 },
  { value: "on_hold", weight: 14 },
  { value: "completed", weight: 28 },
];

/** A trended 7-point pulse derived from a baseline + bounded jitter. */
function generateVelocity(baseline: number): number[] {
  const out: number[] = [];
  let cur = baseline;
  for (let i = 0; i < 7; i++) {
    cur = Math.max(4, Math.min(100, cur + faker.number.int({ min: -14, max: 18 })));
    out.push(cur);
  }
  return out;
}

function progressForStatus(status: ProjectStatus): number {
  switch (status) {
    case "completed":
      return 100;
    case "on_hold":
      return faker.number.int({ min: 15, max: 70 });
    default:
      return faker.number.int({ min: 8, max: 92 });
  }
}

function generateProjects(count: number, users: User[]): Project[] {
  const leadPool = users.filter(
    (u) =>
      u.status === "active" &&
      ["role-owner", "role-admin", "role-manager"].includes(u.roleId),
  );
  const memberPool = users.filter((u) => u.status !== "suspended");
  const usedNames = new Set<string>();
  const usedKeys = new Set<string>();
  const projects: Project[] = [];

  for (let i = 0; i < count; i++) {
    // Unique "Adjective Noun" name.
    let name = "";
    do {
      name = `${faker.helpers.arrayElement(PROJECT_ADJ)} ${faker.helpers.arrayElement(PROJECT_NOUN)}`;
    } while (usedNames.has(name));
    usedNames.add(name);

    // Unique 2–3 char key derived from the adjective.
    const adj = name.split(" ")[0].toUpperCase();
    let key = adj.slice(0, 2);
    let n = 2;
    while (usedKeys.has(key)) key = adj.slice(0, 2) + (n++).toString();
    usedKeys.add(key);

    const status = faker.helpers.weightedArrayElement(PROJECT_STATUS_WEIGHTS);
    const progress = progressForStatus(status);

    const lead = faker.helpers.arrayElement(
      leadPool.length ? leadPool : memberPool,
    );
    const memberCount = faker.number.int({ min: 3, max: 9 });
    const members = faker.helpers
      .arrayElements(memberPool, memberCount)
      .map((u) => u.id);
    // Seed the demo Owner into the first dozen projects so "My tasks" is alive.
    if (i < 12 && !members.includes("user-owner")) members.unshift("user-owner");
    if (!members.includes(lead.id)) members.unshift(lead.id);

    const budget = faker.number.int({ min: 20, max: 480 }) * 1000;
    // Spent tracks progress, with a slice of projects intentionally over budget.
    const burn = progress / 100 + faker.number.float({ min: -0.12, max: 0.18 });
    const spent = Math.round(budget * Math.max(0, Math.min(1.22, burn)));

    const startOffset = -faker.number.int({ min: 20, max: 210 });
    const span = faker.number.int({ min: 45, max: 170 });
    const dueOffset =
      status === "completed"
        ? startOffset + faker.number.int({ min: 30, max: span })
        : startOffset + span;

    projects.push({
      id: `proj-${(i + 1).toString().padStart(4, "0")}`,
      name,
      key,
      status,
      progress,
      leadUserId: lead.id,
      memberIds: [...new Set(members)],
      department: faker.helpers.arrayElement(DEPARTMENTS),
      budget,
      spent,
      startDate: isoFromOffsetDays(startOffset),
      dueDate: isoFromOffsetDays(dueOffset),
      velocity: generateVelocity(faker.number.int({ min: 20, max: 70 })),
    });
  }

  return projects;
}

function taskStatusFor(project: Project): TaskStatus {
  // Bias a task's status toward the parent project's lifecycle stage.
  if (project.status === "completed")
    return faker.helpers.weightedArrayElement([
      { value: "done", weight: 88 },
      { value: "in_review", weight: 8 },
      { value: "in_progress", weight: 4 },
    ]);
  return faker.helpers.weightedArrayElement([
    { value: "todo", weight: 34 },
    { value: "in_progress", weight: 32 },
    { value: "in_review", weight: 14 },
    { value: "done", weight: 20 },
  ]);
}

function generateTasks(projects: Project[]): Task[] {
  const tasks: Task[] = [];
  let counter = 0;

  for (const project of projects) {
    const taskCount = faker.number.int({ min: 8, max: 22 });
    for (let i = 0; i < taskCount; i++) {
      const status = taskStatusFor(project);
      const priority: TaskPriority = faker.helpers.weightedArrayElement([
        { value: "low" as TaskPriority, weight: 32 },
        { value: "medium" as TaskPriority, weight: 46 },
        { value: "high" as TaskPriority, weight: 22 },
      ]);

      // Unassigned only makes sense for not-yet-started work.
      let assigneeId: string | null = null;
      if (status !== "todo" || faker.datatype.boolean(0.6)) {
        assigneeId = faker.helpers.arrayElement(project.memberIds);
        // Keep the Owner visibly busy in their projects for the demo.
        if (
          project.memberIds.includes("user-owner") &&
          faker.datatype.boolean(0.28)
        ) {
          assigneeId = "user-owner";
        }
      }

      const dueDate =
        status === "done"
          ? null
          : faker.datatype.boolean(0.78)
            ? isoFromOffsetDays(faker.number.int({ min: -18, max: 70 }))
            : null;

      tasks.push({
        id: `task-${(++counter).toString().padStart(5, "0")}`,
        projectId: project.id,
        title: `${faker.helpers.arrayElement(TASK_VERB)} ${faker.hacker.noun()} ${faker.hacker.noun()}`,
        status,
        assigneeId,
        priority,
        dueDate,
        estimateHours: faker.number.int({ min: 1, max: 16 }),
      });
    }
  }

  return tasks;
}

/**
 * Give the fixed demo Employee a realistic workload: membership in a few active
 * projects and a spread of assigned tasks. Pure post-processing (mutates records
 * by id, no faker), so the rest of the generated data is unchanged.
 */
function assignDemoEmployee(projects: Project[], tasks: Task[]) {
  const targetProjects = projects.filter((p) => p.status === "active").slice(0, 3);
  for (const p of targetProjects) {
    if (!p.memberIds.includes(DEMO_EMPLOYEE.id)) {
      p.memberIds.push(DEMO_EMPLOYEE.id);
    }
  }

  // Cycle of statuses weighted toward open work so the dashboard has content.
  const statusCycle: TaskStatus[] = [
    "in_progress", "todo", "in_review", "in_progress", "todo", "done",
  ];
  let assigned = 0;
  for (const p of targetProjects) {
    const projectTasks = tasks.filter((t) => t.projectId === p.id).slice(0, 4);
    for (const t of projectTasks) {
      t.assigneeId = DEMO_EMPLOYEE.id;
      t.status = statusCycle[assigned % statusCycle.length];
      if (t.status !== "done" && !t.dueDate) {
        t.dueDate = isoFromOffsetDays(3 + (assigned % 10));
      }
      assigned += 1;
    }
  }
}

console.log("Seeding mock data...");
writeJson("organization.json", generateOrganization());
// Projects & tasks are built from the seeded users only, so the demo Employee
// stays out of the faker pools; it's woven in afterwards by assignDemoEmployee.
const seededUsers = generateUsers(120);
const seededProjects = generateProjects(40, seededUsers);
const seededTasks = generateTasks(seededProjects);
assignDemoEmployee(seededProjects, seededTasks);
// Insert the fixed demo Employee right after the Owner for users.json.
writeJson("users.json", [seededUsers[0], DEMO_EMPLOYEE, ...seededUsers.slice(1)]);
writeJson("projects.json", seededProjects);
writeJson("tasks.json", seededTasks);
console.log("Done.");
