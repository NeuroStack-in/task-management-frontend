import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Unit/component test runner. jsdom environment, the `@/*` alias mirrored from tsconfig, and a setup
 * file that installs jest-dom matchers. E2E (Playwright) is separate (`npm run test:e2e`).
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Next-specific/E2E dirs are out of scope for the unit runner.
    exclude: ["node_modules", ".next", "e2e", "tests/e2e"],
    css: false,
  },
});
