import { Suspense } from "react";
import { ProductCatalogView } from "@/components/store/product-catalog-view";
import { CatalogSkeleton } from "@/components/store/catalog-skeleton";

export default function SearchPage() {
  return (
    <Suspense fallback={<CatalogSkeleton />}>
      <ProductCatalogView mode="search" />
    </Suspense>
  );
}
