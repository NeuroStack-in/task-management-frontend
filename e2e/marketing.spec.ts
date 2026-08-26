import { expect, test } from "@playwright/test";

/**
 * The public surface — the only pages a signed-out visitor can reach. These render on the server, so
 * a broken import or a bad server/client boundary (frontend/CLAUDE.md §5) takes them down with a 500
 * that no unit test sees.
 */
test.describe("marketing", () => {
  test("pricing lists exactly the three plans the server can issue", async ({ page }) => {
    await page.goto("/pricing");

    await expect(page).toHaveTitle(/Pricing/);
    // Mirrors `Plan` in crates/wp-contracts/src/plans.rs — a fourth tier here would be a plan
    // nobody can buy, which is the bug this page has actually shipped before.
    for (const plan of ["Free", "Starter", "Enterprise"]) {
      await expect(page.getByRole("heading", { name: plan, exact: true })).toBeVisible();
    }
  });

  test("a product page renders and links back into the app", async ({ page }) => {
    const res = await page.goto("/product/time-tracking");

    expect(res?.status()).toBe(200);
    await expect(page.getByRole("link", { name: /log in/i }).first()).toBeVisible();
  });
});
