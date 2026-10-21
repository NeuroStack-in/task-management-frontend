import { describe, expect, it } from "vitest";
import { clusterIndices, clusterNames } from "./cluster";

/** UX audit 2026-10-16, MON-22 — overlapping avatars hid everyone but the top one. */
describe("clusterIndices", () => {
  it("groups points that overlap on screen and leaves the rest alone", () => {
    const groups = clusterIndices(
      [
        { x: 100, y: 100 },
        { x: 110, y: 104 }, // on top of the first
        { x: 400, y: 300 }, // far away
        { x: 96, y: 90 }, // on top of the first
      ],
      36,
    );
    expect(groups).toEqual([[0, 1, 3], [2]]);
  });

  it("puts every point in exactly one group", () => {
    const pts = Array.from({ length: 40 }, (_, i) => ({ x: (i % 7) * 20, y: Math.floor(i / 7) * 20 }));
    const flat = clusterIndices(pts, 30).flat().sort((a, b) => a - b);
    expect(flat).toEqual(pts.map((_, i) => i));
  });

  it("is a no-op with nothing close together", () => {
    expect(clusterIndices([{ x: 0, y: 0 }, { x: 100, y: 0 }], 36)).toEqual([[0], [1]]);
    expect(clusterIndices([], 36)).toEqual([]);
  });

  it("treats the radius as inclusive", () => {
    expect(clusterIndices([{ x: 0, y: 0 }, { x: 36, y: 0 }], 36)).toEqual([[0, 1]]);
  });
});

describe("clusterNames", () => {
  it("lists a small group in full", () => {
    expect(clusterNames(["Ana"])).toBe("Ana");
    expect(clusterNames(["Ana", "Ben"])).toBe("Ana and Ben");
    expect(clusterNames(["Ana", "Ben", "Cy"])).toBe("Ana, Ben and Cy");
  });

  it("counts the rest of a large one", () => {
    expect(clusterNames(["Ana", "Ben", "Cy", "Di"])).toBe("Ana, Ben, Cy and 1 other");
    expect(clusterNames(["Ana", "Ben", "Cy", "Di", "Ed"])).toBe("Ana, Ben, Cy and 2 others");
  });
});
