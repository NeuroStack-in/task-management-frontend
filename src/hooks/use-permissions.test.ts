import { describe, it, expect } from "vitest";
import { resolveRole } from "./use-permissions";
import { WILDCARD } from "@/constants/permissions";

/**
 * The server's bitset is the source of truth for the UI gate. These pin the resolution ORDER —
 * the bug they guard against is silent: the UI renders a menu the server refuses, or hides a page
 * it allows, and nothing fails until a user clicks.
 */

/**
 * Build a `perm` claim from bit indexes, the way the pre-token trigger stamps it.
 *
 * `BigInt(1)` rather than the `1n` literal: the project pins a pre-ES2020 target, so literals are a
 * `tsc` error even though vitest's esbuild happily transpiles them. `lib/permission-bits.ts` uses
 * the call form for the same reason.
 */
const perm = (...bits: number[]) =>
  bits
    .reduce((acc, b) => acc | (BigInt(1) << BigInt(b)), BigInt(0))
    .toString();

const user = (over: Record<string, unknown> = {}) =>
  ({ roleId: "role-admin", isOwner: false, ...over }) as never;

describe("resolveRole", () => {
  it("takes permissions from the bitset for a SYSTEM role, not the hardcoded catalog", () => {
    // An org that trimmed its Admin role down to just the directory. The catalog entry lists
    // dozens of ids; only the claim's two may survive.
    const role = resolveRole(user({ perm: perm(10, 11) }), []);
    expect(role?.permissions).toContain("employees:view");
    expect(role?.permissions).toContain("employees:manage");
    expect(role?.permissions).not.toContain("billing:view");
    expect(role?.permissions).not.toContain("roles:manage");
  });

  it("keeps the catalog's display name so an Admin doesn't render as 'Custom role'", () => {
    expect(resolveRole(user({ perm: perm(10) }), [])?.name).toBe("Admin");
  });

  it("never grants payroll to Admin off the wire — the server grants no payroll bit", () => {
    // wp-contracts::roles::admin() holds no PayrollRead/PayrollManage. Bit 50/51 absent ⇒ no ids.
    const role = resolveRole(user({ perm: perm(10, 11, 70, 72) }), []);
    expect(role?.permissions).not.toContain("payroll:view");
    expect(role?.permissions).not.toContain("payroll:manage");
  });

  it("grants Employee reports:view, which the server does grant", () => {
    // wp-contracts::roles::employee() holds ReportsRead (bit 60).
    const role = resolveRole(user({ roleId: "role-employee", perm: perm(60) }), []);
    expect(role?.permissions).toContain("reports:view");
  });

  it("maps the three bits that had no frontend id", () => {
    const role = resolveRole(user({ perm: perm(36, 120, 121) }), []);
    expect(role?.permissions).toContain("attendance:manage"); // bit 36
    expect(role?.permissions).toContain("integrations:view"); // bit 120
    expect(role?.permissions).toContain("integrations:manage"); // bit 121
  });

  it("gives Owner the wildcard — is_owner lives outside the bitset", () => {
    // An Owner's claim is nearly empty; deriving from it alone would strip the console.
    const role = resolveRole(user({ roleId: "role-owner", isOwner: true, perm: "0" }), []);
    expect(role?.permissions).toContain(WILDCARD);
  });

  it("still gives Owner a contributor-only id when the claim carries it", () => {
    // The server's one carve-out: is_owner bypasses every bit EXCEPT 110–119.
    const role = resolveRole(
      user({ roleId: "role-owner", isOwner: true, perm: perm(110) }),
      [],
    );
    expect(role?.permissions).toContain("time-tracking:self");
  });

  it("falls back to the catalog when the session predates the bitset claim", () => {
    const role = resolveRole(user({ perm: undefined }), []);
    expect(role?.name).toBe("Admin");
    expect(role?.permissions.length).toBeGreaterThan(0);
  });
});
