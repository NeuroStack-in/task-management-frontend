/**
 * The dark clock hero for the inner public pages — the landing hero's surface (`.wp-hero-dark`,
 * the `ClockBackdrop` dial and its scrim), sized for a page that has a job to do rather than a
 * brand to introduce.
 *
 * Three layouts:
 *  · `center` — the landing's own: copy centred over the dial (pricing).
 *  · `split`  — copy left, a visual right, the dial behind the visual (a product page with a demo).
 *  · `start`  — copy left, the dial pushed off to the right and held still (legal: a page people
 *               read closely gets no motion in the corner of their eye — see `ClockBackdrop.still`).
 *
 * `overlap` leaves room at the bottom for the next section to ride up over the edge, the way the
 * landing's dashboard cards straddle its hero. The section that follows pulls itself up with a
 * matching negative margin.
 *
 * Server component. Entrance motion is CSS only (`.wp-enter`), and switched off under
 * `prefers-reduced-motion` with the rest of `.wp`.
 */
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { ClockBackdrop } from "@/modules/marketing/clock-backdrop";

export interface Crumb {
  label: string;
  href?: string;
}

export interface PageHeroProps {
  /** Small uppercase line above the title. */
  kicker?: ReactNode;
  /** A breadcrumb trail in place of (or above) the kicker. */
  crumbs?: Crumb[];
  /** An icon badge above everything — a product's own icon. */
  badge?: ReactNode;
  /** The `<h1>`. Wrap the line to emphasise in `<em>` for the italic teal accent. */
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  /** Fine print under the actions. */
  micro?: ReactNode;
  /** A visual for the right-hand column; implies the `split` layout. */
  aside?: ReactNode;
  align?: "center" | "start";
  overlap?: "none" | "md" | "lg";
}

const delay = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

const BOTTOM = {
  none: "pb-16 sm:pb-20",
  md: "pb-32 sm:pb-40",
  lg: "pb-40 sm:pb-52",
} as const;

export function PageHero({
  kicker,
  crumbs,
  badge,
  title,
  lede,
  actions,
  micro,
  aside,
  align = "center",
  overlap = "none",
}: PageHeroProps) {
  const layout = aside ? "split" : align;
  const centred = layout === "center";

  return (
    <section className={`wp-hero-dark px-5 pt-28 sm:pt-36 ${BOTTOM[overlap]}`}>
      {layout === "split" ? (
        <ClockBackdrop className="aspect-square w-[min(150vw,900px)]" left="74%" top="52%" glow="size-[70vw] max-w-[700px]" />
      ) : layout === "start" ? (
        <ClockBackdrop className="aspect-square w-[min(120vw,760px)]" left="88%" top="46%" glow="size-[60vw] max-w-[600px]" intensity={0.85} still />
      ) : (
        <ClockBackdrop className="aspect-square w-[min(150vw,880px)]" top="46%" />
      )}
      <div className="wp-hero-scrim" data-align={layout} aria-hidden="true" />

      <div
        className={`relative z-10 mx-auto ${
          layout === "split"
            ? "grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16"
            : layout === "start"
              ? "max-w-6xl"
              : "max-w-3xl text-center"
        }`}
      >
        <div className={layout === "split" ? "text-center lg:text-left" : layout === "start" ? "max-w-3xl" : ""}>
          {badge ? (
            <div className={`wp-enter mb-6 flex ${centred ? "justify-center" : "justify-center lg:justify-start"}`}>
              {badge}
            </div>
          ) : null}

          {crumbs?.length ? (
            <nav aria-label="Breadcrumb" className="wp-enter mb-5">
              <ol
                className={`flex flex-wrap items-center gap-1.5 text-xs font-medium ${
                  centred ? "justify-center" : layout === "split" ? "justify-center lg:justify-start" : ""
                }`}
              >
                {crumbs.map((c, i) => (
                  <li key={c.label} className="inline-flex items-center gap-1.5">
                    {i > 0 ? <ChevronRight className="size-3 opacity-50" aria-hidden="true" /> : null}
                    {c.href ? (
                      <Link href={c.href} className="wp-hero-muted -my-1 inline-block py-1 transition-colors hover:text-white">
                        {c.label}
                      </Link>
                    ) : (
                      <span aria-current="page" style={{ color: "var(--wp-accent-glow)" }}>
                        {c.label}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}

          {kicker ? (
            <p className="wp-kicker wp-enter mb-5" style={{ color: "var(--wp-accent-glow)", ...delay(40) }}>
              {kicker}
            </p>
          ) : null}

          <h1
            className={`wp-page-title wp-enter ${
              layout === "start" ? "text-[clamp(2.3rem,5vw,3.6rem)]" : "text-[clamp(2.5rem,6vw,4.4rem)]"
            }`}
            style={delay(90)}
          >
            {title}
          </h1>

          {lede ? (
            <p
              className={`wp-hero-muted wp-enter mt-6 text-base leading-relaxed sm:text-lg ${
                centred ? "mx-auto max-w-xl" : layout === "split" ? "mx-auto max-w-xl lg:mx-0" : "max-w-2xl"
              }`}
              style={delay(170)}
            >
              {lede}
            </p>
          ) : null}

          {actions ? (
            <div
              className={`wp-enter mt-9 flex flex-wrap items-center gap-3 ${
                centred ? "justify-center" : layout === "split" ? "justify-center lg:justify-start" : ""
              }`}
              style={delay(250)}
            >
              {actions}
            </div>
          ) : null}

          {micro ? (
            <div className="wp-hero-muted wp-enter mt-5 text-sm" style={delay(320)}>
              {micro}
            </div>
          ) : null}
        </div>

        {aside ? (
          <div className="wp-enter" style={delay(260)}>
            {aside}
          </div>
        ) : null}
      </div>
    </section>
  );
}
