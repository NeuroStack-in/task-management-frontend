import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiDepartment, ApiEmployee } from "@/modules/employees/services/employees.service";

const updateEmployee = vi.fn();
vi.mock("@/modules/employees/services/employees.service", () => ({
  updateEmployee: (...a: unknown[]) => updateEmployee(...a),
}));
vi.mock("@/components/shared/user-avatar", () => ({ UserAvatar: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { DepartmentMembers } from "./department-members";

const eng: ApiDepartment = { id: "d-eng", name: "Engineering" } as ApiDepartment;
const design: ApiDepartment = { id: "d-des", name: "Design" } as ApiDepartment;
const person = (user_id: string, name: string): ApiEmployee =>
  ({ user_id, name, department_id: eng.id, status: "active" }) as ApiEmployee;

describe("DepartmentMembers", () => {
  beforeEach(() => updateEmployee.mockReset().mockResolvedValue({}));

  it("moves one person to the department picked from their menu", async () => {
    const onMoved = vi.fn();
    render(
      <DepartmentMembers
        department={eng}
        members={[person("u1", "Asha"), person("u2", "Ravi")]}
        departments={[eng, design]}
        canMove
        onMoved={onMoved}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Change Asha's department" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Design" }));
    await waitFor(() => expect(onMoved).toHaveBeenCalledWith("u1", "d-des"));
    expect(updateEmployee).toHaveBeenCalledWith("u1", { department_id: "d-des" });
    expect(updateEmployee).toHaveBeenCalledTimes(1);
  });

  it("offers no move controls without employees:manage, and says when a department is empty", () => {
    const { rerender } = render(
      <DepartmentMembers
        department={eng}
        members={[person("u1", "Asha")]}
        departments={[eng, design]}
        canMove={false}
        onMoved={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /department/i })).toBeNull();
    rerender(
      <DepartmentMembers department={eng} members={[]} departments={[eng, design]} canMove onMoved={vi.fn()} />,
    );
    expect(screen.getByText(/No one is in Engineering yet/)).toBeInTheDocument();
  });
});
