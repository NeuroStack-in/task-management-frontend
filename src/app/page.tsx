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

import "./landing.css";
import type { Metadata } from "next";
import { Fraunces, Space_Grotesk } from "next/font/google";
import { AuthGate, Nav, Hero } from "@/modules/marketing/landing/client";
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
          <Nav />
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
