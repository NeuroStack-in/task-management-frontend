import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = "http://localhost:3000";
const out = "/tmp/shots";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 820 },
  colorScheme: "light",
});
const page = await ctx.newPage();

await page.goto(`${base}/login`, { waitUntil: "networkidle" });
await page.fill("input#email", "owner@acme.test");
await page.fill("input#password", "demo1234");
await Promise.all([
  page.waitForURL("**/dashboard", { timeout: 20000 }),
  page.click('button[type="submit"]'),
]);
await page.waitForTimeout(1200);

// Expanded sidebar
await page.screenshot({ path: `${out}/sb-expanded.png`, clip: { x: 0, y: 0, width: 280, height: 820 } });

// Collapse it
await page.click('button[aria-label="Collapse sidebar"]');
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/sb-collapsed.png`, clip: { x: 0, y: 0, width: 110, height: 820 } });

await browser.close();
console.log("done");
