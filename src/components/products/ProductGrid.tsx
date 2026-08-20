import { ProductCard } from "@/components/products/ProductCard";
import type { Product } from "@/types/product";

interface ProductGridProps {
  products: Product[];
  onProductClick: (product: Product) => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onTogglePublish: (product: Product, published: boolean) => void;
}

export function ProductGrid({
  products,
  onProductClick,
  onEdit,
  onDelete,
  onTogglePublish,
}: ProductGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard
          key={product._id}
          product={product}
          onClick={() => onProductClick(product)}
          onEdit={() => onEdit(product)}
          onDelete={() => onDelete(product)}
          onTogglePublish={(published) => onTogglePublish(product, published)}
        />
      ))}
    </div>
  );
}

export function ProductGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-md bg-card ring-1 ring-inset ring-border">
          <div className="aspect-square animate-pulse bg-bg-2" />
          <div className="space-y-2 p-3.5">
            <div className="h-3.5 w-full animate-pulse rounded-xs bg-bg-2" />
            <div className="h-3 w-2/3 animate-pulse rounded-xs bg-bg-2" />
            <div className="h-4 w-16 animate-pulse rounded-xs bg-bg-2" />
            <div className="h-5 w-20 animate-pulse rounded-xs bg-bg-2" />
          </div>
        </div>
      ))}
    </div>
  );
}
