/* ============================================================= *
 *  WorkPulse — Landing page (warm editorial redesign)            *
 *  Server component. Self-contained `.wp` design system (warm,   *
 *  light, terracotta) — deliberately does NOT use marketing.css. *
 *  Editorial serif (Fraunces) is scoped to this page only via    *
 *  next/font, so no other page is affected.                      *
 *                                                                *
 *  Nav · Hero · Use-cases · Stats · Features · Roles · Breadth · *
 *  How · Security · Principles · Pricing · FAQ · CTA · Footer     *
 * ============================================================= */

/*
 * `marketing.css` is imported here purely for the shared `MarketingNav`.
 *
 * The landing owns a self-contained `.wp` design system and deliberately avoided marketing.css —
 * but the nav is the one piece that must be identical across the marketing site, and it was
 * previously a landing-only copy that had drifted. Its `--m-*` tokens live on `.m-root`, not
 * `:root`, so the nav is wrapped in an `.m-root` element below; nothing else on the page picks
 * those tokens up, and the warm `.wp` palette is untouched.
 */
import "./landing.css";
import "./marketing.css";
import type { Metadata } from "next";
import { Fraunces, Space_Grotesk } from "next/font/google";
import { AuthGate, Hero } from "@/modules/marketing/landing/client";
import { MarketingNav } from "@/modules/marketing/marketing-nav";
import {
  MarqueeSection,
  StatsSection,
  FeaturesSection,
  RolesSection,
  BreadthSection,
  HowSection,
  SecuritySection,
  PrinciplesSection,
  PricingSection,
  FaqSection,
  CtaSection,
  Footer,
} from "@/modules/marketing/landing/sections";

// Editorial display serif — landing-scoped only (applied to the .wp wrapper).
const display = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--wp-display",
  display: "swap",
});

// Bold grotesk — hero title only.
const sansDisplay = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--wp-sans-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WorkPulse — Run your whole workforce on one calm pulse",
  description:
    "The all-in-one workforce platform. WorkPulse unifies time tracking, attendance, activity, and projects into one clear pulse — with AI that surfaces what needs attention. Calm, not clinical.",
  keywords: [
    "workforce management",
    "time tracking",
    "productivity analytics",
    "employee activity",
    "project management",
    "attendance",
    "payroll",
    "AI insights",
  ],
  openGraph: {
    title: "WorkPulse — Run your whole workforce on one calm pulse",
    description:
      "Time, attendance, activity, and projects unified into one clear pulse, with AI insight on every metric. Free during beta.",
    type: "website",
    siteName: "WorkPulse",
  },
  twitter: {
    card: "summary_large_image",
    title: "WorkPulse — Run your whole workforce on one calm pulse",
    description:
      "One platform for time, attendance, activity, projects, and AI insights. Calm, not clinical.",
  },
};

export default function LandingPage() {
  return (
    <>
      <a href="#main" className="wp-skip">
        Skip to content
      </a>
      <AuthGate>
        <div className={`wp min-h-screen overflow-x-clip ${display.variable} ${sansDisplay.variable}`}>
          {/* `onDark` because the hero behind it is the dark clock section: the bar stays
              transparent over it and turns into a frosted light bar once you scroll past.

              `display: contents` because `.m-root` also sets `background` and `color`, which this
              page does not want — the wrapper exists only to put the `--m-*` custom properties in
              scope for the nav. Custom properties inherit through the DOM regardless of `display`,
              so the tokens still reach it while the element itself generates no box at all. */}
          <div className="m-root" style={{ display: "contents" }}>
            <MarketingNav onDark />
          </div>
          <main id="main">
            <Hero />
            <MarqueeSection />
            <StatsSection />
            <FeaturesSection />
            <RolesSection />
            <BreadthSection />
            <HowSection />
            <SecuritySection />
            <PrinciplesSection />
            <PricingSection />
            <FaqSection />
            <CtaSection />
          </main>
          <Footer />
        </div>
      </AuthGate>
    </>
  );
}
