import { useParams } from "react-router-dom";
import { mockFetchProductBySlugSync as mockFetchProductBySlug } from "@/lib/store/api/catalog-mock";
import { ProductPdp } from "@/components/store/product-pdp";

export default function ProductPdpPage() {
  const { slug } = useParams<{ slug: string }>();
  const product = mockFetchProductBySlug(slug ?? "");

  if (!product) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-fg">Part not found</h1>
        <p className="mt-2 text-sm text-fg/60">The product you&apos;re looking for doesn&apos;t exist or has been removed.</p>
      </div>
    );
  }

  return <ProductPdp product={product} />;
}
