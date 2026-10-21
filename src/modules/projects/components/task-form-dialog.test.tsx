/**
 * Esc, an outside click or the X closed the task form and lost everything typed (UX audit PROJ-19).
 * Now an edited form asks first; an untouched one still closes at once.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("../services/projects.service", () => ({
  presignTaskAttachment: vi.fn(),
  uploadFileToPresignedUrl: vi.fn(),
}));

import { TaskFormDialog } from "./task-form-dialog";

const members = [{ id: "u-me", name: "Me", jobTitle: "Engineer" }];

function show(onOpenChange = vi.fn()) {
  render(
    <TaskFormDialog
      mode="create"
      open
      onOpenChange={onOpenChange}
      projectId="p1"
      members={members}
      initial={{ assigneeIds: ["u-me"] }}
      onSubmit={vi.fn(() => Promise.resolve())}
    />,
  );
  return onOpenChange;
}

describe("TaskFormDialog — discard changes (PROJ-19)", () => {
  it("closes an untouched form straight away", async () => {
    const onOpenChange = show();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
  });

  it("asks before throwing away an edit, and keeps it when told to", async () => {
    const onOpenChange = show();
    await userEvent.type(screen.getByLabelText("Task title"), "Write the spec");
    await userEvent.keyboard("{Escape}");

    expect(await screen.findByText("Discard changes?")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    await waitFor(() => expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Task title")).toHaveValue("Write the spec");
  });

  it("closes the form once the discard is confirmed", async () => {
    const onOpenChange = show();
    await userEvent.type(screen.getByLabelText("Task title"), "Write the spec");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await userEvent.click(await screen.findByRole("button", { name: "Discard changes" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
