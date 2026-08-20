import { Badge } from "@/components/ui/Badge";
import { TableRow, TableCell } from "@/components/ui/Table";
import { StickyTableCell } from "@/components/ui/StickyTableColumn";
import { InventoryRowActionsMenu } from "@/components/inventory/InventoryRowActionsMenu";
import { STOCK_STATUS_CONFIG } from "@/config/stockStatus";
import { computeInventoryStockStatus } from "@/utils/inventoryStatus";
import type { InventoryRecord } from "@/types/inventory";

interface InventoryRowProps {
  record: InventoryRecord;
  lowStockThreshold: number;
  isVisible: (key: string) => boolean;
  columnWidth?: number;
  onColumnResize?: (width: number) => void;
  onAdjust: () => void;
  onSetStock: () => void;
  onViewHistory: () => void;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export function InventoryRow({
  record,
  lowStockThreshold,
  isVisible,
  columnWidth,
  onColumnResize,
  onAdjust,
  onSetStock,
  onViewHistory,
}: InventoryRowProps) {
  const status = computeInventoryStockStatus(record.stock_count, lowStockThreshold);
  const statusConfig = STOCK_STATUS_CONFIG[status];
  // Variant SKU is the more specific identifier when this row is a variant —
  // falls back to the product's own SKU otherwise.
  const sku = record.variant?.sku ?? record.product?.sku ?? null;

  return (
    <TableRow>
      {/* Product — sticky so it stays readable while the rest scrolls. */}
      <StickyTableCell size={56} width={columnWidth} onResize={onColumnResize}>
        <div className="truncate font-medium text-fg">{record.product?.title ?? "—"}</div>
        {record.variant?.display_name && (
          <div className="mt-0.5 truncate text-xs text-fg/45">{record.variant.display_name}</div>
        )}
      </StickyTableCell>

      {isVisible("sku") && (
        <TableCell className="whitespace-nowrap text-fg/70">{sku ?? "—"}</TableCell>
      )}

      {isVisible("location") && (
        <TableCell className="max-w-40 truncate">{record.location?.name ?? "—"}</TableCell>
      )}

      {isVisible("stock") && (
        <TableCell className="text-right font-semibold tabular-nums">
          <span className={status === "in_stock" ? "text-fg" : status === "low_stock" ? "text-warn" : "text-danger"}>
            {record.stock_count}
          </span>
        </TableCell>
      )}

      {isVisible("status") && (
        <TableCell className="whitespace-nowrap">
          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
        </TableCell>
      )}

      {isVisible("lastUpdated") && (
        <TableCell className="whitespace-nowrap text-fg/55">{formatDate(record.updated_at)}</TableCell>
      )}

      {isVisible("dateAdded") && (
        <TableCell className="whitespace-nowrap text-fg/45">{formatDate(record.created_at)}</TableCell>
      )}

      <TableCell className="w-px whitespace-nowrap text-right">
        <InventoryRowActionsMenu onAdjust={onAdjust} onSetStock={onSetStock} onViewHistory={onViewHistory} />
      </TableCell>
    </TableRow>
  );
}
