import { beforeEach, describe, expect, it } from "vitest";
import { ephemeralSessionEnded, markSessionPersistence } from "./session-persistence";

function closeBrowser() {
  // A session cookie is what a browser drops on close.
  document.cookie = "wp_live=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
}

beforeEach(() => {
  localStorage.clear();
  closeBrowser();
});

/** WP-123 (QA audit 2026-10-08): "Keep me signed in" unticked must not survive a browser restart. */
describe("session persistence", () => {
  it("ends an unremembered session when the browser was closed", () => {
    markSessionPersistence(false);
    expect(ephemeralSessionEnded()).toBe(false); // same browser session
    closeBrowser();
    expect(ephemeralSessionEnded()).toBe(true);
  });

  it("keeps a remembered session across restarts", () => {
    markSessionPersistence(true);
    closeBrowser();
    expect(ephemeralSessionEnded()).toBe(false);
  });
});
