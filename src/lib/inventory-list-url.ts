export type EbayFilter = "all" | "synced" | "pending" | "error" | "not_listed";

export type InventoryListView = "table" | "tiles";

export type InventoryUrlFilters = {
  q: string;
  category: string;
  ebay: EbayFilter;
  make: string;
  model: string;
  year: string;
  view: InventoryListView;
};

/** Query fields used by the global / dashboard search (no layout `view`). */
export type InventorySearchQuery = Omit<InventoryUrlFilters, "view">;

const EBAY_SET = new Set<string>(["synced", "pending", "error", "not_listed"]);

export function parseEbayFilter(v: string | null): EbayFilter {
  if (v && EBAY_SET.has(v)) return v as EbayFilter;
  return "all";
}

export function inventoryFiltersFromSearchParams(sp: URLSearchParams): InventoryUrlFilters {
  const view = sp.get("view");
  return {
    q: sp.get("q") ?? "",
    category: sp.get("category") ?? "",
    ebay: parseEbayFilter(sp.get("ebay")),
    make: sp.get("make") ?? "",
    model: sp.get("model") ?? "",
    year: sp.get("year") ?? "",
    view: view === "tiles" ? "tiles" : "table",
  };
}

export function buildInventoryListUrl(f: Partial<InventoryUrlFilters>): string {
  const p = new URLSearchParams();
  if (f.q?.trim()) p.set("q", f.q.trim());
  if (f.category?.trim()) p.set("category", f.category.trim());
  if (f.ebay && f.ebay !== "all") p.set("ebay", f.ebay);
  if (f.make?.trim()) p.set("make", f.make.trim());
  if (f.model?.trim()) p.set("model", f.model.trim());
  if (f.year?.trim()) p.set("year", f.year.trim());
  if (f.view === "tiles") p.set("view", "tiles");
  const s = p.toString();
  return s ? `/inventory?${s}` : "/inventory";
}
