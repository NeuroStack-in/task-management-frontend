/**
 * The shell every legal document renders in. It follows the wireframe (Docs/wireframes/01, §1.7–1.8):
 * an in-page contents list on the left, the prose on the right, and the dates at the top.
 *
 * Since 2026-10-15 it sits on the landing's surface, like `/pricing` and `/product/*`: a dark clock
 * hero carrying the title, the dates and the four-document switcher, then the document itself as a
 * sheet of paper riding up over the hero's edge. The dial is held still on these pages
 * (`PageHero align="start"`). The prose components in `prose.tsx` are written against the `--m-*`
 * names; `.wp-mtokens` (landing.css) points those at the warm palette, so the documents needed no
 * change.
 *
 * The text is deliberately not wrapped in `Reveal`: content that fades in as you scroll is wrong for
 * a document people read closely, and wrong for anyone jumping to a section from the contents list.
 */
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import type { CSSProperties } from "react";
import { PublicShell } from "@/modules/marketing/public/public-shell";
import { PageHero } from "@/modules/marketing/public/page-hero";
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

/** "Privacy Policy" → "Privacy *Policy*": the hero's italic accent on the last word. */
function titleWithAccent(title: string) {
  const at = title.lastIndexOf(" ");
  if (at < 0) return title;
  return (
    <>
      {title.slice(0, at)} <em>{title.slice(at + 1)}</em>
    </>
  );
}

export function LegalPage({ meta, doc }: { meta: LegalDocMeta; doc: LegalDocument }) {
  return (
    <PublicShell>
      <PageHero
        align="start"
        kicker="Legal"
        title={titleWithAccent(meta.title)}
        lede={meta.summary}
        actions={<DocSwitcher current={meta.slug} />}
        micro={
          // `Ph` marks an unfilled placeholder in the `--m-*` accent; on the dark hero that has to be
          // the light teal, or the mark reads dark-on-dark.
          <span
            className="wp-mono text-xs"
            style={{ "--m-accent": "var(--wp-accent-glow)", "--m-accent-ink": "#fff" } as CSSProperties}
          >
            Effective date: <Ph k="effectiveDate" />
            {LEGAL_DRAFT ? <> · Draft of {DRAFT_DATE}</> : null}
          </span>
        }
        overlap="md"
      />

      <div className="wp-mtokens relative z-10 -mt-20 px-5 pb-24 sm:-mt-24 sm:pb-32">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-8">
          <Contents sections={doc.sections} />
          <article className="wp-card min-w-0 p-6 sm:p-10 lg:p-14" style={{ boxShadow: "var(--wp-shadow)" }}>
            {LEGAL_DRAFT ? <DraftBanner /> : null}
            <div className="max-w-3xl">
              {doc.sections.map((s, i) => (
                <section
                  key={s.id}
                  id={s.id}
                  aria-labelledby={`${s.id}-title`}
                  // Clears the fixed nav (h-16) when a contents link jumps here.
                  className="mt-12 scroll-mt-24 border-t pt-12 first:mt-0 first:border-t-0 first:pt-0"
                  style={{ borderColor: "var(--wp-border)" }}
                >
                  <h2
                    id={`${s.id}-title`}
                    className="wp-display flex items-baseline gap-3 text-2xl sm:text-[1.7rem]"
                    style={{ color: "var(--wp-ink)" }}
                  >
                    <span className="wp-mono shrink-0 text-sm font-medium" style={{ color: "var(--wp-accent-ink)" }}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{s.title}</span>
                  </h2>
                  <div className="mt-5 text-[15px] sm:text-base">{s.body}</div>
                </section>
              ))}
            </div>
          </article>
        </div>
      </div>
    </PublicShell>
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
      className="mb-12 flex items-start gap-3 rounded-2xl border p-4 sm:p-5"
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

/** The four documents as a row of links, with the current one marked — glass pills on the dark hero. */
function DocSwitcher({ current }: { current: LegalSlug }) {
  return (
    <nav aria-label="Legal documents">
      <ul className="flex flex-wrap gap-2">
        {LEGAL_DOCS.map((d) => {
          const on = d.slug === current;
          return (
            <li key={d.slug}>
              <Link
                href={legalHref(d.slug)}
                aria-current={on ? "page" : undefined}
                className="inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition-colors"
                style={
                  on
                    ? { background: "#fff", borderColor: "#fff", color: "var(--wp-ink)" }
                    : { background: "rgb(255 255 255 / 0.06)", borderColor: "rgb(255 255 255 / 0.22)", color: "rgb(255 255 255 / 0.82)" }
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
      <details className="wp-card p-5 lg:hidden">
        <summary className="cursor-pointer text-sm font-semibold" style={{ color: "var(--wp-ink)" }}>
          On this page
        </summary>
        <nav aria-label="On this page" className="mt-3">
          {list}
        </nav>
      </details>
      <nav
        aria-label="On this page"
        className="wp-card hidden p-5 lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto"
      >
        <p className="wp-kicker mb-3">On this page</p>
        {list}
      </nav>
    </>
  );
}
