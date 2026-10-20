import { describe, expect, it } from "vitest";

import { balanceCell } from "./balance-cell";

/** UX audit 2026-10-16, TIME-17 — what the admin's balance ledger says in each cell. */
describe("balanceCell", () => {
  it("shows a started balance as the server has it", () => {
    expect(balanceCell({ seeded: true, allowance: 20, used: 3.5, remaining: 16.5 }, 20)).toEqual({
      noLimit: false,
      notStarted: false,
      allowance: 20,
      used: 3.5,
      remaining: 16.5,
    });
  });

  it("calls an allowance of 0 no limit — the server never refuses against it", () => {
    const c = balanceCell({ seeded: true, allowance: 0, used: 2, remaining: -2 }, 0);
    expect(c.noLimit).toBe(true);
    expect(c.used).toBe(2);
  });

  it("shows a not-yet-started balance at the catalog allowance it will be seeded with", () => {
    // The org ledger reports an unseeded row as zeros; first use seeds `annual_allowance`, used 0.
    expect(balanceCell({ seeded: false, allowance: 0, used: 0, remaining: 0 }, 20)).toEqual({
      noLimit: false,
      notStarted: true,
      allowance: 20,
      used: 0,
      remaining: 20,
    });
  });

  it("a not-started type with no catalog allowance is still no limit, not 0 / 0", () => {
    const c = balanceCell({ seeded: false, allowance: 0, used: 0, remaining: 0 }, 0);
    expect(c).toMatchObject({ noLimit: true, notStarted: true });
  });

  it("a hand-set allowance wins over the catalog once the balance exists", () => {
    const c = balanceCell({ seeded: true, allowance: 25, used: 0, remaining: 25 }, 20);
    expect(c.allowance).toBe(25);
  });
});
