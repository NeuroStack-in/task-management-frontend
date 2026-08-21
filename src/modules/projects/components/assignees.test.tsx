import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AssigneePicker } from "./assignees";
import type { UserMini } from "../lib";

/**
 * Opening the picker is the whole interaction, and it is the one thing a type-check cannot cover:
 * `DropdownMenuCheckboxItem` had never been rendered anywhere in the app before this component, so
 * the menu's contents are exercised here for the first time. A crash on open takes the whole project
 * page down through the error boundary — which is exactly what shipped.
 */
function members(n: number): UserMini[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `u${i}`,
    name: `Person ${i}`,
    jobTitle: "Engineer",
  }));
}

describe("AssigneePicker", () => {
  it("opens without crashing and lists the project's members", async () => {
    const user = userEvent.setup();
    render(<AssigneePicker members={members(3)} value={[]} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button"));

    expect(await screen.findByText("Person 0")).toBeInTheDocument();
    expect(screen.getByText("Person 2")).toBeInTheDocument();
  });

  /** Above the threshold the menu also renders a search `Input`, a different code path. */
  it("opens without crashing when the member list is long enough to be searchable", async () => {
    const user = userEvent.setup();
    render(<AssigneePicker members={members(9)} value={[]} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button"));

    expect(await screen.findByPlaceholderText("Search members…")).toBeInTheDocument();
  });

  it("reports the picked person and keeps earlier picks", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AssigneePicker members={members(3)} value={["u0"]} onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByText("Person 1"));

    // Appended, not replaced: the first id is served as the legacy single assignee, so the order
    // someone picked in has to survive.
    expect(onChange).toHaveBeenCalledWith(["u0", "u1"]);
  });
});
