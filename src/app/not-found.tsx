import "./landing.css";
import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { ClockBackdrop } from "@/modules/marketing/clock-backdrop";

// The root layout's Fraunces, exposed to `.wp` as its display face — the same wiring as the landing.
const displayVar = { "--wp-display": "var(--font-fraunces)" } as CSSProperties;

/**
 * The branded 404 — any unknown URL, and every `notFound()`.
 *
 * Without it Next served its own white "404 | This page could not be found." with no branding and
 * no way back except the browser, for a stale bookmark or a typo under the signed-in area alike
 * (QA audit 2026-10-08, WP-118). Both links work signed in or out: the dashboard bounces a
 * signed-out visitor to sign-in.
 *
 * Since 2026-10-15 it is the landing hero's dark clock surface, full screen, rather than a plain
 * centred message — the one page every visitor can hit by accident should still look like WorkPulse.
 * No marketing nav: signed-in people land here too.
 */
export default function NotFound() {
  return (
    <div className="wp" style={displayVar}>
      <section className="wp-hero-dark wp-lost flex flex-col px-5">
        <ClockBackdrop className="aspect-square w-[min(160vw,940px)]" top="50%" />
        <div className="wp-hero-scrim" aria-hidden="true" />

        <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center py-5 sm:px-3">
          <Link href="/" aria-label="WorkPulse home" className="inline-flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-[10px]" style={{ background: "var(--wp-accent)" }}>
              <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
                <path d="M2 12h4l2-6 4 12 3-8 2 4h5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="wp-display text-xl text-white">WorkPulse</span>
          </Link>
        </header>

        <main className="relative z-10 m-auto max-w-2xl py-16 text-center">
          <p className="wp-kicker wp-enter" style={{ color: "var(--wp-accent-glow)" }}>
            Error 404
          </p>
          <h1 className="wp-page-title wp-enter mt-5 text-[clamp(2.6rem,7vw,4.8rem)]" style={{ "--d": "80ms" } as CSSProperties}>
            This page is <em className="block">off the clock.</em>
          </h1>
          <p className="wp-hero-muted wp-enter mx-auto mt-6 max-w-md text-base leading-relaxed sm:text-lg" style={{ "--d": "160ms" } as CSSProperties}>
            We couldn&apos;t find that page. The link may be out of date, or the page may have moved —
            head back to the dashboard and carry on from there.
          </p>
          <div className="wp-enter mt-9 flex flex-wrap items-center justify-center gap-3" style={{ "--d": "240ms" } as CSSProperties}>
            <Link href="/dashboard" className="wp-btn wp-btn-primary">
              Back to dashboard <ArrowRight className="size-4" />
            </Link>
            <Link href="/" className="wp-btn wp-btn-glass">
              WorkPulse home
            </Link>
          </div>
        </main>
      </section>
    </div>
  );
}
