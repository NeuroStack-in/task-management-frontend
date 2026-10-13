import { describe, expect, it } from "vitest";

import { safeLandingPath } from "./rbac";
import type { Role } from "@/types/rbac";

/** An owner can open every page, so these tests are about the URL check alone. */
const owner = { id: "role-owner", name: "Owner", permissions: ["*"] } as unknown as Role;

describe("safeLandingPath", () => {
  it("keeps a same-origin path, with its query and hash", () => {
    expect(safeLandingPath(owner, "/projects?tab=board#t1")).toBe("/projects?tab=board#t1");
  });

  it("falls back to the dashboard when there is nothing usable", () => {
    expect(safeLandingPath(owner, null)).toBe("/dashboard");
    expect(safeLandingPath(owner, "")).toBe("/dashboard");
    expect(safeLandingPath(owner, "dashboard")).toBe("/dashboard");
    expect(safeLandingPath(owner, "https://evil.example/")).toBe("/dashboard");
  });

  it("refuses protocol-relative values", () => {
    expect(safeLandingPath(owner, "//evil.example")).toBe("/dashboard");
    expect(safeLandingPath(owner, "/\\evil.example")).toBe("/dashboard");
  });

  /**
   * WP-010: the router's URL parser drops tab, LF and CR, so `/<TAB>/evil.example` reached it as
   * `//evil.example` — another host — and a genuine sign-in ended on the attacker's page.
   */
  it("refuses control characters that the URL parser would strip into another host", () => {
    for (const ch of ["\t", "\n", "\r", "\u0000", "\u007f"]) {
      expect(safeLandingPath(owner, `/${ch}/evil.example`)).toBe("/dashboard");
    }
    expect(safeLandingPath(owner, decodeURIComponent("%2F%09%2Fevil.example"))).toBe(
      "/dashboard",
    );
  });

  it("refuses a backslash anywhere in the path", () => {
    expect(safeLandingPath(owner, "/projects\\..\\evil")).toBe("/dashboard");
  });
});
