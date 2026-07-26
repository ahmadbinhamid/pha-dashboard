import { Badge } from "@/components/ui/Badge";
import { TableRow, TableCell } from "@/components/ui/Table";
import { InventoryRowActionsMenu } from "@/components/inventory/InventoryRowActionsMenu";
import { STOCK_STATUS_CONFIG } from "@/config/stockStatus";
import { computeInventoryStockStatus } from "@/utils/inventoryStatus";
import type { InventoryRecord } from "@/types/inventory";

interface InventoryRowProps {
  record: InventoryRecord;
  lowStockThreshold: number;
  isVisible: (key: string) => boolean;
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
  onAdjust,
  onSetStock,
  onViewHistory,
}: InventoryRowProps) {
  const status = computeInventoryStockStatus(record.stock_count, lowStockThreshold);
  const statusConfig = STOCK_STATUS_CONFIG[status];

  return (
    <TableRow>
      {/* Product — sticky so it stays readable while the rest scrolls. */}
      <TableCell className="sticky left-0 z-1 max-w-64 sticky-col-cell sticky-col-separator-right">
        <div className="truncate font-medium text-fg">{record.product?.title ?? "—"}</div>
        {record.variant?.display_name && (
          <div className="mt-0.5 truncate text-xs text-fg/45">{record.variant.display_name}</div>
        )}
      </TableCell>

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
