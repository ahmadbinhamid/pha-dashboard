
import { memo, useCallback, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "@/hooks";
import { useSearchParams } from "react-router-dom";
import { MAKES, CATEGORIES, WAREHOUSES } from "@/lib/store/data/catalog";
import type { CatalogFilters } from "@/lib/store/api/catalog-mock";
import { filterCatalogSync } from "@/lib/store/api/catalog-mock";
import { catalogFiltersFromSearchParams } from "@/lib/store/search-params";
import { ProductCard } from "@/components/store/product-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { NativeSelect as Select } from "@/components/ui/select";
import { cn } from "@/utils/cn";

function filtersToQuery(f: CatalogFilters): string {
  const p = new URLSearchParams();
  (Object.entries(f) as [keyof CatalogFilters, string | undefined][]).forEach(([k, v]) => {
    if (v && String(v).trim()) p.set(k, String(v));
  });
  return p.toString();
}

function countActiveCatalogFilters(f: CatalogFilters): number {
  return (Object.entries(f) as [keyof CatalogFilters, string | undefined][]).filter(
    ([, v]) => v != null && String(v).trim() !== "",
  ).length;
}

const CatalogFiltersFields = memo(function CatalogFiltersFields({
  filters,
  setFilter,
  clear,
  showToolbar = true,
}: {
  filters: CatalogFilters;
  setFilter: (patch: Partial<CatalogFilters>) => void;
  clear: () => void;
  showToolbar?: boolean;
}) {
  return (
    <>
      {showToolbar ? (
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Filters</span>
          <Button type="button" variant="ghost" size="sm" onClick={clear}>
            Clear
          </Button>
        </div>
      ) : null}

      <div>
        <label className="text-xs font-medium text-fg/60">Keyword</label>
        <Input
          className="mt-1"
          defaultValue={filters.q ?? ""}
          onBlur={(e) => setFilter({ q: e.target.value })}
          placeholder="Part name / SKU…"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-fg/60">VIN (placeholder)</label>
        <Input
          className="mt-1 font-mono text-xs"
          defaultValue={filters.vin ?? ""}
          onBlur={(e) => setFilter({ vin: e.target.value })}
          placeholder="WDD… / WB…"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-fg/60">Make</label>
        <Select
          className="mt-1"
          value={filters.make ?? ""}
          onChange={(e) => setFilter({ make: e.target.value || undefined })}
        >
          <option value="">Any</option>
          {MAKES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="text-xs font-medium text-fg/60">Model contains</label>
        <Input
          className="mt-1"
          defaultValue={filters.model ?? ""}
          onBlur={(e) => setFilter({ model: e.target.value })}
          placeholder="e.g. C-Class"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-fg/60">Year</label>
        <Input
          className="mt-1"
          defaultValue={filters.year ?? ""}
          onBlur={(e) => setFilter({ year: e.target.value })}
          placeholder="e.g. 2018"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-fg/60">Engine contains</label>
        <Input
          className="mt-1"
          defaultValue={filters.engine ?? ""}
          onBlur={(e) => setFilter({ engine: e.target.value })}
        />
      </div>

      <div>
        <label className="text-xs font-medium text-fg/60">Brand</label>
        <Select
          className="mt-1"
          value={filters.brand ?? ""}
          onChange={(e) => setFilter({ brand: e.target.value || undefined })}
        >
          <option value="">Any</option>
          {MAKES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <label className="text-xs font-medium text-fg/60">Category</label>
        <Select
          className="mt-1"
          value={filters.category ?? ""}
          onChange={(e) => setFilter({ category: e.target.value || undefined })}
        >
          <option value="">Any</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-fg/60">Condition</label>
          <Select
            className="mt-1"
            value={filters.condition ?? ""}
            onChange={(e) => setFilter({ condition: e.target.value || undefined })}
          >
            <option value="">Any</option>
            <option value="new">New</option>
            <option value="used">Used</option>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-fg/60">Type</label>
          <Select
            className="mt-1"
            value={filters.genuineType ?? ""}
            onChange={(e) => setFilter({ genuineType: e.target.value || undefined })}
          >
            <option value="">Any</option>
            <option value="genuine">Genuine</option>
            <option value="aftermarket">Aftermarket</option>
          </Select>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-fg/60">Stock</label>
        <Select
          className="mt-1"
          value={filters.inStock ?? ""}
          onChange={(e) => setFilter({ inStock: e.target.value || undefined })}
        >
          <option value="">Any</option>
          <option value="true">In stock only</option>
        </Select>
      </div>

      <div>
        <label className="text-xs font-medium text-fg/60">Warehouse</label>
        <Select
          className="mt-1"
          value={filters.warehouse ?? ""}
          onChange={(e) => setFilter({ warehouse: e.target.value || undefined })}
        >
          <option value="">Any</option>
          {WAREHOUSES.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-fg/60">Min $</label>
          <Input
            className="mt-1"
            defaultValue={filters.priceMin ?? ""}
            onBlur={(e) => setFilter({ priceMin: e.target.value })}
            inputMode="decimal"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-fg/60">Max $</label>
          <Input
            className="mt-1"
            defaultValue={filters.priceMax ?? ""}
            onBlur={(e) => setFilter({ priceMax: e.target.value })}
            inputMode="decimal"
          />
        </div>
      </div>
    </>
  );
});

export function ProductCatalogView({ mode = "products" }: { mode?: "products" | "search" }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sp] = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const filters = useMemo(() => catalogFiltersFromSearchParams(Object.fromEntries(sp.entries())), [sp]);

  const products = useMemo(() => filterCatalogSync(filters), [filters]);
  const activeFilterCount = useMemo(() => countActiveCatalogFilters(filters), [filters]);

  const setFilter = useCallback(
    (patch: Partial<CatalogFilters>) => {
      const next: CatalogFilters = { ...filters, ...patch };
      Object.keys(next).forEach((k) => {
        const key = k as keyof CatalogFilters;
        if (!next[key]) delete next[key];
      });
      const qs = filtersToQuery(next);
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname);
      });
    },
    [filters, pathname, router],
  );

  const clear = useCallback(() => {
    startTransition(() => router.push(pathname));
  }, [pathname, router]);

  return (
    <div className="relative pb-[5.5rem] lg:pb-0">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {mode === "search" ? "Search results" : "Parts catalogue"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-fg/65">
            Filter by vehicle, brand, availability, and more. All prices shown in AUD including GST.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,280px)_1fr]">
          <aside className="hidden space-y-4 rounded-xl border border-border bg-card p-4 shadow-sm lg:sticky lg:top-24 lg:block lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:self-start">
            <CatalogFiltersFields filters={filters} setFilter={setFilter} clear={clear} showToolbar />
          </aside>

          <div className={cn("min-h-[320px] min-w-0", pending && "opacity-60 transition")}>
            {products.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-fg/65">
                No parts match your filters. Try clearing filters or broadening vehicle criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {products.map((p, i) => (
                  <ProductCard key={p.slug} product={p} index={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog
        anchor="left"
        open={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        title="Refine catalogue"
        className="border-border bg-card text-fg"
      >
        <div className="space-y-4">
          <CatalogFiltersFields filters={filters} setFilter={setFilter} clear={clear} showToolbar={false} />
          <div className="flex gap-2 border-t border-border pt-4">
            <Button type="button" variant="ghost" className="flex-1" onClick={clear}>
              Clear all
            </Button>
            <Button type="button" className="flex-1" onClick={() => setMobileFiltersOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Dialog>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 lg:hidden">
        <div className="pointer-events-auto mx-auto max-w-7xl px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
          <Button
            type="button"
            className="h-12 w-full shadow-lg shadow-black/30"
            onClick={() => setMobileFiltersOpen(true)}
          >
            Filters
            {activeFilterCount > 0 ? (
              <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent">
                {activeFilterCount} active
              </span>
            ) : null}
          </Button>
        </div>
      </div>
    </div>
  );
}
