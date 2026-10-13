import type { jsPDF } from "jspdf";
import { buildPdf, graphemes, type PdfText } from "@/modules/employees/lib/pdf-text";
import type { Project, Task } from "./types";
import {
  PROJECT_STATUS_META,
  TASK_PRIORITY_META,
  TASK_STATUS_META,
  TASK_STATUS_ORDER,
} from "./types";
import {
  formatDate,
  taskCounts,
  taskTotals,
  type UserMini,
} from "./lib";

/**
 * Generate and download a one-page PDF project report. jspdf is imported on demand so it stays
 * out of the main bundle. Runs in a click handler only. Resolves to the file name; rejects if
 * jspdf can't load, so the caller can say so.
 *
 * Every string goes through the `PdfText` writer, so a project or person name in any script prints
 * (QA audit 2026-10-08, WP-507): a report with text outside Latin-1 first loads a Unicode font
 * from `/fonts/`; a Latin-only one renders once, with the built-in Helvetica, as before.
 */
export async function generateProjectReportPdf(
  project: Project,
  tasks: Task[],
  userMap: Record<string, UserMini>,
): Promise<string> {
  const { jsPDF } = await import("jspdf");
  // `key` is optional on the server; a file named "-project-report.pdf" reads as a bug.
  const filename = `${project.key || "project"}-report.pdf`;
  const doc = await buildPdf((text) => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    drawProjectReport(doc, text(doc), project, tasks, userMap);
    return doc;
  });
  doc.save(filename);
  return filename;
}

/** At most `max` characters, counted as a reader sees them — so a cut never splits a conjunct. */
function clip(text: string, max: number): string {
  const chars = graphemes(text);
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : text;
}

function drawProjectReport(
  doc: jsPDF,
  t: PdfText,
  project: Project,
  tasks: Task[],
  userMap: Record<string, UserMini>,
) {
  const pageW = doc.internal.pageSize.getWidth();
  const left = 48;
  const right = pageW - 48;
  let y = 56;

  const counts = taskCounts(tasks);
  // The same numbers the project page shows — see `taskTotals`. This line used to read
  // `${project.progress}% (${counts.done} of ${tasks.length} tasks done)`, which mixed three
  // different definitions: a server percentage that counts signed-off work, a `done`-only count,
  // and a total that included closed and blocked. On a real board it printed "67% (0 of 5)".
  const totals = taskTotals(tasks);
  const progressPct = totals.progressPct;
  const lead = userMap[project.leadUserId]?.name ?? "—";
  const manager = project.managerId
    ? (userMap[project.managerId]?.name ?? "—")
    : "—";

  const line = (gap = 16) => (y += gap);
  const rule = () => {
    doc.setDrawColor(220);
    doc.line(left, y, right, y);
    line(18);
  };

  // Title — wrapped: a long project name ran off the page (QA audit 2026-10-08, WP-507).
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(20);
  const titleLines = t.wrap(project.name, right - left);
  t.text(titleLines, left, y);
  line(20 + 24 * (titleLines.length - 1));

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  t.text(
    [
      ...(project.key ? [project.key] : []),
      `Project ID: ${project.id}`,
      PROJECT_STATUS_META[project.status].label,
    ].join("  ·  "),
    left,
    y,
  );
  line(10);
  rule();

  // Overview key/values
  const kv = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(90);
    t.text(label, left, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30);
    t.text(value, left + 130, y);
    line(18);
  };

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20);
  t.text("Overview", left, y);
  line(20);

  kv("Department", project.department || "—");
  kv("Lead", lead);
  kv("Manager", manager);
  kv(
    "Timeline",
    // The end date is optional on the server (WP-305).
    `${formatDate(project.startDate)} – ${project.dueDate ? formatDate(project.dueDate) : "no end date"}`,
  );
  kv(
    "Progress",
    `${progressPct}%  (${totals.completed} of ${totals.deliverable} tasks completed)`,
  );
  kv("Remaining", `${totals.open} open of ${totals.total} live tasks`);
  kv("Team size", `${project.memberIds.length} members`);
  line(4);
  rule();

  // Task breakdown
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20);
  t.text("Task breakdown", left, y);
  line(20);

  for (const s of TASK_STATUS_ORDER) {
    kv(TASK_STATUS_META[s].label, String(counts[s]));
  }
  line(4);
  rule();

  // Task list (first ~22 to fit a page)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20);
  t.text("Tasks", left, y);
  line(20);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(120);
  t.text("Title", left, y);
  t.text("Status", left + 250, y);
  t.text("Priority", left + 350, y);
  t.text("Assignee", left + 430, y);
  line(14);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  const pageH = doc.internal.pageSize.getHeight();
  for (const task of tasks) {
    if (y > pageH - 60) {
      doc.addPage();
      y = 56;
    }
    // Also held to its column by width: a title in a wider script than Latin overran Status.
    const title = t.fit(clip(task.title, 46), 244);
    // Every name, comma-joined, then truncated by the same rule as a single one. Printing only
    // the first would make a shared task look like one person's on paper.
    const assignee = task.assignees.length
      ? task.assignees.map((a) => userMap[a.userId]?.name ?? "—").join(", ")
      : "Unassigned";
    t.text(title, left, y);
    t.text(TASK_STATUS_META[task.status].label, left + 250, y);
    t.text(TASK_PRIORITY_META[task.priority].label, left + 350, y);
    t.text(clip(assignee, 18), left + 430, y);
    line(14);
  }

  // Footer. It said "generated from session data" — the mock layer this predates; the figures are
  // the live project as loaded on the page.
  doc.setFontSize(8);
  doc.setTextColor(150);
  t.text(
    `Generated by WorkPulse on ${new Date().toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    })}`,
    left,
    pageH - 28,
  );
}
