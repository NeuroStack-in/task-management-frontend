/**
 * Typographic building blocks for the legal documents, styled on the dark marketing tokens
 * (`--m-*`, from `app/marketing.css`, which the route imports).
 *
 * They are server-safe on purpose: no hooks and no `"use client"`. The documents are static prose,
 * and nothing in them has to ship as client JavaScript.
 *
 * Notes for the reviewer live in the content files as `REVIEW:` comments, never on the page. These
 * pages are linked from the public footer, so anything rendered here is public, including while the
 * text is still a draft.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { legalHref, type LegalSlug } from "./documents";
import { PLACEHOLDERS, isPlaceholder, type PlaceholderKey } from "./placeholders";

const MUTED = { color: "var(--m-muted)" } as const;
const INK = { color: "var(--m-text)" } as const;
const LINK = { color: "var(--m-accent-ink)" } as const;

export function P({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 leading-relaxed first:mt-0" style={MUTED}>
      {children}
    </p>
  );
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="m-display mt-8 text-lg font-semibold first:mt-0">{children}</h3>;
}

export function UL({ children }: { children: ReactNode }) {
  return (
    <ul className="mt-4 list-disc space-y-2 pl-5 first:mt-0" style={MUTED}>
      {children}
    </ul>
  );
}

export function LI({ children }: { children: ReactNode }) {
  return <li className="pl-1 leading-relaxed">{children}</li>;
}

/** Emphasis in the full-contrast ink, for lead terms in lists and definitions. */
export function B({ children }: { children: ReactNode }) {
  return (
    <strong className="font-semibold" style={INK}>
      {children}
    </strong>
  );
}

/**
 * A value from `placeholders.ts`. While it is still a `[...]` placeholder it is highlighted so the
 * owner and reviewer can spot it. Once it is filled in, it renders as plain text.
 */
export function Ph({ k }: { k: PlaceholderKey }) {
  const value = PLACEHOLDERS[k];
  if (!isPlaceholder(value)) return <>{value}</>;
  return (
    <mark
      className="rounded px-1 font-medium"
      style={{
        background: "color-mix(in srgb, var(--m-accent) 20%, transparent)",
        color: "var(--m-accent-ink)",
      }}
    >
      {value}
    </mark>
  );
}

/** A link to another legal document. Same tab: it is the same site, and the visitor is reading. */
export function DocLink({ to, children }: { to: LegalSlug; children: ReactNode }) {
  return (
    <Link
      href={legalHref(to)}
      className="font-medium underline underline-offset-2"
      style={LINK}
    >
      {children}
    </Link>
  );
}

/** A plain-language summary box at the top of a document or section. */
export function Callout({ children }: { children: ReactNode }) {
  return (
    <div
      className="mt-4 rounded-xl border p-4 leading-relaxed first:mt-0"
      style={{ background: "var(--m-surface)", borderColor: "var(--m-border)", ...MUTED }}
    >
      {children}
    </div>
  );
}

/** Literal names (cookies, storage keys, hostnames), in the mono face so they read as identifiers. */
export function Code({ children }: { children: ReactNode }) {
  return (
    <code
      className="m-mono rounded px-1 py-0.5 text-[0.85em]"
      style={{ background: "var(--m-surface-2)", ...INK }}
    >
      {children}
    </code>
  );
}

/**
 * A data table. The bordered frame clips the corners and the inner box scrolls sideways, so a
 * four-column table on a phone stays reachable instead of being cut off. That was the pricing table's
 * bug in the QA audit (2026-10-08, WP-545). The first cell of each row is its header.
 */
export function Table({
  head,
  rows,
  minWidth = "38rem",
}: {
  head: string[];
  rows: ReactNode[][];
  minWidth?: string;
}) {
  return (
    <div
      className="mt-5 overflow-hidden rounded-xl border first:mt-0"
      style={{ borderColor: "var(--m-border)" }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm" style={{ minWidth }}>
          <thead>
            <tr style={{ background: "var(--m-surface)" }}>
              {head.map((h) => (
                <th key={h} scope="col" className="p-3 align-bottom font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--m-border)" }}>
                {row.map((cell, j) =>
                  j === 0 ? (
                    <th key={j} scope="row" className="p-3 align-top font-medium">
                      {cell}
                    </th>
                  ) : (
                    <td key={j} className="p-3 align-top leading-relaxed" style={MUTED}>
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
