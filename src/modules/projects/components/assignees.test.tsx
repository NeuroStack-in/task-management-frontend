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

  it("selects everyone at once, without disturbing who was already picked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AssigneePicker members={members(3)} value={["u1"]} onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByText("Select all"));

    // The existing pick keeps its position — it is served as the legacy single assignee, so
    // "select all" must not quietly promote someone else to first.
    expect(onChange).toHaveBeenCalledWith(["u1", "u0", "u2"]);
  });

  it("offers no select-all once everyone is already chosen", async () => {
    const user = userEvent.setup();
    render(
      <AssigneePicker members={members(3)} value={["u0", "u1", "u2"]} onChange={vi.fn()} />,
    );

    await user.click(screen.getByRole("button"));

    expect(await screen.findByText("Clear")).toBeInTheDocument();
    expect(screen.queryByText("Select all")).not.toBeInTheDocument();
  });

  /**
   * With a search active the control must promise only what it will do. Selecting "all" while three
   * of twelve are listed has to mean those three — assigning the nine nobody looked at would be a
   * silent act on invisible data.
   */
  it("selects only the people a search is showing, and says how many", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<AssigneePicker members={members(12)} value={[]} onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    await user.type(await screen.findByPlaceholderText("Search members…"), "Person 1");

    // Person 1, and Person 10 and 11 — the three whose names contain "Person 1".
    await user.click(await screen.findByText("Select all 3"));
    expect(onChange).toHaveBeenCalledWith(["u1", "u10", "u11"]);
  });
});
