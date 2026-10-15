/**
 * The frame every inner public page renders in — `/pricing`, `/product/*`, `/legal/*`.
 *
 * It is the landing page's own surface, piece for piece: the `.wp` warm design system, the shared
 * `MarketingNav` in its light-over-dark mode, and the landing `Footer`. Those pages used to be a
 * separate dark-petrol site with a different nav bar and footer, so leaving the homepage felt like
 * arriving somewhere else (owner request 2026-10-15). A page supplies its own dark `PageHero` and
 * cream sections; the frame supplies everything around them.
 *
 * Server component. The route must import `app/landing.css` (the `.wp` system) and
 * `app/marketing.css` (the nav's `--m-*` tokens), as `app/page.tsx` does.
 */
import type { CSSProperties, ReactNode } from "react";
import { MarketingNav } from "@/modules/marketing/marketing-nav";
import { Footer } from "@/modules/marketing/landing/sections";

// The root layout's Fraunces, exposed to `.wp` as its display face — the same wiring as the landing.
const displayVar = { "--wp-display": "var(--font-fraunces)" } as CSSProperties;

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#main" className="wp-skip">
        Skip to content
      </a>
      <div className="wp min-h-screen overflow-x-clip" style={displayVar}>
        {/* The landing's nav wiring, unchanged: `.m-root` only to scope the `--m-*` tokens
            (`display: contents`, so it draws no box), `wp-navlight` for the light bar it turns into
            once you scroll off the dark hero. See `app/page.tsx`. */}
        <div className="m-root wp-navlight" style={{ display: "contents" }}>
          <MarketingNav onDark />
        </div>
        <main id="main">{children}</main>
        <Footer allProducts />
      </div>
    </>
  );
}
