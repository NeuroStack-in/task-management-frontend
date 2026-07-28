import { describe, expect, it } from "vitest";

import { parseEmails } from "./parse-emails";

describe("parseEmails", () => {
  it("reads a single address, unchanged behaviour for the one-invite case", () => {
    expect(parseEmails("jordan@acme.test").emails).toEqual(["jordan@acme.test"]);
  });

  it("splits on commas, semicolons, newlines, tabs and plain spaces", () => {
    const out = parseEmails("a@x.com, b@x.com; c@x.com\nd@x.com\te@x.com f@x.com");
    expect(out.emails).toEqual([
      "a@x.com",
      "b@x.com",
      "c@x.com",
      "d@x.com",
      "e@x.com",
      "f@x.com",
    ]);
    expect(out.invalid).toEqual([]);
  });

  /** What a mail client's To: field copies. Without this the whole line is one invalid token. */
  it("unwraps display-name form", () => {
    const out = parseEmails("Jordan Lee <jordan@acme.test>, Sam <sam@acme.test>");
    expect(out.emails).toEqual(["jordan@acme.test", "sam@acme.test"]);
    expect(out.invalid).toEqual([]);
  });

  /** A quoted display name contains a comma — splitting naively would tear the address apart. */
  it("keeps a quoted display name with a comma intact", () => {
    const out = parseEmails('"Lee, Jordan" <jordan@acme.test>');
    expect(out.emails).toEqual(["jordan@acme.test"]);
  });

  it("folds duplicates case-insensitively and counts them", () => {
    const out = parseEmails("A@x.com, a@x.com, b@x.com, A@X.COM");
    expect(out.emails).toEqual(["a@x.com", "b@x.com"]);
    expect(out.duplicates).toBe(2);
  });

  it("keeps unusable fragments so they can be shown, not silently dropped", () => {
    const out = parseEmails("good@x.com, not-an-email, also bad@");
    expect(out.emails).toEqual(["good@x.com"]);
    expect(out.invalid).toContain("not-an-email");
  });

  it("survives trailing separators and blank lines from a spreadsheet paste", () => {
    const out = parseEmails("a@x.com,\n\nb@x.com,\n");
    expect(out.emails).toEqual(["a@x.com", "b@x.com"]);
    expect(out.invalid).toEqual([]);
  });

  it("returns nothing for empty or whitespace-only input", () => {
    expect(parseEmails("   \n ").emails).toEqual([]);
    expect(parseEmails("").emails).toEqual([]);
  });
});
