import type { LegalSlug } from "../documents";
import type { LegalDocument } from "../types";
import { COOKIES } from "./cookies";
import { DPA } from "./dpa";
import { PRIVACY } from "./privacy";
import { TERMS } from "./terms";

/** Body of each document, keyed by the slugs in `LEGAL_DOCS`. `Record` makes a missing one a type error. */
export const LEGAL_CONTENT: Record<LegalSlug, LegalDocument> = {
  terms: TERMS,
  privacy: PRIVACY,
  dpa: DPA,
  cookies: COOKIES,
};
