import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/employees/services/employees.service", () => ({ readRoster: vi.fn() }));
vi.mock("../services/org.service", () => ({ getWorkingHours: vi.fn() }));

import { sharedWhileInflight } from "./shared-reads";

/** WP-539: two cards mounting together each made the same read. */
describe("sharedWhileInflight", () => {
  it("joins callers while a read is pending, then starts fresh", async () => {
    let resolve!: (v: number) => void;
    const read = vi.fn(() => new Promise<number>((r) => (resolve = r)));
    const shared = sharedWhileInflight(read);

    const a = shared();
    const b = shared();
    expect(read).toHaveBeenCalledTimes(1);
    resolve(7);
    await expect(Promise.all([a, b])).resolves.toEqual([7, 7]);

    void shared();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("lets the next call retry after a failure", async () => {
    const read = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("busy"))
      .mockResolvedValueOnce("ok");
    const shared = sharedWhileInflight(read);
    await expect(shared()).rejects.toThrow("busy");
    await expect(shared()).resolves.toBe("ok");
  });
});
