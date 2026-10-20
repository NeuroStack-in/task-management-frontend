import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// An owner: every permission is grantable, so the test is about the editor's own rules.
vi.mock("@/stores/auth.store", () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({
      user: { id: "u-owner", isOwner: true, roleId: "role-owner", perm: undefined },
    }),
}));
vi.mock("@/hooks/use-permissions", () => ({
  useCurrentRole: () => ({ id: "role-owner", scope: "org" }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// jsdom has no PointerEvent, which Base UI's Switch constructs on click.
if (typeof window.PointerEvent === "undefined") {
  (window as unknown as { PointerEvent: typeof MouseEvent }).PointerEvent = MouseEvent;
}

import { RoleEditorDialog } from "./role-editor-dialog";
import type { ApiPermissionCatalog, ApiRole } from "../services/roles.service";

const catalog: ApiPermissionCatalog = {
  groups: [
    {
      module: "activity",
      label: "Activity & Monitoring",
      permissions: [
        {
          id: "activity:read:self",
          module: "activity",
          label: "View own activity",
          implies: [],
        },
        {
          id: "screenshots:read",
          module: "activity",
          label: "View screenshots",
          implies: [],
        },
      ],
    },
    {
      module: "attendance",
      label: "Attendance",
      permissions: [
        {
          id: "attendance:read:self",
          module: "attendance",
          label: "View own attendance",
          implies: [],
        },
      ],
    },
  ],
  contributorOnly: ["time:track:self"],
};

const role: ApiRole = {
  id: "role-lead",
  name: "Team Lead",
  description: "Leads a team",
  system: false,
  is_owner: false,
  scope: "team",
  permissions: ["activity:read:self"],
};

function open(props: Partial<React.ComponentProps<typeof RoleEditorDialog>> = {}) {
  const onUpdate = vi.fn().mockResolvedValue(role);
  render(
    <RoleEditorDialog
      open
      onOpenChange={vi.fn()}
      role={role}
      catalog={catalog}
      existingRoles={[role]}
      onCreate={vi.fn()}
      onUpdate={onUpdate}
      memberCount={3}
      {...props}
    />,
  );
  return { onUpdate };
}

describe("RoleEditorDialog (UX audit PEOPLE-06)", () => {
  it("describes each permission and tags the sensitive ones", () => {
    open();
    expect(
      screen.getByText(/View every employee's screenshots and their AI analysis/),
    ).toBeInTheDocument();
    expect(screen.getByText("Personal data")).toBeInTheDocument();
    // The raw wire id is no longer the line under the label.
    expect(screen.queryByText("screenshots:read")).not.toBeInTheDocument();
  });

  it("'Select all' leaves sensitive permissions off", () => {
    open();
    fireEvent.click(screen.getByRole("button", { name: "Select all except sensitive" }));
    expect(screen.getByRole("switch", { name: /^View own attendance/ })).toBeChecked();
    expect(screen.getByRole("switch", { name: /^View screenshots/ })).not.toBeChecked();
  });

  it("says how many people a change reaches, and confirms a sensitive grant before saving", async () => {
    const { onUpdate } = open();
    fireEvent.click(screen.getByRole("switch", { name: /^View screenshots/ }));
    expect(screen.getByText("Changes access for 3 people.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    const confirm = await screen.findByRole("dialog", {
      name: "Give 3 people sensitive access?",
    });
    expect(within(confirm).getByText("View screenshots")).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();

    fireEvent.click(within(confirm).getByRole("button", { name: "Save and grant" }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(onUpdate.mock.calls[0][1].permissions).toContain("screenshots:read");
  });

  it("saves a non-sensitive change straight away", async () => {
    const { onUpdate } = open();
    fireEvent.click(screen.getByRole("switch", { name: /^View own attendance/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
  });
});
