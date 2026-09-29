import { describe, expect, it } from "vitest";

import { handoutRows, joinLink } from "./invite-handout";
import type { ApiInviteCreated } from "../services/employees.service";

function invite(over: Partial<ApiInviteCreated> = {}): ApiInviteCreated {
  return {
    invite_id: "inv-1",
    emp_id: "INF-004",
    email: "priya@acme.test",
    role_id: "role-employee",
    department_id: "d1",
    title: "Backend Engineer",
    status: "pending",
    expires_at: 1_790_000_000,
    token: "tok-abc",
    otp: "483927",
    ...over,
  };
}

describe("joinLink", () => {
  /**
   * The emailed link and the handed-out link must be the same invite. This mirrors the format in
   * `notifications::consumers`; if that changes and this doesn't, half the recipients get a link
   * that doesn't work and the cause is invisible.
   */
  it("matches the accept URL the invite email sends", () => {
    expect(joinLink("https://app.example.com", "t-1", invite())).toBe(
      "https://app.example.com/invite/accept?tenant_id=t-1&invite_id=inv-1&token=tok-abc",
    );
  });

  it("tolerates a base URL with a trailing slash", () => {
    expect(joinLink("https://app.example.com/", "t-1", invite())).toContain(
      "https://app.example.com/invite/accept?",
    );
  });

  /** A token with URL-significant characters must survive being put in a query string. */
  it("encodes the token rather than pasting it in raw", () => {
    const link = joinLink("https://x.test", "t-1", invite({ token: "a+b/c=d&e" }));
    expect(link).toContain("token=a%2Bb%2Fc%3Dd%26e");
    expect(link.split("token=")[1]).not.toContain("&e");
  });
});

describe("handoutRows", () => {
  it("lays out the columns an admin hands round", () => {
    const rows = handoutRows(
      [{ invite: invite(), name: "Priya Nair" }],
      "https://app.example.com",
      "t-1",
    );
    expect(rows).toEqual([
      [
        "INF-004",
        "Priya Nair",
        "priya@acme.test",
        "483927",
        "https://app.example.com/invite/accept?tenant_id=t-1&invite_id=inv-1&token=tok-abc",
        new Date(1_790_000_000 * 1000).toLocaleString(),
      ],
    ]);
  });

  /** A pasted list carries addresses only — the name cell is blank, never "undefined". */
  it("leaves the name blank when the run had no names to work from", () => {
    const [row] = handoutRows([{ invite: invite() }], "https://x.test", "t-1");
    expect(row[1]).toBe("");
  });

  /**
   * `expires_at` is epoch **seconds** on this DTO while most timestamps in the app are milliseconds.
   * Reading it as ms would print a date in 1970 and quietly tell people their invite had expired.
   */
  it("reads the expiry as seconds, not milliseconds", () => {
    const [row] = handoutRows([{ invite: invite({ expires_at: 1_790_000_000 }) }], "https://x.test", "t");
    expect(row[5]).toBe(new Date(1_790_000_000_000).toLocaleString());
    expect(row[5]).not.toContain("1970");
  });

  it("handles an absent employee id without printing undefined", () => {
    const [row] = handoutRows(
      [{ invite: { ...invite(), emp_id: undefined as unknown as string } }],
      "https://x.test",
      "t",
    );
    expect(row[0]).toBe("");
  });
});
