import type { ReactNode } from "react";

/** One numbered section of a legal document. `id` is its in-page anchor (`#id`) and must be unique. */
export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

export interface LegalDocument {
  sections: LegalSection[];
}
