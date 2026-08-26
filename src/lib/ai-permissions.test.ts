import { describe, expect, it } from "vitest";

import { permissionsFromBitset } from "./permission-bits";
import { canAccess } from "./rbac";
import { SYSTEM_ROLES } from "@/constants/roles";
import type { Role } from "@/types/rbac";

/**
 * The assistant is gated by two *different* server bits that the frontend used to collapse into
 * one id — so granting an Employee the chat assistant would also have opened every AI-summary
 * surface. These pin the split.
 *
 *   bit 62  AiInsightsRead  → `ai:view`  — the AI summaries and the attention list
 *   bit 65  AiAssistantUse  → `ai:use`   — talking to the chat assistant
 */
const AI_INSIGHTS = 62;
const AI_ASSISTANT = 65;

function idsFor(...bits: number[]): string[] {
  // `BigInt(1)` rather than the `1n` literal: tsconfig targets below ES2020, where the literal
  // form is a compile error even though the runtime has BigInt.
  const mask = bits.reduce(
    (acc, b) => acc | (BigInt(1) << BigInt(b)),
    BigInt(0),
  );
  return permissionsFromBitset(mask.toString()) ?? [];
}

function role(permissions: string[]): Role {
  return { id: "r", name: "r", description: "", system: false, scope: "self", permissions } as Role;
}

describe("the two AI permissions are distinct", () => {
  it("the assistant bit grants only the assistant", () => {
    const ids = idsFor(AI_ASSISTANT);
    expect(ids).toContain("ai:use");
    expect(ids).not.toContain("ai:view");
  });

  it("the insights bit grants only the insights", () => {
    const ids = idsFor(AI_INSIGHTS);
    expect(ids).toContain("ai:view");
    expect(ids).not.toContain("ai:use");
  });

  /** An Admin holds both bits, so nothing they could previously see has been taken away. */
  it("holding both bits still grants both", () => {
    const ids = idsFor(AI_INSIGHTS, AI_ASSISTANT);
    expect(ids).toEqual(expect.arrayContaining(["ai:view", "ai:use"]));
  });
});

describe("who gets the chat launcher", () => {
  const assistantOnly = role(idsFor(AI_ASSISTANT));
  const admin = role(idsFor(AI_INSIGHTS, AI_ASSISTANT));
  const owner = role(["*"]);

  /** The launcher's rule, mirrored from `ChatBot`: the bit alone, on every page. */
  const shows = (r: Role, _path: string) => canAccess(r, "ai:use");

  /**
   * The 2026-08-26 decision: the chatbot is an oversight surface. `SYSTEM_ROLES`' Employee must
   * not carry `ai:use`, mirroring `wp-contracts::roles::employee` dropping bit 65. This is the
   * assertion that fails if someone re-adds it to either side without changing the other.
   */
  it("the Employee system role does not get the assistant at all", () => {
    const employee = SYSTEM_ROLES.find((r) => r.id === "role-employee")!;
    expect(employee.permissions).not.toContain("ai:use");
    expect(shows(employee as Role, "/help")).toBe(false);
    expect(shows(employee as Role, "/dashboard")).toBe(false);
  });

  /** The regression that would matter most: oversight roles must be unaffected. */
  it("follows an Admin and an Owner everywhere", () => {
    for (const path of ["/dashboard", "/help", "/analytics"]) {
      expect(shows(admin, path)).toBe(true);
      expect(shows(owner, path)).toBe(true);
    }
  });

  /**
   * A custom role granted the bit gets it on every page — not Help-Center-only. That carve-out
   * existed only for Employees; keeping it would make a deliberately-granted permission behave
   * unpredictably.
   */
  it("a custom role granted the bit gets it everywhere", () => {
    for (const path of ["/dashboard", "/help", "/projects/p1"]) {
      expect(shows(assistantOnly, path)).toBe(true);
    }
  });

  /** `ai:use` must not be contributor-only, or the owner wildcard would silently lose it. */
  it("the owner wildcard grants the assistant", () => {
    expect(canAccess(owner, "ai:use")).toBe(true);
  });

  it("a role without the bit gets nothing, Help Center included", () => {
    const plain = role(["dashboard:view"]);
    expect(shows(plain, "/help")).toBe(false);
    expect(shows(plain, "/dashboard")).toBe(false);
  });
});
