import { Badge } from "@/components/ui/badge";
import type { InventoryRecord, StockStatus } from "@/types/inventory";

export function computeStockStatus(
  count: number,
  threshold: number,
): StockStatus {
  if (count <= 0) return "out_of_stock";
  if (count <= threshold) return "low_stock";
  return "in_stock";
}

const STATUS_BADGE_MAP: Record<
  StockStatus,
  { label: string; variant: "ok" | "warn" | "danger" }
> = {
  in_stock: { label: "In Stock", variant: "ok" },
  low_stock: { label: "Low Stock", variant: "warn" },
  out_of_stock: { label: "Out of Stock", variant: "danger" },
};

interface StockBadgeProps {
  item: InventoryRecord;
  threshold: number;
}

export function StockBadge({ item, threshold }: StockBadgeProps) {
  const status = computeStockStatus(item.stock_count, threshold);
  const { label, variant } = STATUS_BADGE_MAP[status];
  return (
    <Badge variant={variant}>
      {item.stock_count} — {label}
    </Badge>
  );
}
