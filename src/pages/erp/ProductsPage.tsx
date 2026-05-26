import { useState, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductRow } from "@/components/products/product-row";
import { getProducts } from "@/lib/api/products";
import type { Product } from "@/types/product";
import { Plus, Search, Package, ChevronLeft, ChevronRight } from "lucide-react";

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Active", value: "active" },
  { label: "Draft", value: "draft" },
];

export default function ProductsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1", 10);

  const [inputValue, setInputValue] = useState(search);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (inputValue) next.set("search", inputValue);
        else next.delete("search");
        next.set("page", "1");
        return next;
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [inputValue, setSearchParams]);

  const setStatus = useCallback(
    (val: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (val) next.set("status", val);
        else next.delete("status");
        next.set("page", "1");
        return next;
      });
    },
    [setSearchParams],
  );

  const setPage = useCallback(
    (p: number) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("page", String(p));
        return next;
      });
    },
    [setSearchParams],
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["products", { search, status, page }],
    queryFn: () => getProducts({ search, status, page }),
  });

  const products: Product[] = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const totalPages = data?.data?.totalPages ?? 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Products</h1>
          <p className="mt-1 text-sm text-fg/60">
            {total > 0
              ? `${total} product${total !== 1 ? "s" : ""}`
              : "Manage your product catalogue"}
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          className="gap-2 self-start sm:self-auto"
          onClick={() => navigate("/products/new")}
        >
          <Plus className="h-4 w-4" />
          New Product
        </Button>
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/40" />
            <Input
              placeholder="Search products..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex gap-1 rounded-lg bg-bg-2 p-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatus(f.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  status === f.value
                    ? "bg-bg text-fg shadow-sm"
                    : "text-fg/60 hover:text-fg"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-sm text-fg/50">
              Loading products...
            </div>
          ) : products.length === 0 ? (
            <EmptyState
              search={search}
              onNew={() => navigate("/products/new")}
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-2/40">
                  {[
                    "Product",
                    "Status",
                    "Type",
                    "Price",
                    "eBay",
                    "Created",
                  ].map((h, i) => (
                    <th
                      key={h}
                      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-fg/50 ${
                        i === 3
                          ? "text-right"
                          : i === 5
                            ? "text-right"
                            : "text-left"
                      } first:px-5 last:px-5`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((product) => (
                  <ProductRow
                    key={product._id}
                    product={product}
                    onClick={() => navigate(`/products/${product.slug}/edit`)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <div className="text-xs text-fg/50">
              Page {page} of {totalPages}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage(page - 1)}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages || isFetching}
                onClick={() => setPage(page + 1)}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function EmptyState({ search, onNew }: { search: string; onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-bg-2">
        <Package className="h-7 w-7 text-fg/30" />
      </div>
      <div>
        <div className="text-sm font-medium">No products found</div>
        <div className="mt-1 text-xs text-fg/50">
          {search
            ? "Try a different search term"
            : "Create your first product to get started"}
        </div>
      </div>
      {!search && (
        <Button
          variant="primary"
          size="sm"
          className="mt-2 gap-1.5"
          onClick={onNew}
        >
          <Plus className="h-3.5 w-3.5" />
          New Product
        </Button>
      )}
    </div>
  );
}
