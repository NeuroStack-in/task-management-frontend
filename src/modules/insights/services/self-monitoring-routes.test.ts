import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * AI audit 2026-10-22, AI-33: employees see none of their own monitoring data — the API included
 * (owner decision 2026-10-28). The server refuses `/v1/me/insights/activity`, `/apps` and `/locations`
 * to a caller who can see only themselves, and the frontend has no screen that calls them: the only
 * one was an unreachable personal Locations view, deleted with the service functions it used.
 *
 * This keeps it that way. A call to one of those routes anywhere in `src/` would be a screen built on
 * data an employee is not shown — and, for a manager, on a route that answers only by accident of
 * their reach. Comments may name the routes; a string or template literal starting with one may not.
 */
// Vitest runs from the frontend root (`vitest.config.ts`); under jsdom `import.meta.url` isn't a
// file URL, so the root is the working directory.
const SRC = resolve(process.cwd(), "src");
const ROUTE = /["'`]\/v1\/me\/insights\/(activity|apps|locations)\b/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("self monitoring routes (AI-33)", () => {
  it("scans the app's sources", () => {
    // Guards the guard: a wrong root would scan nothing and pass forever.
    expect(sources(SRC).length).toBeGreaterThan(100);
  });

  it("no screen or service calls the caller's own activity, app or location routes", () => {
    const offenders = sources(SRC)
      .filter((f) => ROUTE.test(readFileSync(f, "utf8")))
      .map((f) => relative(SRC, f));
    expect(offenders).toEqual([]);
  });

  it("the pattern catches a real call and ignores prose", () => {
    expect(ROUTE.test("apiFetch(`/v1/me/insights/apps?from=${from}`)")).toBe(true);
    expect(ROUTE.test('apiFetch("/v1/me/insights/locations?date=x")')).toBe(true);
    expect(ROUTE.test("// `GET /v1/me/insights/locations` was the personal view")).toBe(false);
    // The AI recap's self route is a different, permission-gated read — not one of the three.
    expect(ROUTE.test("apiFetch(`/v1/me/insights/summary?date=${d}`)")).toBe(false);
  });
});
