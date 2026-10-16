import type { PdfTextFor } from "@/modules/employees/lib/pdf-text";
import type { ReportDoc as ReportDocType } from "@/modules/employees/lib/report-doc";
import type { Project, Task, TaskStatus } from "./types";
import {
  PROJECT_STATUS_META,
  TASK_PRIORITY_META,
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
} from "./types";
import { daysUntil, isTaskOverdue, taskCounts, taskTotals, type UserMini } from "./lib";

/**
 * Generate and download the project report — the same document as the employee report (accent
 * band, headline cards, sections, striped tables, numbered pages), which the owner asked every PDF
 * to follow (2026-10-16). It used to be a single page of hand-placed lines.
 *
 * jspdf and the report layout are imported on demand so they stay out of the main bundle. Runs in a
 * click handler only. Resolves to the file name; rejects if jspdf can't load, so the caller can say
 * so.
 *
 * Every string goes through the `PdfText` writer, so a project or person name in any script prints
 * (QA audit 2026-10-08, WP-507).
 */
export async function generateProjectReportPdf(
  project: Project,
  tasks: Task[],
  userMap: Record<string, UserMini>,
): Promise<string> {
  const [{ buildPdf }, { ReportDoc }] = await Promise.all([
    import("@/modules/employees/lib/pdf-text"),
    import("@/modules/employees/lib/report-doc"),
  ]);
  // `key` is optional on the server; a file named "-project-report.pdf" reads as a bug.
  const day = new Date().toISOString().slice(0, 10);
  const filename = `${project.key || "project"}-report-${day}.pdf`;
  const doc = await buildPdf((text) =>
    drawProjectReport(ReportDoc, text, project, tasks, userMap),
  );
  doc.save(filename);
  return filename;
}

const dash = "—";

/** "01 Oct 2026" — reports are kept, so dates carry their year. */
function fullDay(iso: string | null | undefined): string {
  if (!iso) return dash;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
}

/** "20 Sep 26" — the compact form for a table column. */
function shortDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString([], { day: "2-digit", month: "short", year: "2-digit" });
}

const ROLE_LABEL: Record<string, string> = {
  manager: "Manager",
  lead: "Lead",
  member: "Member",
};

