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
  type UserMini,
} from "./lib";

/**
 * Generate and download a one-page PDF project report (text-based, no external
 * fonts — reliable across browsers). jspdf is imported on demand so it stays
 * out of the main bundle. Runs in a click handler only.
 */
export async function generateProjectReportPdf(
  project: Project,
  tasks: Task[],
  userMap: Record<string, UserMini>,
) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const left = 48;
  const right = pageW - 48;
  let y = 56;

  const counts = taskCounts(tasks);
  const done = counts.done;
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

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(20);
  doc.text(project.name, left, y);
  line(20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(
    `${project.key}  ·  Project ID: ${project.id}  ·  ${PROJECT_STATUS_META[project.status].label}`,
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
    doc.text(label, left, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(30);
    doc.text(value, left + 130, y);
    line(18);
  };

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(20);
  doc.text("Overview", left, y);
  line(20);

  kv("Department", project.department);
  kv("Lead", lead);
  kv("Manager", manager);
  kv("Timeline", `${formatDate(project.startDate)} – ${formatDate(project.dueDate)}`);
  kv("Progress", `${project.progress}%  (${done} of ${tasks.length} tasks done)`);
  kv("Team size", `${project.memberIds.length} members`);
  line(4);
  rule();

  // Task breakdown
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text("Task breakdown", left, y);
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
  doc.text("Tasks", left, y);
  line(20);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(120);
  doc.text("Title", left, y);
  doc.text("Status", left + 250, y);
  doc.text("Priority", left + 350, y);
  doc.text("Assignee", left + 430, y);
  line(14);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  const pageH = doc.internal.pageSize.getHeight();
  for (const t of tasks) {
    if (y > pageH - 60) {
      doc.addPage();
      y = 56;
    }
    const title =
      t.title.length > 46 ? `${t.title.slice(0, 45)}…` : t.title;
    const assignee = t.assigneeId
      ? (userMap[t.assigneeId]?.name ?? "—")
      : "Unassigned";
    doc.text(title, left, y);
    doc.text(TASK_STATUS_META[t.status].label, left + 250, y);
    doc.text(TASK_PRIORITY_META[t.priority].label, left + 350, y);
    doc.text(
      assignee.length > 18 ? `${assignee.slice(0, 17)}…` : assignee,
      left + 430,
      y,
    );
    line(14);
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    "WorkPulse — generated from session data",
    left,
    pageH - 28,
  );

  doc.save(`${project.key}-project-report.pdf`);
}
