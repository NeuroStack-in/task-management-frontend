import { describe, expect, it } from "vitest";
import { countOf, nounFor } from "./plural";

describe("countOf (UX audit MON-23)", () => {
  it("agrees the noun with the count", () => {
    expect(countOf(1, "row")).toBe("1 row");
    expect(countOf(0, "row")).toBe("0 rows");
    expect(countOf(2, "row")).toBe("2 rows");
  });

  it("takes an irregular plural", () => {
    expect(countOf(1, "person", "people")).toBe("1 person");
    expect(countOf(3, "person", "people")).toBe("3 people");
  });

  it("groups large counts the way the rest of the page does", () => {
    expect(countOf(1204, "capture")).toBe(`${(1204).toLocaleString()} captures`);
  });
});

describe("nounFor", () => {
  it("is the noun alone", () => {
    expect(nounFor(1, "employee")).toBe("employee");
    expect(nounFor(5, "employee")).toBe("employees");
  });
});
