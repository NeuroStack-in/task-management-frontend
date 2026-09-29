import { describe, expect, it } from "vitest";

import { handoutTable, joinLink } from "./invite-handout";
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

describe("handoutTable", () => {
  it("lays out the columns an admin hands round", () => {
    const { headers, rows } = handoutTable(
      [{ invite: invite(), name: "Priya Nair" }],
      "https://app.example.com",
      "t-1",
      { withName: true },
    );
    expect(headers).toEqual([
      "Employee ID",
      "Name",
      "Email",
      "Invite code",
      "Join link",
      "Expires",
    ]);
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

  /**
   * A pasted run carries addresses only, so a Name column would be empty in every row — noise in the
   * one file someone has to read across while handing codes out.
   */
  it("omits the Name column entirely when no row has a name", () => {
    const { headers, rows } = handoutTable([{ invite: invite() }], "https://x.test", "t-1", { withName: false });
    expect(headers).toEqual(["Employee ID", "Email", "Invite code", "Join link", "Expires"]);
    expect(headers).not.toContain("Name");
    expect(rows[0]).toEqual([
      "INF-004",
      "priya@acme.test",
      "483927",
      "https://x.test/invite/accept?tenant_id=t-1&invite_id=inv-1&token=tok-abc",
      new Date(1_790_000_000 * 1000).toLocaleString(),
    ]);
  });

  /** A blank-but-present name is still no name; whitespace must not resurrect the column. */
  it("treats a whitespace-only name as absent", () => {
    const { headers } = handoutTable([{ invite: invite(), name: "Priya" }], "https://x.test", "t", {
      withName: false,
    });
    expect(headers).not.toContain("Name");
  });

  /** One named person in a mixed batch keeps the column for everyone — dropping it would lose data. */
  it("keeps the Name column when only some rows have one", () => {
    const { headers, rows } = handoutTable(
      [
        { invite: invite({ invite_id: "a" }), name: "Priya" },
        { invite: invite({ invite_id: "b" }) },
      ],
      "https://x.test",
      "t",
      { withName: true },
    );
    expect(headers).toContain("Name");
    expect(rows[0][1]).toBe("Priya");
    expect(rows[1][1]).toBe("");
  });

  /** Headers and rows must always have the same width, or every value reads under the wrong heading. */
  it("returns rows exactly as wide as the headers, either way", () => {
    for (const batch of [
      [{ invite: invite(), name: "Priya" }],
      [{ invite: invite() }],
    ]) {
      for (const withName of [true, false]) {
        const { headers, rows } = handoutTable(batch, "https://x.test", "t", { withName });
        for (const row of rows) expect(row).toHaveLength(headers.length);
      }
    }
  });

  /**
   * `expires_at` is epoch **seconds** on this DTO while most timestamps in the app are milliseconds.
   * Reading it as ms would print a date in 1970 and quietly tell people their invite had expired.
   */
  it("reads the expiry as seconds, not milliseconds", () => {
    const { headers, rows } = handoutTable(
      [{ invite: invite({ expires_at: 1_790_000_000 }) }],
      "https://x.test",
      "t",
      { withName: false },
    );
    // Indexed by header, not by a literal position: this batch has no name, so the column is
    // dropped and every index after it shifts. Hard-coding 5 here passed only by luck before.
    const expires = rows[0][headers.indexOf("Expires")];
    expect(expires).toBe(new Date(1_790_000_000_000).toLocaleString());
    expect(expires).not.toContain("1970");
  });

  it("handles an absent employee id without printing undefined", () => {
    const { rows } = handoutTable(
      [{ invite: { ...invite(), emp_id: undefined as unknown as string } }],
      "https://x.test",
      "t",
      { withName: false },
    );
    const row = rows[0];
    expect(row[0]).toBe("");
  });
});
