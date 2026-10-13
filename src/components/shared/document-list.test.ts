import { describe, expect, it } from "vitest";

import { previewBlob, viewKindFor } from "./document-list";

const bytes = new TextEncoder().encode("<script>alert(1)</script>").buffer as ArrayBuffer;

describe("viewKindFor", () => {
  it("previews the raster images, PDFs, Markdown and text it always did", () => {
    expect(viewKindFor("image/png", "a.png")).toBe("image");
    expect(viewKindFor("application/octet-stream", "scan.jpeg")).toBe("image");
    expect(viewKindFor("application/pdf", "note.pdf")).toBe("pdf");
    expect(viewKindFor("", "note.pdf")).toBe("pdf");
    expect(viewKindFor("text/markdown", "README.md")).toBe("markdown");
    expect(viewKindFor("text/plain", "log.txt")).toBe("text");
  });

  /**
   * An SVG opened on its own — a new tab on the preview's blob URL — is a document that runs script
   * as this app. It is download-only now, whatever type it declares.
   */
  it("never previews SVG", () => {
    expect(viewKindFor("image/svg+xml", "logo.svg")).toBeNull();
    expect(viewKindFor("", "logo.svg")).toBeNull();
  });

  it("leaves Word and unknown files download-only", () => {
    expect(
      viewKindFor(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "cv.docx",
      ),
    ).toBeNull();
    expect(viewKindFor("text/html", "page.html")).toBeNull();
  });
});

describe("previewBlob", () => {
  /**
   * WP-008: the stored object's type is the uploader's choice. A "PDF" must reach the iframe as a
   * PDF, so HTML bytes behind it go to the PDF viewer (and fail) instead of running on this origin.
   */
  it("types a PDF preview as a PDF, whatever the server said", () => {
    expect(previewBlob(bytes, "pdf", "text/html", "medical-note.pdf").type).toBe("application/pdf");
  });

  it("keeps a declared raster type and refuses anything else", () => {
    expect(previewBlob(bytes, "image", "image/webp", "a.webp").type).toBe("image/webp");
    expect(previewBlob(bytes, "image", "image/svg+xml", "a.png").type).toBe("image/png");
    expect(previewBlob(bytes, "image", "text/html", "a.jpg").type).toBe("image/jpeg");
    expect(previewBlob(bytes, "image", "text/html", "a").type).toBe("image/png");
  });
});
