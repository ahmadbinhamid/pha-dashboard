import type { Metadata } from "next";
import { INVENTORY } from "@/lib/data/inventory";
import { ProductDetails } from "@/components/products/product-details";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const p = INVENTORY.find((x) => x.id === id);
  if (!p) return { title: "Product not found" };
  return {
    title: `${p.title} · ${p.sku}`,
    description: `View inventory, pricing, and channel details for ${p.title}.`,
  };
}

export default async function ProductDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductDetails productId={id} />;
}
