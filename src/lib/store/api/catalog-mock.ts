import type { StoreProduct } from "@/lib/store/data/catalog";
import { CATALOG } from "@/lib/store/data/catalog";

export type CatalogFilters = {
  q?: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: string;
  engine?: string;
  brand?: string;
  category?: string;
  condition?: string;
  genuineType?: string;
  inStock?: string;
  warehouse?: string;
  priceMin?: string;
  priceMax?: string;
};

export function matchesCatalog(p: StoreProduct, f: CatalogFilters): boolean {
  const q = (f.q ?? "").trim().toLowerCase();
  if (q) {
    const hay = `${p.name} ${p.sku} ${p.brand} ${p.category} ${p.make} ${p.model}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  if (f.vin?.trim()) {
    // Placeholder: pretend VIN decode suggests make
    const vin = f.vin.trim().toUpperCase();
    if (vin.length >= 3 && !p.make.toLowerCase().includes("mer") && vin.startsWith("WDD")) {
      /* demo VIN WDD -> Mercedes */
    }
    if (vin.startsWith("WDD") && p.brand !== "Mercedes-Benz") return false;
    if (vin.startsWith("WB") && p.brand !== "BMW") return false;
  }
  if (f.make && p.make !== f.make) return false;
  if (f.model && !p.model.toLowerCase().includes(f.model.toLowerCase())) return false;
  if (f.year) {
    const y = Number(f.year);
    if (!Number.isNaN(y) && (y < p.yearFrom || y > p.yearTo)) return false;
  }
  if (f.engine && !p.engine.toLowerCase().includes(f.engine.toLowerCase())) return false;
  if (f.brand && p.brand !== f.brand) return false;
  if (f.category && p.category !== f.category) return false;
  if (f.condition && p.condition !== f.condition) return false;
  if (f.genuineType && p.genuineType !== f.genuineType) return false;
  if (f.inStock === "true" && !p.inStock) return false;
  if (f.warehouse && p.warehouse !== f.warehouse) return false;
  const min = f.priceMin ? Number(f.priceMin) : NaN;
  const max = f.priceMax ? Number(f.priceMax) : NaN;
  if (!Number.isNaN(min) && p.priceAud < min) return false;
  if (!Number.isNaN(max) && p.priceAud > max) return false;
  return true;
}

/** Mock API: list products with filters (future: fetch(`/api/v1/catalog`) ). */
export async function mockFetchCatalog(filters: CatalogFilters = {}): Promise<StoreProduct[]> {
  return CATALOG.filter((p) => matchesCatalog(p, filters));
}

/** Client-side instant filter (same rules as mock API). */
export function filterCatalogSync(filters: CatalogFilters = {}): StoreProduct[] {
  return CATALOG.filter((p) => matchesCatalog(p, filters));
}

export async function mockFetchProductBySlug(slug: string): Promise<StoreProduct | null> {
  const p = CATALOG.find((x) => x.slug === slug);
  return p ?? null;
}

export async function mockFetchBrands(): Promise<{ name: string; slug: string; count: number }[]> {
  const map = new Map<string, number>();
  for (const p of CATALOG) {
    map.set(p.brand, (map.get(p.brand) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, slug: name.toLowerCase().replace(/\s+/g, "-"), count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
