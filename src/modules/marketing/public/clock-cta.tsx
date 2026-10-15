/**
 * The closing call to action on the inner public pages: the landing's dark rounded panel
 * (`CtaSection` in `landing/sections.tsx`), with the dial posed in its corner so the page ends on
 * the same mark it opened with. The dial is held still — it sits beside the buttons.
 */
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { ClockBackdrop } from "@/modules/marketing/clock-backdrop";
import { Reveal } from "@/modules/marketing/landing/client";

export interface CtaLink {
  label: string;
  href: string;
}

export function ClockCta({
  title,
  body,
  primary = { label: "Start free", href: "/register" },
  secondary,
}: {
  /** Wrap a phrase in `<em>` for the italic teal accent. */
  title: ReactNode;
  body: ReactNode;
  primary?: CtaLink;
  secondary?: CtaLink;
}) {
  return (
    <section className="px-5 py-24 sm:py-32">
      <Reveal variant="scale">
        <div
          className="relative mx-auto max-w-5xl overflow-hidden rounded-[32px] px-7 py-14 sm:px-16 sm:py-20"
          style={{ background: "var(--wp-ink)" }}
        >
          {/* The dial takes the panel's empty right side; on a phone there is no empty side, so it
              stays out of the way of the copy. */}
          <div className="hidden md:block" aria-hidden="true">
            <ClockBackdrop className="aspect-square w-[600px]" left="86%" top="50%" glow="size-[560px]" intensity={0.9} still />
          </div>
          <div className="relative max-w-xl text-center md:text-left">
            {/* No halo here: it exists to lift type off the busy hero dial, and on this flat panel it
                showed as a cool patch behind the words. */}
            <h2 className="wp-page-title text-[clamp(2.2rem,5vw,3.6rem)]" style={{ textShadow: "none" }}>
              {title}
            </h2>
            <p className="mx-auto mt-4 max-w-md text-base leading-relaxed md:mx-0" style={{ color: "rgb(255 255 255 / 0.72)" }}>
              {body}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 md:justify-start">
              <Link href={primary.href} className="wp-btn wp-btn-primary">
                {primary.label} <ArrowRight className="size-4" />
              </Link>
              {secondary ? (
                <Link href={secondary.href} className="wp-btn wp-btn-glass">
                  {secondary.label}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/** A section heading in the landing's voice: teal kicker, serif title, optional lede. */
export function SectionHead({
  kicker,
  title,
  lede,
  align = "center",
}: {
  kicker: string;
  title: ReactNode;
  lede?: ReactNode;
  align?: "center" | "start";
}) {
  return (
    <Reveal className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="wp-kicker">{kicker}</p>
      <h2 className="wp-display mt-4 text-[clamp(2rem,4.5vw,3.1rem)]" style={{ color: "var(--wp-ink)" }}>
        {title}
      </h2>
      {lede ? (
        <p className="mt-4 text-lg leading-relaxed" style={{ color: "var(--wp-muted)" }}>
          {lede}
        </p>
      ) : null}
    </Reveal>
  );
}
