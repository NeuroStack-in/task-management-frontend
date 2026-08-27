import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end config.
 *
 * **Every spec here is credential-free by design.** Login is a genuine SRP exchange against the live
 * Cognito pool (frontend/CLAUDE.md §4), so a signed-in journey would need a real account and would
 * write to the shared `dev` tenant. These specs therefore cover only what can be asserted without an
 * account: the public marketing surface, the login form's own validation, and the `AuthGuard`
 * redirect that protects every `(app)` route. That is the part of the app a regression would break
 * silently — a broken guard or a blank marketing page ships without a unit test noticing.
 *
 * The dev server is reused when one is already up. Deliberately `next dev`, not `next build &&
 * next start`: building into `.next` while a dev server is serving from it 404s the CSS chunks.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  // `next dev` compiles a route on its FIRST request, so the first navigation to any given page can
  // take several seconds even though the app is healthy. The default 5s expect timeout turns that
  // into a flake that only ever bites the route nobody visited yet. Both timeouts are generous on
  // purpose — they bound a hang, they are not a performance assertion.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:3000/pricing",
    reuseExistingServer: !process.env.CI,
    // A cold `next dev` compiles the route on first request; that is slower than the 60s default.
    timeout: 180_000,
  },
});
