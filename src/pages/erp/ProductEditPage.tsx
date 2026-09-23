import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProductEditForm } from "@/components/products/ProductEditForm";
import { getProduct } from "@/lib/api/products";
import { getCategories } from "@/lib/api/categories";

// ── Skeleton ──────────────────────────────────────────────────────────────────
function ProductEditSkeleton() {
  return (
    <div className="space-y-5 pb-24">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-5 lg:col-span-2">
          {[180, 120, 100].map((h, i) => (
            <div key={i} className="rounded-xs border border-border bg-card p-5 space-y-4">
              <Skeleton className="h-4 w-36" />
              <Skeleton className={`h-${h === 180 ? 10 : 10} w-full`} />
              {h === 180 && <Skeleton className="h-32 w-full" />}
            </div>
          ))}
        </div>
        {/* Sidebar */}
        <div className="space-y-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xs border border-border bg-card p-5 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
// Thin data-loading shell — ProductEditForm only mounts once `product` is guaranteed non-null, so useForm's defaultValues build from real data on the first render, sidestepping the reset()-after-load race.
export default function ProductEditPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data: productData, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => getProduct(slug!),
    enabled: !!slug,
  });
  const product = productData?.data;

  const { data: categoriesRes } = useQuery({
    queryKey: ["categories", "all"],
    queryFn: () => getCategories({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });
  const categoryOptions = (categoriesRes?.data?.items ?? []).map((c) => ({
    value: c._id,
    label: c.name,
  }));

  if (isLoading || !product || !slug) {
    return <ProductEditSkeleton />;
  }

  return <ProductEditForm key={product._id} product={product} slug={slug} categoryOptions={categoryOptions} />;
}
