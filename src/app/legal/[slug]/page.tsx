import "../../marketing.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LEGAL_DOCS, LEGAL_DRAFT, legalDocBySlug } from "@/modules/legal/documents";
import { LEGAL_CONTENT } from "@/modules/legal/content";
import { LegalPage } from "@/modules/legal/legal-page";

/**
 * `/legal/terms`, `/legal/privacy`, `/legal/dpa`, `/legal/cookies`, built the same way as
 * `/product/[slug]`: generated from one registry, with the page delegating to its module.
 */
export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ slug: d.slug }));
}

/**
 * Only those four exist. An unknown slug is a real 404 at routing time, not a 200 carrying a 404 body
 * (the `/product/[slug]` bug in the QA audit, 2026-10-08, WP-379).
 */
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = legalDocBySlug(slug);
  if (!meta) return { title: "Legal" };
  return {
    // The root layout's template appends "· WorkPulse".
    title: LEGAL_DRAFT ? `${meta.title} (draft)` : meta.title,
    description: meta.summary,
    // A draft that is "not yet in effect" must not appear in search results as though it were.
    ...(LEGAL_DRAFT ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const meta = legalDocBySlug(slug);
  if (!meta) notFound();
  return <LegalPage meta={meta} doc={LEGAL_CONTENT[meta.slug]} />;
}
