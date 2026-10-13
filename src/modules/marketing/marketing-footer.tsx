import Link from "next/link";
import { CheckCheck } from "lucide-react";
import { Logo } from "@/modules/marketing/logo";
import { PRODUCTS, RESOURCES, SOLUTIONS, productHref } from "@/modules/marketing/products";
import { LEGAL_DOCS, legalHref } from "@/modules/legal/documents";

/**
 * Only links a signed-out visitor can follow, taken from the same shared lists the nav uses. This
 * footer used to keep its own list. Solutions pointed at a `/#solutions` anchor that no page has,
 * "Help center" pointed at the signed-in app, "API docs" at a roadmap page, and ten more (About,
 * Careers, Blog, Contact, Status, Privacy, Terms, DPA, Cookies) at `#` (QA audit 2026-10-08, WP-541).
 *
 * The legal links are back (WP-115). They come from `modules/legal/documents`, the registry that also
 * generates the `/legal/*` routes, so none of them can point at a page that doesn't exist. The
 * documents are drafts pending legal review, and each page says so. The company links stay out until
 * there is something to link to.
 */
const COLUMNS = [
  { h: "Solutions", links: SOLUTIONS },
  { h: "Resources", links: RESOURCES },
];

export function MarketingFooter() {
  return (
    <footer className="border-t px-5 pt-16 pb-10" style={{ borderColor: "var(--m-border)" }}>
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_repeat(3,1fr)]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm" style={{ color: "var(--m-muted)" }}>
              Workforce activity &amp; productivity — one clear pulse for the whole
              organization.
            </p>
            <div className="mt-5 flex gap-2.5">
              <CheckCheck className="size-4" style={{ color: "var(--m-muted)" }} />
              <span className="text-xs" style={{ color: "var(--m-muted)" }}>Encrypted in transit &amp; at rest</span>
            </div>
          </div>

          {/* Product column — all feature pages */}
          <div>
            <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--m-text)" }}>
              Product
            </p>
            <ul className="mt-3 space-y-2.5">
              {PRODUCTS.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={productHref(p.slug)}
                    className="text-sm transition-colors hover:opacity-70"
                    style={{ color: "var(--m-muted)" }}
                  >
                    {p.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {COLUMNS.map((c) => (
            <div key={c.h}>
              <p className="text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--m-text)" }}>
                {c.h}
              </p>
              <ul className="mt-3 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm transition-colors hover:opacity-70" style={{ color: "var(--m-muted)" }}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t pt-6 sm:flex-row" style={{ borderColor: "var(--m-border)" }}>
          <p className="text-xs" style={{ color: "var(--m-muted)" }}>
            © 2026 WorkPulse. All rights reserved.
          </p>
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs" style={{ color: "var(--m-muted)" }}>
            <Link href={productHref("security")} className="hover:opacity-70">Security</Link>
            {LEGAL_DOCS.map((d) => (
              <Link key={d.slug} href={legalHref(d.slug)} className="hover:opacity-70">
                {d.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
