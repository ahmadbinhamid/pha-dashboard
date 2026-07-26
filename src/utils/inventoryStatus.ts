import type { StockStatus } from "@/types/inventory";

// The list endpoint doesn't project a stock_status field (only Product's own
// stock_status is computed server-side) — this mirrors that logic per
// InventoryRecord, using the org's configurable low_stock_threshold (not the
// separate display-only STOCK_LOW_THRESHOLD=3 constant the backend uses for
// simple Product cards) so it matches the Dashboard's Critical Stock definition.
export function computeInventoryStockStatus(stockCount: number, lowStockThreshold: number): StockStatus {
  if (stockCount <= 0) return "out_of_stock";
  if (stockCount <= lowStockThreshold) return "low_stock";
  return "in_stock";
}
