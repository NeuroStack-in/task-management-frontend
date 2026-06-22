import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = "http://localhost:3000";
const shots = "/tmp/shots";
mkdirSync(shots, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 980 },
  colorScheme: "light",
});
const page = await ctx.newPage();

const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

// Landing (where the Base UI button warnings came from)
await page.goto(`${base}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await page.screenshot({ path: `${shots}/landing.png` });

// Login → dashboard
await page.goto(`${base}/login`, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.fill("input#email", "owner@acme.test");
await page.fill("input#password", "demo1234");
await Promise.all([
  page.waitForURL("**/dashboard", { timeout: 20000 }),
  page.click('button[type="submit"]'),
]);
await page.waitForTimeout(1500);
await page.screenshot({ path: `${shots}/dashboard.png`, fullPage: true });

await browser.close();

console.log("CONSOLE ERRORS:", errors.length);
for (const e of errors.slice(0, 20)) console.log(" -", e.slice(0, 160));
console.log("done");
