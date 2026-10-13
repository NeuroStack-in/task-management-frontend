/**
 * The shell every legal document renders in. It follows the wireframe (Docs/wireframes/01, §1.7–1.8):
 * an in-page contents list on the left, the prose on the right, and the dates at the top.
 *
 * It is a server component on the same dark marketing surface as `/pricing` and `/product/*`, with
 * the shared nav and footer. The text is deliberately not wrapped in `Reveal`: content that fades in
 * as you scroll is wrong for a document people read closely, and wrong for anyone jumping to a section
 * from the contents list.
 */
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { MarketingNav } from "@/modules/marketing/marketing-nav";
import { MarketingFooter } from "@/modules/marketing/marketing-footer";
import {
  DRAFT_DATE,
  LEGAL_DOCS,
  LEGAL_DRAFT,
  legalHref,
  type LegalDocMeta,
  type LegalSlug,
} from "./documents";
import { Ph } from "./prose";
import type { LegalDocument, LegalSection } from "./types";

export function LegalPage({ meta, doc }: { meta: LegalDocMeta; doc: LegalDocument }) {
  return (
    <div className="m-root min-h-screen overflow-x-hidden">
      <MarketingNav />

      <main id="main" className="px-5 pt-28 pb-20 sm:pt-36 sm:pb-28">
        <div className="mx-auto max-w-6xl">
          {LEGAL_DRAFT ? <DraftBanner /> : null}

          <header className="max-w-3xl">
            <p
              className="text-sm font-medium tracking-wide uppercase"
              style={{ color: "var(--m-accent-ink)" }}
            >
              Legal
            </p>
            <h1 className="m-display mt-3 text-[clamp(2rem,4.5vw,3rem)] leading-tight font-semibold">
              {meta.title}
            </h1>
            <p
              className="mt-4 text-base leading-relaxed sm:text-lg"
              style={{ color: "var(--m-muted)" }}
            >
              {meta.summary}
            </p>
            <p className="mt-4 text-sm" style={{ color: "var(--m-muted)" }}>
              Effective date: <Ph k="effectiveDate" />
              {LEGAL_DRAFT ? <> · Draft of {DRAFT_DATE}</> : null}
            </p>
          </header>

          <DocSwitcher current={meta.slug} />

          <div className="mt-10 grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14">
            <Contents sections={doc.sections} />
            <article className="max-w-3xl min-w-0">
              {doc.sections.map((s, i) => (
                <section
                  key={s.id}
                  id={s.id}
                  aria-labelledby={`${s.id}-title`}
                  // Clears the fixed nav (h-16) when a contents link jumps here.
                  className="mt-10 scroll-mt-24 border-t pt-10 first:mt-0 first:border-t-0 first:pt-0"
                  style={{ borderColor: "var(--m-border)" }}
                >
                  <h2
                    id={`${s.id}-title`}
                    className="m-display text-xl font-semibold sm:text-2xl"
                  >
                    <span style={{ color: "var(--m-accent-ink)" }}>{i + 1}.</span>{" "}
                    {s.title}
                  </h2>
                  <div className="mt-4">{s.body}</div>
                </section>
              ))}
            </article>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}

/**
 * The status line every draft opens with, ahead of the title, so nobody reads a draft as binding.
 * `role="note"` rather than `alert`: it is part of the page, not a change announced while someone is
 * using it.
 */
function DraftBanner() {
  return (
    <div
      role="note"
      className="mb-10 flex items-start gap-3 rounded-2xl border p-4 sm:p-5"
      style={{
        borderColor: "color-mix(in srgb, var(--m-danger) 55%, transparent)",
        background: "color-mix(in srgb, var(--m-danger) 12%, transparent)",
      }}
    >
      <TriangleAlert
        className="mt-0.5 size-5 shrink-0"
        style={{ color: "var(--m-danger)" }}
        aria-hidden="true"
      />
      <div>
        <p className="text-base font-semibold">
          DRAFT — pending legal review. Not yet in effect.
        </p>
        <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--m-muted)" }}>
          This is a working draft, published for review. It is not yet part of any
          agreement and its wording will change. Text in [square brackets] is still to be
          filled in.
        </p>
      </div>
    </div>
  );
}

/** The four documents as a row of links, with the current one marked. */
function DocSwitcher({ current }: { current: LegalSlug }) {
  return (
    <nav aria-label="Legal documents" className="mt-8">
      <ul className="flex flex-wrap gap-2">
        {LEGAL_DOCS.map((d) => {
          const on = d.slug === current;
          return (
            <li key={d.slug}>
              <Link
                href={legalHref(d.slug)}
                aria-current={on ? "page" : undefined}
                className="inline-flex items-center rounded-full border px-3.5 py-1.5 text-sm transition-opacity hover:opacity-80"
                style={
                  on
                    ? {
                        background: "var(--m-accent-tint)",
                        borderColor: "var(--m-accent)",
                        color: "var(--m-accent-ink)",
                      }
                    : { borderColor: "var(--m-border-strong)", color: "var(--m-muted)" }
                }
              >
                {d.title}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The in-page contents list. On a phone it is a collapsed `<details>` at the top, because twenty
 * section links would push the text a full screen down. From `lg` it becomes a sticky column. These
 * are two separate elements because a closed `<details>` can't be forced open with CSS, and only one
 * of them is ever displayed (and so exposed to assistive tech) at a time.
 */
function Contents({ sections }: { sections: LegalSection[] }) {
  const list = (
    <ol className="space-y-1 text-sm">
      {sections.map((s, i) => (
        <li key={s.id}>
          <a
            href={`#${s.id}`}
            className="flex gap-2 rounded-md py-1 leading-snug transition-opacity hover:opacity-70"
            style={{ color: "var(--m-muted)" }}
          >
            <span className="w-6 shrink-0 tabular-nums">{i + 1}.</span>{" "}
            {/* The space is invisible in the flex row but keeps the link's name "1. Title", not "1.Title". */}
            <span>{s.title}</span>
          </a>
        </li>
      ))}
    </ol>
  );

  return (
    <>
      <details className="m-card p-4 lg:hidden">
        <summary className="cursor-pointer text-sm font-semibold">On this page</summary>
        <nav aria-label="On this page" className="mt-3">
          {list}
        </nav>
      </details>
      <nav
        aria-label="On this page"
        className="hidden lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto"
      >
        <p
          className="mb-3 text-xs font-semibold tracking-wide uppercase"
          style={{ color: "var(--m-text)" }}
        >
          On this page
        </p>
        {list}
      </nav>
    </>
  );
}
