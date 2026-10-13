import "../../marketing.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PRODUCT_CONTENT } from "@/modules/marketing/product/content";
import { ProductPage } from "@/modules/marketing/product/product-page";

export function generateStaticParams() {
  return Object.keys(PRODUCT_CONTENT).map((slug) => ({ slug }));
}

/**
 * Only the slugs above exist. An unknown one is a real 404 at routing time — rendered on demand, the
 * page's `notFound()` ran after the root loading boundary had already streamed a 200, so
 * `/product/<anything>` answered 200 with a 404 body (QA audit 2026-10-08, WP-379).
 */
export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = PRODUCT_CONTENT[slug];
  if (!data) return { title: "Product" };
  return {
    // The root layout's template appends "· WorkPulse" — adding it here doubled the brand.
    title: data.eyebrow,
    description: data.lede,
  };
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = PRODUCT_CONTENT[slug];
  if (!data) notFound();
  return <ProductPage data={data} />;
}
