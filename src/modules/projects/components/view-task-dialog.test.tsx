import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The dialog fetches a presigned URL per attachment on click; nothing here clicks one, but the
// import must not reach the network at module load.
vi.mock("../services/projects.service", () => ({
  getAttachmentDownloadUrl: vi.fn(),
}));

import { ViewTaskDialog } from "./view-task-dialog";
import type { Task } from "../types";
import type { UserMini } from "../lib";

const userMap: Record<string, UserMini> = {
  "u-giri": { id: "u-giri", name: "Giri dharan", jobTitle: "SDE" },
  "u-kishore": { id: "u-kishore", name: "Kishore M", jobTitle: "SDE-LEAD" },
  "u-admin": { id: "u-admin", name: "NeuroStack Admin", jobTitle: "Owner" },
};

function task(over: Partial<Task> = {}): Task {
  return {
    id: "k1",
    projectId: "p1",
    title: "Testflow Monitoring",
    description: "",
    status: "todo",
    assignees: [
      { userId: "u-giri", assignedBy: "u-admin", assignedAt: 1_755_734_400_000 },
      { userId: "u-kishore", assignedBy: "u-admin", assignedAt: 1_755_734_400_000 },
    ],
    priority: "medium",
    dueDate: "2026-08-31",
    estimateHours: 4,
    attachments: [],
    subtaskProgress: { total: 0, done: 0 },
    ...over,
  };
}

function show(t: Task) {
  return render(
    <ViewTaskDialog
      task={t}
      projectId="p1"
      open
      onOpenChange={vi.fn()}
      userMap={userMap}
    />,
  );
}

describe("ViewTaskDialog", () => {
  it("names every assignee and who put them there", () => {
    show(task());

    expect(screen.getByText("Giri dharan")).toBeInTheDocument();
    expect(screen.getByText("Kishore M")).toBeInTheDocument();
    // One line per assignee, each naming the assigner — not a single shared line.
    expect(screen.getAllByText(/Assigned by NeuroStack Admin/)).toHaveLength(2);
    expect(screen.getByText("Assignees")).toBeInTheDocument();
  });

  /** Singular vs plural: "Assignees" over one person reads as a bug. */
  it("uses the singular label for one assignee", () => {
    show(task({ assignees: [{ userId: "u-giri", assignedBy: "", assignedAt: 0 }] }));
    expect(screen.getByText("Assignee")).toBeInTheDocument();
  });

  /**
   * Unassigned is a real state now — the task is offered to the whole project — so it gets a
   * sentence, not a blank.
   */
  /**
   * A task with nobody on it can no longer be *created* (owner decision, 2026-09-01), but the panel
   * still has to render one: rows predating the invariant, and the one departure case where a last
   * assignee leaves a project whose manager cannot inherit. The copy used to offer it to "anyone on
   * this project", which was the unclaimed picker — retired with the state itself — so it now names
   * who can actually act on it.
   */
  it("explains an unassigned legacy task rather than leaving the field empty", () => {
    show(task({ assignees: [] }));
    expect(
      screen.getByText(/a lead or manager needs to assign it/),
    ).toBeInTheDocument();
  });

  /**
   * Nothing is invented for an assignment made before the server recorded who made it. Saying
   * "Assigned by —" or guessing the creator would be worse than saying nothing.
   */
  it("says nothing about who assigned when that was never recorded", () => {
    show(task({ assignees: [{ userId: "u-giri", assignedBy: "", assignedAt: 0 }] }));
    expect(screen.queryByText(/Assigned by/)).not.toBeInTheDocument();
  });

  it("renders the empty states for description and attachments", () => {
    show(task());
    expect(screen.getByText("No description")).toBeInTheDocument();
    expect(screen.getByText("No attachments")).toBeInTheDocument();
  });
});
