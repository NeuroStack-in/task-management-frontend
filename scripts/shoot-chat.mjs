import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const base = "http://localhost:3000";
const out = "/tmp/shots";
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: "light",
});
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

await page.goto(`${base}/login`, { waitUntil: "networkidle" });
await page.fill("input#email", "owner@acme.test");
await page.fill("input#password", "demo1234");
await Promise.all([
  page.waitForURL("**/dashboard", { timeout: 20000 }),
  page.click('button[type="submit"]'),
]);
await page.waitForTimeout(800);

// Open the assistant and send a message
await page.click('button[aria-label="Open assistant"]');
await page.waitForTimeout(500);
await page.fill('input[aria-label="Message"]', "summarize this week");
await page.click('button[aria-label="Send message"]');
await page.waitForTimeout(1200);
await page.screenshot({ path: `${out}/chatbot.png` });

await browser.close();
console.log("CONSOLE ERRORS:", errors.length);
errors.slice(0, 10).forEach((e) => console.log(" -", e.slice(0, 160)));
console.log("done");
