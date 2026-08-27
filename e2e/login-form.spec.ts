import { expect, test } from "@playwright/test";

/**
 * The login form's client-side half. The SRP exchange itself needs a real Cognito account and would
 * write to the shared `dev` tenant, so it is out of scope here — but the validation that runs before
 * any network call is not, and it is what stops a user from firing an empty request.
 */
test.describe("login form", () => {
  test("submitting empty names both missing fields, as jump links", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByRole("button", { name: "Sign in" }).click();

    // Each message appears twice by design — once in the `role="alert"` summary as an anchor to the
    // field, once as the field's own screen-reader text, deliberately word-for-word identical so it
    // isn't announced as two separate problems (see `AuthErrorSummary`). Asserting the *link* is
    // therefore the precise assertion: it checks the summary rendered AND that it can be jumped from.
    await expect(
      page.getByRole("link", { name: "Enter your work email" }),
    ).toHaveAttribute("href", "#login-email");
    await expect(
      page.getByRole("link", { name: "Enter your password" }),
    ).toHaveAttribute("href", "#login-password");

    // Still on /login — nothing was sent.
    await expect(page).toHaveURL(/\/login/);
  });

  test("the fields are properly labelled and the password is masked", async ({
    page,
  }) => {
    await page.goto("/login");

    await expect(page.getByLabel("Work email")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
      "type",
      "password",
    );
  });

  test("forgot-password is reachable from here", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("link", { name: "Forgot password?" }).click();

    await expect(page).toHaveURL(/\/forgot-password/);
  });
});
