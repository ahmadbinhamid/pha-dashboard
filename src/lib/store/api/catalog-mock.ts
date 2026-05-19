// Re-exports from the canonical API layer for backwards-compatibility during migration.
// Prefer importing directly from @/lib/api/catalog in new code.
export {
  matchesCatalog,
  filterCatalogSync,
  getCatalog as mockFetchCatalog,
  getProductBySlug as mockFetchProductBySlug,
  getProductBySlugSync as mockFetchProductBySlugSync,
  getBrands as mockFetchBrands,
  getBrandsSync as mockFetchBrandsSync,
} from "@/lib/api/catalog";

export type { CatalogFilters } from "@/types";
