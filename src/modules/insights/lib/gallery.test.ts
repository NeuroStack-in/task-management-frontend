import { describe, expect, it } from "vitest";

import {
  captureCountOf,
  counterLabel,
  framePositions,
  nextFlaggedIndex,
  openFlagsOf,
  sortGroupsByOpenFlags,
} from "./gallery";

const shot = (captured_at: number, flagged = false, human_review?: "confirmed" | "dismissed") => ({
  captured_at,
  flagged,
  human_review,
});

describe("gallery counts (UX audit MON-11 / MON-12)", () => {
  it("counts capture moments, not monitor frames", () => {
    expect(captureCountOf([shot(1), shot(1), shot(2)])).toBe(2);
  });
  it("counts only flags nobody has handled", () => {
    expect(openFlagsOf([shot(1, true), shot(2, true, "dismissed"), shot(3, true, "confirmed"), shot(4)])).toBe(1);
  });
});

describe("sortGroupsByOpenFlags", () => {
  it("puts people with flags awaiting review first, most first, and keeps the server order otherwise", () => {
    const groups = [
      { userId: "a", shots: [shot(1)] },
      { userId: "b", shots: [shot(1, true)] },
      { userId: "c", shots: [shot(1)] },
      { userId: "d", shots: [shot(1, true), shot(2, true)] },
      { userId: "e", shots: [shot(1, true, "dismissed")] },
    ];
    expect(sortGroupsByOpenFlags(groups).map((g) => g.userId)).toEqual(["d", "b", "a", "c", "e"]);
  });
});

describe("viewer stepping", () => {
  const captures = [
    { awaitsReview: false, monitors: [1] },
    { awaitsReview: true, monitors: [1, 2] },
    { awaitsReview: false, monitors: [1] },
    { awaitsReview: true, monitors: [1] },
  ];

  it("finds the next and previous capture awaiting review", () => {
    expect(nextFlaggedIndex(captures, 0, 1)).toBe(1);
    expect(nextFlaggedIndex(captures, 1, 1)).toBe(3);
    expect(nextFlaggedIndex(captures, 3, 1)).toBeNull();
    expect(nextFlaggedIndex(captures, 3, -1)).toBe(1);
    expect(nextFlaggedIndex(captures, 1, -1)).toBeNull();
  });

  it("maps every frame to its capture and monitor", () => {
    expect(framePositions(captures)).toEqual([
      { capture: 0, monitor: 0, monitors: 1 },
      { capture: 1, monitor: 0, monitors: 2 },
      { capture: 1, monitor: 1, monitors: 2 },
      { capture: 2, monitor: 0, monitors: 1 },
      { capture: 3, monitor: 0, monitors: 1 },
    ]);
  });

  it("counts captures in the counter, with the monitor only when there are several", () => {
    const pos = framePositions(captures);
    expect(counterLabel(pos[2], 4, false)).toBe("Capture 2 of 4 · monitor 2 of 2");
    expect(counterLabel(pos[0], 4, true)).toBe("Capture 1 of 4+");
  });
});
