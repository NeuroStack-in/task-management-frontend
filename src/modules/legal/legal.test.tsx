import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LEGAL_CONTENT } from "./content";
import { LEGAL_DOCS, LEGAL_DRAFT, legalDocBySlug, legalHref } from "./documents";
import { LegalPage } from "./legal-page";
import { PLACEHOLDERS, isPlaceholder } from "./placeholders";

describe("legal documents", () => {
  it("resolves exactly the four documents", () => {
    expect(LEGAL_DOCS.map((d) => legalHref(d.slug))).toEqual([
      "/legal/terms",
      "/legal/privacy",
      "/legal/dpa",
      "/legal/cookies",
    ]);
    for (const d of LEGAL_DOCS) expect(legalDocBySlug(d.slug)).toBe(d);
    expect(legalDocBySlug("refund")).toBeUndefined();
  });

  it.each(LEGAL_DOCS)(
    "$title renders every section, each reachable from the contents list",
    (meta) => {
      const doc = LEGAL_CONTENT[meta.slug];
      const ids = doc.sections.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);

      render(<LegalPage meta={meta} doc={doc} />);
      expect(
        screen.getByRole("heading", { level: 1, name: meta.title }),
      ).toBeInTheDocument();
      for (const [i, s] of doc.sections.entries()) {
        expect(document.getElementById(s.id)?.tagName).toBe("SECTION");
        expect(
          screen.getAllByRole("link", { name: `${i + 1}. ${s.title}` })[0],
        ).toHaveAttribute("href", `#${s.id}`);
      }
      // The current document is marked in the switcher.
      expect(screen.getByRole("link", { name: meta.title })).toHaveAttribute(
        "aria-current",
        "page",
      );
    },
  );

  it.skipIf(!LEGAL_DRAFT)("opens every draft with the not-in-effect banner", () => {
    for (const meta of LEGAL_DOCS) {
      const { unmount } = render(
        <LegalPage meta={meta} doc={LEGAL_CONTENT[meta.slug]} />,
      );
      expect(screen.getByRole("note")).toHaveTextContent(
        "DRAFT — pending legal review. Not yet in effect.",
      );
      unmount();
    }
  });

  /** The guard on `LEGAL_DRAFT`: a document can't go live with a `[...]` still on the page. */
  it.skipIf(LEGAL_DRAFT)(
    "has no unfilled placeholder once the documents are published",
    () => {
      expect(Object.values(PLACEHOLDERS).filter(isPlaceholder)).toEqual([]);
    },
  );
});
