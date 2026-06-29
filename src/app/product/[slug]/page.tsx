import "../../marketing.css";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PRODUCT_CONTENT } from "@/modules/marketing/product/content";
import { ProductPage } from "@/modules/marketing/product/product-page";

export function generateStaticParams() {
  return Object.keys(PRODUCT_CONTENT).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = PRODUCT_CONTENT[slug];
  if (!data) return { title: "Product" };
  return {
    title: `${data.eyebrow} — WorkPulse`,
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
