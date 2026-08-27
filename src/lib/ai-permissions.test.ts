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
   * **Two assistants, two rules** — mirrored from `ChatBot` and `HelpAssistantDialog`.
   *
   * This replaced a path check (`ai:use` + the route being `/help`). The split is better because
   * the two surfaces are genuinely different products, not one product in two places: the floating
   * one is grounded in org data with a full tool belt, the Help one answers product questions with
   * no lookups at all. A permission pair says that; a URL prefix only implied it.
   */
  const floatingChatbot = (r: Role) =>
    canAccess(r, "ai:use") && canAccess(r, "ai:view");
  const helpAssistant = (r: Role) => canAccess(r, "ai:use");

  /**
   * An Employee reaches the Help assistant and **not** the floating one.
   *
   * Both halves are the assertion, and the second is the load-bearing one: grant `ai:view` to
   * Employee and the oversight launcher — org snapshot, full tools, questions about other people —
   * silently appears on every page, without anyone touching `ChatBot`.
   */
  it("an Employee gets the Help assistant but not the floating chatbot", () => {
    const employee = SYSTEM_ROLES.find((r) => r.id === "role-employee")! as Role;
    expect(employee.permissions).toContain("ai:use");
    expect(employee.permissions).not.toContain("ai:view");
    expect(helpAssistant(employee)).toBe(true);
    expect(floatingChatbot(employee)).toBe(false);
  });

  /** The regression that would matter most: oversight roles must reach both. */
  it("an Admin and an Owner reach both surfaces", () => {
    for (const r of [admin, owner]) {
      expect(floatingChatbot(r)).toBe(true);
      expect(helpAssistant(r)).toBe(true);
    }
  });

  /** A custom role granted only `ai:use` is treated exactly like an Employee. */
  it("a custom role with only the assistant bit gets Help only", () => {
    expect(helpAssistant(assistantOnly)).toBe(true);
    expect(floatingChatbot(assistantOnly)).toBe(false);
  });

  /** `ai:use` must not be contributor-only, or the owner wildcard would silently lose it. */
  it("the owner wildcard grants the assistant", () => {
    expect(canAccess(owner, "ai:use")).toBe(true);
  });

  it("a role without the bit gets neither surface", () => {
    const plain = role(["dashboard:view"]);
    expect(helpAssistant(plain)).toBe(false);
    expect(floatingChatbot(plain)).toBe(false);
  });
});
