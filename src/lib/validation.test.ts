import { describe, expect, it } from "vitest";

import { toWebUrl } from "./validation";

/** WP-356: a scheme-less value used as an `href` became a relative link into the app. */
describe("toWebUrl", () => {
  it("adds https:// to a bare domain and keeps paths", () => {
    expect(toWebUrl("acme.com")).toBe("https://acme.com");
    expect(toWebUrl("  intranet.acme.com/leave ")).toBe("https://intranet.acme.com/leave");
  });

  it("keeps an explicit http(s) link as typed, any host", () => {
    expect(toWebUrl("https://acme.com/about")).toBe("https://acme.com/about");
    expect(toWebUrl("http://intranet/policies")).toBe("http://intranet/policies");
  });

  it("refuses other schemes and things that aren't addresses", () => {
    expect(toWebUrl("javascript:alert(1)")).toBeNull();
    expect(toWebUrl("mailto:hr@acme.com")).toBeNull();
    expect(toWebUrl("intranet")).toBeNull();
    expect(toWebUrl("not a url")).toBeNull();
    expect(toWebUrl("")).toBeNull();
  });
});
