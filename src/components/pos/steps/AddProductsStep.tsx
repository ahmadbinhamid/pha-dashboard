import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package, Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { NativeSelect } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/Tooltip";
import { AddToCartButton } from "@/components/pos/AddToCartButton";
import { getProducts } from "@/lib/api/products";
import { getCategories } from "@/lib/api/categories";
import { formatCurrency } from "@/utils/format";

// Product picker for step 1. The running basket lives in OrderSummaryPanel instead, which stays put across steps 1 and 2. Continuing needs no validation beyond "cart isn't empty", checked directly by the page header's Next button.
export function AddProductsStep() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: productsRes, isLoading } = useQuery({
    queryKey: ["pos-products", debouncedSearch, category],
    queryFn: () => getProducts({ search: debouncedSearch, categories: category, limit: 20 }),
  });
  const products = productsRes?.data?.items ?? [];

  const { data: categoriesRes } = useQuery({
    queryKey: ["categories", "all"],
    queryFn: () => getCategories({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });
  const categories = categoriesRes?.data?.items ?? [];

  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-fg">Add Products</h2>
        <p className="mt-0.5 text-xs text-fg/50">Search the catalogue and add lines to this order.</p>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/40" />
            <Input
              placeholder="Search by product name or SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <NativeSelect value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-52">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {/* Scrolls inside the card rather than growing the page, so the search row and summary panel beside it both stay in view. */}
      <div className="min-h-[22rem] divide-y divide-border/60 overflow-y-auto lg:max-h-[calc(100vh-22rem)]">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-5 py-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
            </div>
          ))
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-5 py-16 text-center">
            <Package className="h-7 w-7 text-fg/20" />
            <p className="text-sm text-fg/55">No products match those filters</p>
            <p className="text-xs text-fg/40">Try a different search term or category.</p>
          </div>
        ) : (
          products.map((product) => (
            <div key={product._id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                {product.attachments?.[0]?.url ? (
                  <img src={product.attachments[0].url} alt={product.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Package className="h-4 w-4 text-fg/25" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="truncate text-sm font-medium text-fg">{product.title}</div>
                  </TooltipTrigger>
                  <TooltipContent side="top">{product.title}</TooltipContent>
                </Tooltip>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-fg/45">
                  {product.sku ? <span className="font-mono">{product.sku}</span> : null}
                  {product.sku && product.has_variants ? <span aria-hidden>·</span> : null}
                  {product.has_variants ? <span>Has variants</span> : null}
                </div>
              </div>

              <div className="shrink-0 text-right text-sm font-semibold text-fg tabular-nums">
                {formatCurrency(product.price)}
              </div>
              <AddToCartButton product={product} display="icon-solid" className="shrink-0" />
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
