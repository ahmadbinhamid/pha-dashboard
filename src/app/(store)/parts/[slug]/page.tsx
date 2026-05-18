import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { mockFetchProductBySlug } from "@/lib/store/api/catalog-mock";
import { ProductPdp } from "@/components/store/product-pdp";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const p = await mockFetchProductBySlug(slug);
  if (!p) return { title: "Part not found" };
  return {
    title: p.name,
    description: p.description.slice(0, 155),
    openGraph: { title: p.name, description: p.description.slice(0, 155) },
  };
}

export default async function StorePartPage({ params }: Props) {
  const { slug } = await params;
  const product = await mockFetchProductBySlug(slug);
  if (!product) notFound();
  return <ProductPdp product={product} />;
}
