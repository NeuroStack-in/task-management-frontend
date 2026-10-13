import { describe, expect, it } from "vitest";

import { SYSTEM_ROLES } from "./roles";
import { ALL_PERMISSIONS } from "./permissions";
import { permissionsFromBitset } from "@/lib/permission-bits";

/**
 * The static Admin/Employee lists are the fallback for a session whose token predates the `perm`
 * claim. They must say exactly what the server's baseline says, decoded the same way a live token
 * is — otherwise the fallback path shows menus the server refuses or hides pages it allows
 * (QA audit 2026-10-08, WP-511).
 */

/** `wp-contracts::roles::Role::admin()` — bit indexes from `permissions.rs`. */
const ADMIN_BITS = [
  0, 1, 2, 3, 4, 5, 6, 10, 11, 12, 13, 20, 21, 22, 30, 31, 32, 33, 34, 35, 36, 40, 41, 42, 52, 53,
  60, 61, 62, 63, 64, 65, 70, 71, 72, 73, 80, 90, 91, 100, 101, 120, 121,
];

/** `wp-contracts::roles::Role::employee()`. */
const EMPLOYEE_BITS = [0, 20, 30, 33, 40, 60, 65, 90, 91, 100, 110];

const claim = (bits: number[]) =>
  bits.reduce((acc, b) => acc | (BigInt(1) << BigInt(b)), BigInt(0)).toString();

const sorted = (ids: readonly string[]) => [...new Set(ids)].sort();

describe("static system roles mirror the server baseline", () => {
  it.each([
    ["role-admin", ADMIN_BITS],
    ["role-employee", EMPLOYEE_BITS],
  ] as const)("%s equals its bits decoded", (id, bits) => {
    const role = SYSTEM_ROLES.find((r) => r.id === id);
    expect(sorted(role?.permissions ?? [])).toEqual(sorted(permissionsFromBitset(claim(bits)) ?? []));
  });

  it("every id a bit can light is in the catalog", () => {
    const catalog = new Set(ALL_PERMISSIONS.map((p) => p.id));
    const all = permissionsFromBitset(claim([...Array(128).keys()])) ?? [];
    expect(all.filter((id) => !catalog.has(id))).toEqual([]);
  });
});
