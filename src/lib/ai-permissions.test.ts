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

  /**
   * The launcher's rule, mirrored from `ChatBot`: `ai:use` decides **whether**, `ai:view` decides
   * **where**. Without the oversight half you get it on the Help Center only.
   */
  const isHelp = (p: string) => p === "/help" || p.startsWith("/help/");
  const shows = (r: Role, path: string) =>
    canAccess(r, "ai:use") && (canAccess(r, "ai:view") || isHelp(path));

  /**
   * The 2026-08-27 decision, which reversed the previous day's: an Employee gets the assistant on
   * the **Help Center and nowhere else**, mirroring `wp-contracts::roles::employee` granting bit 65
   * again while still withholding `AiInsightsRead`.
   *
   * Both halves are the assertion. Add `ai:view` to Employee and the second expectation fails —
   * which is the point, because that is exactly how the launcher would silently spread to every
   * page without anyone touching `ChatBot`.
   */
  it("an Employee gets the assistant on the Help Center only", () => {
    const employee = SYSTEM_ROLES.find((r) => r.id === "role-employee")!;
    expect(employee.permissions).toContain("ai:use");
    expect(employee.permissions).not.toContain("ai:view");
    expect(shows(employee as Role, "/help")).toBe(true);
    expect(shows(employee as Role, "/help/tickets")).toBe(true);
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
   * A custom role granted only `ai:use` is treated exactly like an Employee: Help Center only.
   *
   * The alternative — everywhere — was argued for on the grounds that a deliberately-granted
   * permission should not behave unpredictably. The rule is predictable, it just takes both bits
   * to state: `ai:view` is the oversight half, and a role without it has nothing org-wide to ask
   * anywhere else. Granting both is what puts the launcher on every page.
   */
  it("a custom role with only the assistant bit is Help-Center-only", () => {
    expect(shows(assistantOnly, "/help")).toBe(true);
    for (const path of ["/dashboard", "/projects/p1"]) {
      expect(shows(assistantOnly, path)).toBe(false);
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
