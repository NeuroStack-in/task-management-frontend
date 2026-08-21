import { describe, expect, it } from "vitest";

import { selectablePeople, type UserMini } from "./lib";

/**
 * The project page derives **two** people-lists from one `userMap`, and conflating them has now
 * broken things in both directions:
 *
 *  - the whole directory offered as task assignees → the server rejects the save, because an
 *    assignee must be a project member;
 *  - only the project's members offered in Edit Project → you can no longer add anyone new, which
 *    is the entire purpose of that dialog.
 *
 * The derivations are one line each in `project-detail-page`, which is exactly why they were easy
 * to merge by accident. This pins the rule that separates them.
 */
function orgPeople(map: Record<string, UserMini>): UserMini[] {
  return selectablePeople(map);
}

function projectTeam(
  map: Record<string, UserMini>,
  memberIds: string[],
): UserMini[] {
  const ids = new Set(memberIds);
  return selectablePeople(map).filter((u) => ids.has(u.id));
}

const userMap: Record<string, UserMini> = {
  "u-a": { id: "u-a", name: "Ada Lovelace", jobTitle: "SDE" },
  "u-b": { id: "u-b", name: "Bo Chen", jobTitle: "QA" },
  "u-c": { id: "u-c", name: "Cy Diaz", jobTitle: "PM" },
  "u-gone": { id: "u-gone", name: "Removed person", jobTitle: "", removed: true },
};

describe("the project page's two people lists", () => {
  const onProject = ["u-a", "u-b"];

  it("offers the whole org when choosing who to add to a project", () => {
    expect(orgPeople(userMap).map((u) => u.id)).toEqual(["u-a", "u-b", "u-c"]);
  });

  it("offers only the project's own members as task assignees", () => {
    expect(projectTeam(userMap, onProject).map((u) => u.id)).toEqual(["u-a", "u-b"]);
  });

  /** The distinction only matters when they differ — a fixture where they don't proves nothing. */
  it("the two lists genuinely differ", () => {
    expect(orgPeople(userMap).length).toBeGreaterThan(
      projectTeam(userMap, onProject).length,
    );
  });

  /** A purged identity is unassignable and un-addable, whichever list you are looking at. */
  it("excludes deleted employees from both", () => {
    expect(orgPeople(userMap).some((u) => u.removed)).toBe(false);
    expect(
      projectTeam(userMap, [...onProject, "u-gone"]).some((u) => u.removed),
    ).toBe(false);
  });

  /** Before the project loads there are no member ids; that must not read as "everyone". */
  it("treats an unloaded project as an empty team, not the whole org", () => {
    expect(projectTeam(userMap, [])).toEqual([]);
  });
});
