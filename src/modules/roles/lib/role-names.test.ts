import { describe, expect, it } from "vitest";

import { cloneName, ROLE_NAME_MAX } from "./role-names";

const roles = (...names: string[]) => names.map((name) => ({ name }));

/** WP-321: names are unique server-side, so a fixed "Copy of X" failed every second clone. */
describe("cloneName", () => {
  it("uses 'Copy of X' when it is free", () => {
    expect(cloneName("Manager", roles("Manager"))).toBe("Copy of Manager");
  });

  it("numbers the next copy instead of colliding (case-insensitively)", () => {
    expect(cloneName("Manager", roles("Manager", "copy of manager"))).toBe("Copy of Manager (2)");
    expect(cloneName("Manager", roles("Copy of Manager", "Copy of Manager (2)"))).toBe(
      "Copy of Manager (3)",
    );
  });

  it("stays within the editor's name limit, suffix included", () => {
    const long = "Regional operations and logistics lead";
    const first = cloneName(long, []);
    expect(first.length).toBeLessThanOrEqual(ROLE_NAME_MAX);
    const second = cloneName(long, roles(first));
    expect(second.length).toBeLessThanOrEqual(ROLE_NAME_MAX);
    expect(second.endsWith(" (2)")).toBe(true);
  });
});