function drawProjectReport(
  ReportDoc: typeof ReportDocType,
  text: PdfTextFor,
  project: Project,
  tasks: Task[],
  userMap: Record<string, UserMini>,
) {
  const now = new Date();
  const stamp = now.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  const doc = new ReportDoc(text, {
    title: project.name,
    kind: "project report",
    stamp: `Generated ${stamp}`,
  });

  const name = (uid: string | undefined) =>
    uid ? (userMap[uid]?.name ?? "Unknown member") : dash;
  const counts = taskCounts(tasks);
  // The same numbers the project page shows — see `taskTotals`. Progress is **weighted** by column
  // (a task in review counts most of the way), and "signed off" counts only reviewed work, so the
  // two answer different questions and are printed as such. The old report put them in one line —
  // "68% (0 of 5 tasks completed)" — which read as a contradiction.
  const totals = taskTotals(tasks);
  const overdue = tasks.filter((t) => isTaskOverdue(t)).length;
  const daysLeft = project.dueDate ? daysUntil(project.dueDate) : null;
  const deadlineHint =
    daysLeft == null
      ? "no deadline"
      : daysLeft < 0
        ? `${-daysLeft} days overdue`
        : daysLeft === 0
          ? "due today"
          : `${daysLeft} days left`;

  // ── headline numbers ──
  doc.cards([
    {
      label: "Progress",
      value: `${totals.progressPct}%`,
      hint: "of work done (weighted)",
    },
    {
      label: "Signed off",
      value: `${totals.completed} of ${totals.deliverable}`,
      hint: "tasks reviewed and done",
    },
    {
      label: "Open tasks",
      value: String(totals.open),
      hint: overdue ? `${overdue} overdue` : "none overdue",
    },
    { label: "Deadline", value: fullDay(project.dueDate), hint: deadlineHint },
  ]);

  // ── identity ──
  doc.section("Overview", project.key ? `Key ${project.key}` : undefined);
  doc.pairs([
    ["Project", project.name],
    ["Key", project.key || dash],
    ["Status", PROJECT_STATUS_META[project.status].label],
    ["Billable", project.billable ? "Billable" : "Non-billable"],
    ["Manager", name(project.managerId)],
    ["Lead", project.leadUserId ? name(project.leadUserId) : "Not set"],
    ["Department", project.department || dash],
    [
      "Team size",
      `${project.memberIds.length} ${project.memberIds.length === 1 ? "member" : "members"}`,
    ],
    ["Start", fullDay(project.startDate)],
    // The end date is optional on the server (WP-305).
    ["Deadline", project.dueDate ? fullDay(project.dueDate) : "No end date"],
    ["Project ID", project.id],
    ["", ""],
  ]);
  if (project.description?.trim()) {
    doc.paragraph(project.description.trim());
  }

  // ── where the work stands ──
  doc.section(
    "Task breakdown",
    `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`,
  );
  doc.table(
    doc.fitColumns([
      { header: "Status", width: 60 },
      { header: "Tasks", width: 30, align: "right" },
      { header: "Share", width: 30, align: "right" },
      { header: "What it means", width: 100 },
    ]),
    TASK_STATUS_ORDER.map((s) => [
      TASK_STATUS_META[s].label,
      counts[s],
      tasks.length ? `${Math.round((counts[s] / tasks.length) * 100)}%` : dash,
      STATUS_MEANING[s],
    ]),
  );

  // ── every task ──
  const order = new Map(TASK_STATUS_ORDER.map((s, i) => [s, i]));
  const sorted = [...tasks].sort((a, b) => {
    const byStatus = (order.get(a.status) ?? 0) - (order.get(b.status) ?? 0);
    if (byStatus) return byStatus;
    return (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
  });
  doc.section("Tasks", "by status, then due date");
  doc.table(
    doc.fitColumns([
      { header: "Task", width: 56 },
      { header: "Status", width: 22 },
      { header: "Priority", width: 18 },
      // Every name, comma-joined: printing only the first would make a shared task look like one
      // person's on paper.
      { header: "Assignees", width: 44 },
      { header: "Due", width: 23, align: "right" },
      { header: "Review", width: 15, align: "right" },
    ]),
    sorted.map((t) => [
      t.title,
      TASK_STATUS_META[t.status].label,
      TASK_PRIORITY_META[t.priority].label,
      t.assignees.length
        ? t.assignees.map((a) => name(a.userId)).join(", ")
        : "Unassigned",
      t.dueDate ? `${shortDay(t.dueDate)}${isTaskOverdue(t) ? " !" : ""}` : dash,
      t.status === "done" && t.review ? `${t.review.rating}/5` : dash,
    ]),
    { empty: "This project has no tasks yet." },
  );
  if (overdue) doc.note(`! marks a task past its due date that isn't done (${overdue}).`);

  // ── who signed what off ──
  const reviewed = sorted.filter((t) => t.status === "done" && t.review);
  if (reviewed.length) {
    doc.section("Sign-offs", "reviewed by the project lead or manager");
    doc.table(
      doc.fitColumns([
        { header: "Task", width: 80 },
        { header: "Reviewed by", width: 50 },
        { header: "Rating", width: 20, align: "right" },
        { header: "Note", width: 70 },
      ]),
      reviewed.map((t) => [
        t.title,
        t.review?.reviewer_name || dash,
        `${t.review?.rating}/5`,
        t.review?.note || dash,
      ]),
    );
  }

  // ── the team ──
  doc.section("Team", `${project.memberIds.length} on the project`);
  const roleOf = (uid: string) =>
    uid === project.managerId
      ? "manager"
      : uid === project.leadUserId
        ? "lead"
        : "member";
  const rank: Record<string, number> = { manager: 0, lead: 1, member: 2 };
  doc.table(
    doc.fitColumns([
      { header: "Member", width: 70 },
      { header: "Role", width: 30 },
      { header: "Assigned", width: 30, align: "right" },
      { header: "Open", width: 25, align: "right" },
      { header: "Overdue", width: 25, align: "right" },
      { header: "Done", width: 25, align: "right" },
    ]),
    [...project.memberIds]
      .sort((a, b) => rank[roleOf(a)] - rank[roleOf(b)] || name(a).localeCompare(name(b)))
      .map((uid) => {
        const mine = tasks.filter((t) => t.assignees.some((a) => a.userId === uid));
        const open = mine.filter((t) => t.status !== "done" && t.status !== "blocked");
        return [
          name(uid),
          ROLE_LABEL[roleOf(uid)],
          mine.length,
          open.length,
          open.filter((t) => isTaskOverdue(t)).length,
          mine.filter((t) => t.status === "done").length,
        ];
      }),
    { empty: "Nobody is on this project yet." },
  );

  doc.finish(
    `WorkPulse · ${project.name} · ${stamp} · progress: to do 0%, in progress 35%, ` +
      "in review 90%, done 100%; blocked left out",
  );
  return doc.d;
}

/** One line per column, so the breakdown reads on its own — the same rules the board explains. */
const STATUS_MEANING: Record<TaskStatus, string> = {
  todo: "Not started",
  in_progress: "Being worked on",
  in_review: "Finished, waiting for the lead or manager to sign off",
  done: "Reviewed and signed off",
  blocked: "Parked by the lead or manager; not counted in progress",
};
