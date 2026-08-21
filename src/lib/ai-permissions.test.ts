import { describe, expect, it } from "vitest";

import { permissionsFromBitset } from "./permission-bits";
import { canAccess } from "./rbac";
import { isHelpRoute } from "@/components/layout/chat-bot";
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

describe("who gets the chat launcher, and where", () => {
  const employee = role(idsFor(AI_ASSISTANT));
  const admin = role(idsFor(AI_INSIGHTS, AI_ASSISTANT));
  const owner = role(["*"]);

  /** The launcher's rule, mirrored from `ChatBot`. */
  const shows = (r: Role, path: string) =>
    canAccess(r, "ai:use") && (canAccess(r, "ai:view") || isHelpRoute(path));

  it("gives an Employee the assistant on the Help Center", () => {
    expect(shows(employee, "/help")).toBe(true);
    expect(shows(employee, "/help/getting-started")).toBe(true);
  });

  /** Their collective questions are refused server-side, so it isn't offered org-wide. */
  it("does not follow an Employee onto other pages", () => {
    expect(shows(employee, "/dashboard")).toBe(false);
    expect(shows(employee, "/projects/p1")).toBe(false);
  });

  /** The regression that would matter most: oversight roles must be unaffected. */
  it("still follows an Admin and an Owner everywhere", () => {
    for (const path of ["/dashboard", "/help", "/analytics"]) {
      expect(shows(admin, path)).toBe(true);
      expect(shows(owner, path)).toBe(true);
    }
  });

  /** `ai:use` must not be contributor-only, or the owner wildcard would silently lose it. */
  it("the owner wildcard grants the assistant", () => {
    expect(canAccess(owner, "ai:use")).toBe(true);
  });

  it("a role with neither bit gets nothing, Help Center included", () => {
    const plain = role(["dashboard:view"]);
    expect(shows(plain, "/help")).toBe(false);
    expect(shows(plain, "/dashboard")).toBe(false);
  });
});

describe("isHelpRoute", () => {
  it("matches the Help Center and its sub-pages only", () => {
    expect(isHelpRoute("/help")).toBe(true);
    expect(isHelpRoute("/help/tickets")).toBe(true);
    // Guards against a bare `startsWith("/help")` matching an unrelated future route.
    expect(isHelpRoute("/helpdesk")).toBe(false);
    expect(isHelpRoute("/dashboard")).toBe(false);
    expect(isHelpRoute(null)).toBe(false);
  });
});
