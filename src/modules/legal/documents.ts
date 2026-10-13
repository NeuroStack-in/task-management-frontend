/**
 * The four legal documents: one registry for their routes (`app/legal/[slug]`), both marketing
 * footers and the sign-up consent box.
 *
 * The links were removed in the QA audit (2026-10-08, WP-115 / WP-541) because they pointed at `#`,
 * and the sign-up box asked people to agree to documents nobody could open. Everything that links
 * to a document reads it from this list, and the same list generates the routes, so a link can't
 * point at a page that doesn't exist.
 *
 * Plain data only, with no JSX and no `"use client"`. The client sign-up form imports it, and so do
 * the server-rendered footers.
 */

export type LegalSlug = "terms" | "privacy" | "dpa" | "cookies";

export interface LegalDocMeta {
  slug: LegalSlug;
  /** Full title: the page heading and the document's `<title>`. */
  title: string;
  /** Short label for footer rows. */
  label: string;
  /** One sentence, used as the page lede and the meta description. */
  summary: string;
}

export const LEGAL_BASE = "/legal";

export const LEGAL_DOCS: LegalDocMeta[] = [
  {
    slug: "terms",
    title: "Terms of Service",
    label: "Terms",
    summary:
      "The terms that govern an organization's use of WorkPulse: accounts, monitoring responsibilities, acceptable use, beta plans and liability.",
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    label: "Privacy",
    summary:
      "What WorkPulse collects, why, which providers process it, how long it is kept, and how employees and customers can exercise their rights.",
  },
  {
    slug: "dpa",
    title: "Data Processing Agreement",
    label: "DPA",
    summary:
      "How WorkPulse processes personal data on behalf of customer organizations, including its security measures and its sub-processors.",
  },
  {
    slug: "cookies",
    title: "Cookie Policy",
    label: "Cookies",
    summary:
      "The one cookie and the browser storage WorkPulse uses, what each is for, and how to control them. No advertising, analytics or tracking cookies.",
  },
];

export const legalHref = (slug: LegalSlug) => `${LEGAL_BASE}/${slug}`;
export const legalDocBySlug = (slug: string) => LEGAL_DOCS.find((d) => d.slug === slug);

/**
 * **Every document is a draft awaiting legal review.** The owner decided on 2026-10-09: "I draft,
 * you review". While this is `true`, each page:
 *
 *  - opens with the "DRAFT — pending legal review. Not yet in effect." banner,
 *  - has "(draft)" in its `<title>`, and
 *  - asks search engines not to index it, so a draft never shows up in search results as though it
 *    were in force.
 *
 * Set it to `false` only after counsel has approved the text, every value in `placeholders.ts` has
 * been filled in (`legal.test.tsx` fails otherwise), and every `REVIEW:` comment in `content/` has
 * been resolved.
 */
export const LEGAL_DRAFT: boolean = true;

/** When this draft was written. Shown beside the effective date while `LEGAL_DRAFT` is set. */
export const DRAFT_DATE = "9 October 2026";
