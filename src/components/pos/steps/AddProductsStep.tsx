import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Package, ShoppingCart } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { NativeSelect } from "@/components/ui/Select";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/Tooltip";
import { AddToCartButton } from "@/components/pos/AddToCartButton";
import { CartItemRow } from "@/components/pos/CartItemRow";
import { useCart } from "@/context/cart";
import { getProducts } from "@/lib/api/products";
import { getCategories } from "@/lib/api/categories";
import { formatCurrency } from "@/utils/format";

// Continuing to step 2 needs no validation beyond "cart isn't empty" — the
// page header's Next button checks that directly, so this step doesn't need
// its own bottom button or an onContinue prop.
export function AddProductsStep() {
  const { items, totalPrice } = useCart();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: productsRes, isFetching } = useQuery({
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
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Product List" description="Search and add products to this order" />
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/40" />
            <Input
              placeholder="Search by product name or SKU…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <NativeSelect value={category} onChange={(e) => setCategory(e.target.value)} className="sm:w-48">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div className="max-h-112 divide-y divide-border overflow-y-auto">
          {isFetching && products.length === 0 ? (
            <div className="py-10 text-center text-sm text-fg/50">Loading products…</div>
          ) : products.length === 0 ? (
            <div className="py-10 text-center text-sm text-fg/50">No products found.</div>
          ) : (
            products.map((product) => (
              <div key={product._id} className="flex items-center gap-3 px-5 py-3">
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xs border border-border bg-bg-2">
                  {product.attachments?.[0]?.url ? (
                    <img
                      src={product.attachments[0].url}
                      alt={product.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Package className="h-4 w-4 text-fg/25" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="truncate font-medium text-fg">{product.title}</div>
                    </TooltipTrigger>
                    <TooltipContent side="top">{product.title}</TooltipContent>
                  </Tooltip>
                  {product.has_variants && <span className="text-xs text-fg/45">Has variants</span>}
                </div>
                <div className="w-20 shrink-0 text-right text-sm text-fg/70">{formatCurrency(product.price)}</div>
                <AddToCartButton product={product} display="icon-solid" className="shrink-0" />
              </div>
            ))
          )}
        </div>
      </Card>

      <div>
        <Card>
          <CardHeader title="Basket" description={`${items.length} item${items.length !== 1 ? "s" : ""}`} />
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <ShoppingCart className="h-8 w-8 text-fg/25" />
              <p className="text-sm text-fg/50">No products added yet.</p>
            </div>
          ) : (
            <div className="max-h-96 divide-y divide-border overflow-y-auto">
              {items.map((item) => (
                <CartItemRow key={item.key} item={item} />
              ))}
            </div>
          )}
          <div className="border-t border-border px-5 py-4">
            <div className="flex justify-between text-sm font-semibold text-fg">
              <span>Total</span>
              <span>{formatCurrency(totalPrice)}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
