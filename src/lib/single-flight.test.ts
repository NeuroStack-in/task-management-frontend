import { describe, expect, it, vi } from "vitest";
import { singleFlight } from "./single-flight";

describe("singleFlight", () => {
  it("shares one request between concurrent callers, and fetches afresh once it settles", async () => {
    let n = 0;
    const fetcher = vi.fn(async () => ++n);
    const get = singleFlight(fetcher);
    const [a, b] = await Promise.all([get(), get()]);
    expect([a, b]).toEqual([1, 1]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await expect(get()).resolves.toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not keep a failure", async () => {
    const fetcher = vi
      .fn<() => Promise<number>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(7);
    const get = singleFlight(fetcher);
    await expect(get()).rejects.toThrow("boom");
    await expect(get()).resolves.toBe(7);
  });
});
