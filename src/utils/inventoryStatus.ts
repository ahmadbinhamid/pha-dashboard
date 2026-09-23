import type { StockStatus } from "@/types/inventory";

// The list endpoint doesn't project stock_status per InventoryRecord (only Product's is computed server-side) — this mirrors that logic using the org's configurable low_stock_threshold, matching Critical Stock's definition.
export function computeInventoryStockStatus(stockCount: number, lowStockThreshold: number): StockStatus {
  if (stockCount <= 0) return "out_of_stock";
  if (stockCount <= lowStockThreshold) return "low_stock";
  return "in_stock";
}
