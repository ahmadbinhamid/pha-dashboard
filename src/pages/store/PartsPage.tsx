import { Suspense } from "react";
import { ProductCatalogView } from "@/components/store/product-catalog-view";
import { CatalogSkeleton } from "@/components/store/catalog-skeleton";

export default function PartsPage() {
  return (
    <Suspense fallback={<CatalogSkeleton />}>
      <ProductCatalogView mode="products" />
    </Suspense>
  );
}
