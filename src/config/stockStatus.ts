import type { StockStatus } from "@/types/inventory";

type BadgeVariant = "default" | "ok" | "warn" | "danger" | "muted" | "outline";

export const STOCK_STATUS_CONFIG: Record<StockStatus, { label: string; variant: BadgeVariant }> = {
  in_stock: { label: "In Stock", variant: "ok" },
  low_stock: { label: "Low Stock", variant: "warn" },
  out_of_stock: { label: "Out of Stock", variant: "danger" },
};
