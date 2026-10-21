import { describe, expect, it } from "vitest";
import { DEFAULT_SIGN_IN_HEADING, signInHeading } from "./login-purpose";

describe("signInHeading (UX audit PUB-09)", () => {
  it("explains the bounce for a signed-out visitor to /download", () => {
    expect(signInHeading("/download").title).toBe("Sign in to download the desktop app");
  });

  it("ignores a query string, a hash and a trailing slash on the destination", () => {
    expect(signInHeading("/download?ref=email").title).toMatch(/download/);
    expect(signInHeading("/download#mac").title).toMatch(/download/);
    expect(signInHeading("/download/").title).toMatch(/download/);
  });

  it("keeps the plain greeting everywhere else", () => {
    expect(signInHeading(null)).toBe(DEFAULT_SIGN_IN_HEADING);
    expect(signInHeading("")).toBe(DEFAULT_SIGN_IN_HEADING);
    expect(signInHeading("/dashboard")).toBe(DEFAULT_SIGN_IN_HEADING);
    expect(signInHeading("/downloads")).toBe(DEFAULT_SIGN_IN_HEADING);
    expect(signInHeading("/settings/download")).toBe(DEFAULT_SIGN_IN_HEADING);
  });

  it("never matches an off-site value", () => {
    expect(signInHeading("https://evil.example/download")).toBe(DEFAULT_SIGN_IN_HEADING);
  });
});
