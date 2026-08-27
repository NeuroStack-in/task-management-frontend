import { expect, test } from "@playwright/test";

/**
 * `AuthGuard` is the only thing standing between a signed-out browser and every `(app)` route. It
 * redirects to `/login?from=<path>` and waits for the auth store's `hydrated` flag first, so a
 * regression here is invisible in jsdom but wide open in a real browser.
 *
 * No credentials: these assert the *closed* half of the gate, which is the half that matters.
 */
const PROTECTED = [
  "/dashboard",
  "/projects",
  "/settings/agents",
  "/insights/screenshots",
];

test.describe("auth guard", () => {
  for (const path of PROTECTED) {
    test(`${path} redirects a signed-out visitor to login`, async ({ page }) => {
      await page.goto(path);

      // The guard preserves where you were headed, so signing in lands you there and not on a
      // generic dashboard. Exact-match rather than a regex: the `from` value is the assertion.
      await expect(page).toHaveURL(
        `/login?from=${encodeURIComponent(path)}`,
      );
      await expect(
        page.getByRole("heading", { name: "Welcome back" }),
      ).toBeVisible();
    });
  }

  test("the redirect does not flash protected content on the way through", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    // Whatever the guard does, the app shell must never have painted.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("navigation")).toHaveCount(0);
  });
});
