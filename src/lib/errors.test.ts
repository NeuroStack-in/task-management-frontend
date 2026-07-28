import { describe, expect, it } from "vitest";

import { OFFLINE_MESSAGE, apiErrorMessage, friendlyError } from "./errors";

describe("apiErrorMessage", () => {
  it("maps a status with no server message to a sentence", () => {
    expect(apiErrorMessage(500)).toMatch(/on our side/i);
    expect(apiErrorMessage(401)).toMatch(/session has expired/i);
    expect(apiErrorMessage(429)).toMatch(/too quickly/i);
  });

  /** The one this task started from: `Request failed (500).` used to reach the toast verbatim. */
  it("never emits a bare status line", () => {
    for (const s of [400, 401, 403, 404, 409, 500, 503, 599]) {
      expect(apiErrorMessage(s)).not.toMatch(/request failed|\b\d{3}\b/i);
    }
  });

  it("keeps a validation message, because it names the actual problem", () => {
    expect(
      apiErrorMessage(400, "cannot remove the project manager — transfer management first"),
    ).toBe("Cannot remove the project manager — transfer management first.");
  });

  it("turns snake_case field names into words", () => {
    expect(apiErrorMessage(400, "end_date must be YYYY-MM-DD")).toBe(
      "End date must be YYYY-MM-DD.",
    );
  });

  /** Internal spec references are for us, not for the person using the app. */
  it("strips LLD/HLD references from a server message", () => {
    const out = apiErrorMessage(400, "billable is required (LLD §4)");
    expect(out).toBe("Billable is required.");
  });

  it("drops developer-shaped text in favour of the status sentence", () => {
    const out = apiErrorMessage(400, "DynamoDB ConditionalCheckFailedException at 0xdeadbeef");
    expect(out).toBe(apiErrorMessage(400));
  });

  /** A permission refusal reads better in our words than the server's. */
  it("does not pass through a 403 message", () => {
    expect(apiErrorMessage(403, "forbidden: missing bit 17")).toMatch(
      /don't have permission/i,
    );
  });

  it("reports a status 0 as a connection problem", () => {
    expect(apiErrorMessage(0)).toBe(OFFLINE_MESSAGE);
  });
});

describe("friendlyError", () => {
  it("translates Cognito codes", () => {
    expect(friendlyError({ code: "NotAuthorizedException" }, "fallback")).toMatch(
      /email or password/i,
    );
    expect(friendlyError({ name: "CodeMismatchException" }, "fallback")).toMatch(
      /code isn't right/i,
    );
  });

  /** Wrong password and unknown account must read identically — see auth.service. */
  it("gives the same answer for a wrong password and an unknown account", () => {
    expect(friendlyError({ code: "NotAuthorizedException" }, "x")).toBe(
      friendlyError({ code: "UserNotFoundException" }, "x"),
    );
  });

  it("recognises a fetch network failure", () => {
    const e = new TypeError("Failed to fetch");
    expect(friendlyError(e, "fallback")).toBe(OFFLINE_MESSAGE);
  });

  it("passes an ApiError's already-friendly message through", () => {
    const e = Object.assign(new Error("Your session has expired. Sign in again."), {
      status: 401,
    });
    expect(friendlyError(e, "fallback")).toBe(
      "Your session has expired. Sign in again.",
    );
  });

  it("keeps our own hand-written messages", () => {
    const e = new Error("Passwords don't match");
    expect(friendlyError(e, "fallback")).toBe("Passwords don't match.");
  });

  it("falls back for machine text and for non-errors", () => {
    expect(friendlyError(new Error("TypeError: x is not a function"), "fallback")).toBe(
      "fallback",
    );
    expect(friendlyError(undefined, "fallback")).toBe("fallback");
    expect(friendlyError("boom", "fallback")).toBe("fallback");
  });
});
