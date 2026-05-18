import type { CatalogFilters } from "@/lib/store/api/catalog-mock";

function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export function catalogFiltersFromSearchParams(
  sp: Record<string, string | string[] | undefined>,
): CatalogFilters {
  return {
    q: first(sp.q),
    vin: first(sp.vin),
    make: first(sp.make),
    model: first(sp.model),
    year: first(sp.year),
    engine: first(sp.engine),
    brand: first(sp.brand),
    category: first(sp.category),
    condition: first(sp.condition),
    genuineType: first(sp.genuineType),
    inStock: first(sp.inStock),
    warehouse: first(sp.warehouse),
    priceMin: first(sp.priceMin),
    priceMax: first(sp.priceMax),
  };
}
