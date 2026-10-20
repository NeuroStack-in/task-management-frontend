import { describe, expect, it } from "vitest";
import type { ApiRole } from "../services/roles.service";
import { roleChange, scopeLabel } from "./role-change";

const role = (id: string, scope: string, permissions: string[]): ApiRole => ({
  id,
  name: id,
  description: "",
  system: false,
  is_owner: false,
  scope,
  permissions,
});

describe("roleChange", () => {
  const employee = role("emp", "self", ["activity:read:self", "time:track:self", "leave:request"]);
  const admin = role("admin", "org", ["activity:read:org", "screenshots:read", "roles:manage", "leave:request"]);

  it("names what is gained and lost, sensitive ones apart", () => {
    const c = roleChange(employee, admin);
    expect(c.added.sort()).toEqual(["activity:read:org", "roles:manage", "screenshots:read"]);
    expect(c.removed.sort()).toEqual(["activity:read:self", "time:track:self"]);
    expect(c.sensitiveAdded.sort()).toEqual(["activity:read:org", "roles:manage", "screenshots:read"]);
    // Being monitored is flagged sensitive, so losing it is named too.
    expect(c.sensitiveRemoved).toEqual(["time:track:self"]);
    expect(c.scope).toEqual({ from: "self", to: "org" });
    expect(c.widens).toBe(true);
    expect(c.same).toBe(false);
  });

  it("a pure downgrade does not widen", () => {
    const c = roleChange(admin, role("viewer", "self", ["leave:request"]));
    expect(c.added).toEqual([]);
    expect(c.widens).toBe(false);
    expect(c.scope).toEqual({ from: "org", to: "self" });
  });

  it("a wider scope alone widens", () => {
    const c = roleChange(role("a", "self", ["x"]), role("b", "team", ["x"]));
    expect(c.added).toEqual([]);
    expect(c.widens).toBe(true);
  });

  it("identical sets are 'same'", () => {
    const c = roleChange(role("a", "team", ["x", "y"]), role("b", "team", ["y", "x"]));
    expect(c.same).toBe(true);
    expect(c.widens).toBe(false);
  });

  it("an unknown current role reports everything as gained and nothing lost", () => {
    const c = roleChange(null, admin);
    expect(c.fromUnknown).toBe(true);
    expect(c.added.length).toBe(admin.permissions.length);
    expect(c.removed).toEqual([]);
    expect(c.scope).toBeNull();
    expect(c.same).toBe(false);
  });

  it("labels scopes in plain words, passing unknown values through", () => {
    expect(scopeLabel("org")).toBe("Everyone's data");
    expect(scopeLabel("galaxy")).toBe("galaxy");
  });
});
