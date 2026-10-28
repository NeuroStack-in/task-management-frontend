import { describe, expect, it } from "vitest";
import { judgedCount, reviewRunMessage, roleBasisNote } from "./screenshot-review";

/**
 * AI-57: the viewer printed the server's log sentence — "Couldn't analyze this frame —
 * monitoring.screenshots is not in this org's plan." Each reason becomes words a reviewer can use,
 * and nothing the server says reaches the page verbatim.
 */
describe("reviewRunMessage", () => {
  it("never shows an internal feature key", () => {
    const m = reviewRunMessage({ reason: "monitoring.screenshots is not in this org's plan" });
    expect(m).toBe("Screenshots aren't included in your plan, so there is nothing to review.");
    expect(m).not.toMatch(/monitoring\.|org's|frame/);
  });

  it("says when AI insights is what stopped it (AI-19)", () => {
    expect(reviewRunMessage({ reason: "ai.insights is off for this organization" })).toBe(
      "AI review is off because AI insights is turned off in Settings → Features.",
    );
    expect(reviewRunMessage({ reason: "AI insights is turned off" })).toMatch(/^AI review is off/);
  });

  it("names a privacy hold before anything else", () => {
    expect(
      reviewRunMessage({ reason: "every eligible screenshot already has a report", withheld_by_privacy: 1 }),
    ).toBe("This screenshot is withheld by your privacy settings, so it isn't sent for AI review.");
  });

  it("maps each reason the server gives today", () => {
    expect(reviewRunMessage({ reason: "that screenshot isn't in this day's captures" })).toMatch(
      /no longer in this day's captures/,
    );
    expect(reviewRunMessage({ reason: "no screenshots captured for this day" })).toMatch(
      /no longer in this day's captures/,
    );
    expect(reviewRunMessage({ reason: "every eligible screenshot already has a report" })).toMatch(
      /already has an AI review/,
    );
    expect(reviewRunMessage({ reason: "AI provider is not configured" })).toBe(
      "AI review isn't available right now. Try again later.",
    );
    expect(
      reviewRunMessage({ reason: "the AI provider didn't answer — try again in a moment" }),
    ).toBe("The AI service didn't answer. Try again in a moment.");
    expect(reviewRunMessage({ reason: "the daily cap was reached" })).toMatch(/limit has been reached/);
  });

  it("an unknown or missing reason gets the plain fallback, not the server's words", () => {
    const fallback = "Couldn't review this screenshot with AI. Try again in a moment.";
    expect(reviewRunMessage({ reason: "WP_VISION_AUTO=false in env" })).toBe(fallback);
    expect(reviewRunMessage({})).toBe(fallback);
    // "captures" contains "cap" — it must not read as the daily limit.
    expect(reviewRunMessage({ reason: "captures pending upload" })).toBe(fallback);
  });
});

describe("the AI-insights-off reason vision-privacy sends (AI-19)", () => {
  it("reads as a plain sentence pointing at the switch", () => {
    expect(
      reviewRunMessage({
        reason: "AI insights is off for this organization, so screenshots are not sent for AI review",
      }),
    ).toBe("AI review is off because AI insights is turned off in Settings → Features.");
  });
});

/** AI-47 / AI-65: what a rating was judged against, and what the on-task share is a share of. */
describe("roleBasisNote", () => {
  it("says nothing for the normal case, an old server or an unknown value", () => {
    expect(roleBasisNote("department+title")).toBeNull();
    expect(roleBasisNote(undefined)).toBeNull();
    expect(roleBasisNote("team")).toBeNull();
    expect(roleBasisNote("constructor")).toBeNull();
  });

  it("names what was missing when the rating fell back", () => {
    expect(roleBasisNote("department")).toMatch(/department only: no job title/);
    expect(roleBasisNote("title")).toMatch(/job title only: no department/);
    expect(roleBasisNote("default")).toMatch(/general role: no department or job title/);
  });
});

describe("judgedCount", () => {
  it("leaves blank, locked and unreadable screenshots out", () => {
    expect(judgedCount({ frames: 10, not_judged: 3 })).toBe(7);
  });

  it("is every analysed frame on a server without the field", () => {
    expect(judgedCount({ frames: 10 })).toBe(10);
  });

  it("never goes below zero on odd input", () => {
    expect(judgedCount({ frames: 2, not_judged: 5 })).toBe(0);
    expect(judgedCount({ frames: 2, not_judged: -1 })).toBe(2);
  });
});
